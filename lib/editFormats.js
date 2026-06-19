/**
 * Multi-format edit application (Aider/Void-inspired).
 * Supports: search_replace, editblock, udiff, wholefile
 */

function normalizeNewlines(s) {
  return String(s || '').replace(/\r\n/g, '\n');
}

function collapseWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** Find search string with optional fuzzy whitespace matching */
function findSearchMatch(content, search, options = {}) {
  const nExisting = normalizeNewlines(content);
  const nSearch = normalizeNewlines(search);
  if (!nSearch) return { ok: false, error: 'Empty search string' };

  const exactIdx = nExisting.indexOf(nSearch);
  if (exactIdx !== -1) {
    return { ok: true, start: exactIdx, end: exactIdx + nSearch.length, match: nSearch };
  }

  if (options.fuzzy !== false) {
    const fuzzyNeedle = collapseWhitespace(nSearch);
    if (fuzzyNeedle.length >= 8) {
      const chunks = nExisting.split(/\n/);
      for (let i = 0; i < chunks.length; i++) {
        for (let j = i; j < Math.min(i + 40, chunks.length); j++) {
          const block = chunks.slice(i, j + 1).join('\n');
          if (collapseWhitespace(block).includes(fuzzyNeedle)) {
            const idx = nExisting.indexOf(block);
            if (idx !== -1) {
              return { ok: true, start: idx, end: idx + block.length, match: block };
            }
          }
        }
      }
    }
  }

  if (options.trimLines) {
    const searchLines = nSearch.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);
    if (searchLines.length) {
      const contentLines = nExisting.split('\n');
      outer: for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
        for (let j = 0; j < searchLines.length; j++) {
          if (contentLines[i + j].trimEnd() !== searchLines[j]) continue outer;
        }
        const block = contentLines.slice(i, i + searchLines.length).join('\n');
        const idx = nExisting.indexOf(block);
        if (idx !== -1) {
          return { ok: true, start: idx, end: idx + block.length, match: block };
        }
      }
    }
  }

  return { ok: false, error: 'Search string not found' };
}

function applySearchReplace(content, search, replace, options = {}) {
  const nExisting = normalizeNewlines(content);
  const nReplace = normalizeNewlines(replace);
  const found = findSearchMatch(nExisting, search, options);
  if (!found.ok) return found;

  if (options.replace_all) {
    let out = nExisting;
    let count = 0;
    let cursor = 0;
    while (cursor < out.length) {
      const slice = out.slice(cursor);
      const hit = findSearchMatch(slice, search, options);
      if (!hit.ok) break;
      const absStart = cursor + hit.start;
      const absEnd = cursor + hit.end;
      out = out.slice(0, absStart) + nReplace + out.slice(absEnd);
      count++;
      cursor = absStart + nReplace.length;
    }
    if (!count) return { ok: false, error: 'Search string not found' };
    return { ok: true, content: out, replacements: count };
  }

  const before = nExisting.slice(0, found.start);
  const after = nExisting.slice(found.end);
  return { ok: true, content: before + nReplace + after, replacements: 1 };
}

/** ```editblock path\n<<<< SEARCH\n...\n====\n...\n>>>> REPLACE\n``` */
function parseEditBlocks(text) {
  const blocks = [];
  const re = /```(?:editblock|EDITBLOCK)\s+([^\n]+)\n<<<<\s*SEARCH\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>\s*REPLACE/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ path: m[1].trim(), search: m[2], replace: m[3] });
  }
  return blocks;
}

function linesMatch(a, b, fuzzy = true) {
  if (a === b) return true;
  if (!fuzzy) return false;
  return a.trimEnd() === b.trimEnd();
}

/** Unified diff hunks — apply with trim-tolerant line matching */
function applyUdiff(content, udiffText, options = {}) {
  const lines = normalizeNewlines(content).split('\n');
  const diffLines = normalizeNewlines(udiffText).split('\n');
  let out = [...lines];
  let lineIdx = 0;
  let i = 0;
  const fuzzy = options.fuzzy !== false;

  while (i < diffLines.length) {
    const line = diffLines[i];
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (match) lineIdx = parseInt(match[1], 10) - 1;
      i++;
      continue;
    }
    if (line.startsWith('---') || line.startsWith('+++')) { i++; continue; }
    if (line.startsWith(' ')) {
      const ctx = line.slice(1);
      if (out[lineIdx] === undefined || !linesMatch(out[lineIdx], ctx, fuzzy)) {
        return { ok: false, error: `Udiff context mismatch at line ${lineIdx + 1}` };
      }
      lineIdx++;
      i++;
      continue;
    }
    if (line.startsWith('-')) {
      const removed = line.slice(1);
      if (!linesMatch(out[lineIdx] ?? '', removed, fuzzy)) {
        return { ok: false, error: `Udiff removal mismatch at line ${lineIdx + 1}` };
      }
      out.splice(lineIdx, 1);
      i++;
      continue;
    }
    if (line.startsWith('+')) {
      out.splice(lineIdx, 0, line.slice(1));
      lineIdx++;
      i++;
      continue;
    }
    i++;
  }
  return { ok: true, content: out.join('\n') };
}

function applyEdit(toolArgs, existingContent) {
  const format = String(toolArgs.format || 'search_replace').toLowerCase();
  const options = {
    replace_all: !!toolArgs.replace_all,
    fuzzy: toolArgs.fuzzy !== false,
    trimLines: toolArgs.trim_lines !== false
  };

  if (format === 'wholefile' || format === 'write') {
    return { ok: true, content: toolArgs.content || toolArgs.replace || '' };
  }
  if (format === 'udiff') {
    return applyUdiff(existingContent, toolArgs.udiff || toolArgs.diff || toolArgs.content, options);
  }
  if (format === 'editblock') {
    return applySearchReplace(existingContent, toolArgs.search, toolArgs.replace, options);
  }
  return applySearchReplace(
    existingContent,
    toolArgs.search,
    toolArgs.replace || toolArgs.content,
    options
  );
}

function extractEditsFromResponse(text) {
  const blocks = parseEditBlocks(text);
  if (blocks.length) return blocks.map((b) => ({ ...b, format: 'editblock' }));
  return [];
}

module.exports = {
  applySearchReplace,
  findSearchMatch,
  applyUdiff,
  applyEdit,
  parseEditBlocks,
  extractEditsFromResponse,
  normalizeNewlines
};
