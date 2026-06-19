const { runPostEditChecks } = require('./lintRunner');

const SEVERITY_LABEL = { 8: 'Error', 4: 'Warning', 2: 'Info', 1: 'Hint' };

/** @type {Map<string, object[]>} */
const markersByFile = new Map();
let storedActiveFile = '';
let storedAt = 0;

function normalizeMarker(m) {
  return {
    resource: String(m.resource || m.path || ''),
    message: String(m.message || ''),
    severity: Number(m.severity || 8),
    startLineNumber: Number(m.startLineNumber || m.line || 1),
    startColumn: Number(m.startColumn || m.column || 1),
    endLineNumber: Number(m.endLineNumber || m.startLineNumber || m.line || 1),
    endColumn: Number(m.endColumn || m.startColumn || m.column || 1),
    source: String(m.source || 'editor')
  };
}

function syncMarkers(markers = [], activeFile = '') {
  const file = String(activeFile || '').replace(/^\.\//, '');
  const normalized = (Array.isArray(markers) ? markers : []).map(normalizeMarker).slice(0, 200);
  if (file) markersByFile.set(file, normalized);
  storedActiveFile = file;
  storedAt = Date.now();
  return { count: allMarkers().length, activeFile: storedActiveFile, fileCount: markersByFile.size };
}

function syncWorkspaceMarkers(files = []) {
  if (!Array.isArray(files)) return syncMarkers([], '');
  for (const entry of files) {
    const file = String(entry?.path || entry?.activeFile || '').replace(/^\.\//, '');
    if (!file) continue;
    const markers = Array.isArray(entry.markers) ? entry.markers.map(normalizeMarker) : [];
    markersByFile.set(file, markers.slice(0, 80));
  }
  storedAt = Date.now();
  return { count: allMarkers().length, fileCount: markersByFile.size };
}

function allMarkers() {
  const out = [];
  for (const [file, list] of markersByFile.entries()) {
    for (const m of list) {
      out.push({ ...m, resource: m.resource || file });
    }
  }
  return out;
}

function formatMarkers(markers, { fileFilter } = {}) {
  let list = markers;
  if (fileFilter) {
    const f = String(fileFilter).replace(/^\.\//, '');
    list = list.filter((m) => m.resource === f || m.resource.endsWith(`/${f}`));
  }
  if (!list.length) return '';

  const byFile = new Map();
  for (const m of list) {
    const key = m.resource || '(unknown)';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(m);
  }

  const lines = ['## Problems / diagnostics'];
  for (const [file, items] of byFile.entries()) {
    lines.push(`\n### ${file}`);
    for (const m of items.slice(0, 40)) {
      const sev = SEVERITY_LABEL[m.severity] || 'Issue';
      lines.push(
        `- [${sev}] L${m.startLineNumber}:${m.startColumn} — ${m.message}${m.source ? ` (${m.source})` : ''}`
      );
    }
    if (items.length > 40) lines.push(`- … and ${items.length - 40} more`);
  }
  return lines.join('\n');
}

async function buildProblemsContext(projectRoot, { file, runLint = false } = {}) {
  const sections = [];
  const all = allMarkers();
  const editorBlock = formatMarkers(file ? all.filter((m) => m.resource === file.replace(/^\.\//, '') || m.resource.endsWith(file)) : all);
  if (editorBlock) sections.push(editorBlock);

  if (runLint && projectRoot) {
    const files = file ? [String(file).replace(/^\.\//, '')] : [];
    const lint = await runPostEditChecks(projectRoot, files);
    if (lint.failed && lint.feedback) {
      sections.push('## Lint / test output\n```\n' + lint.feedback.trim().slice(0, 12000) + '\n```');
    } else if (runLint) {
      sections.push('## Lint / test\nNo lint/test failures detected.');
    }
  }

  if (!sections.length) {
    return '## Problems\n(no editor diagnostics or lint issues found)';
  }
  return sections.join('\n\n');
}

function getStoredSummary() {
  const all = allMarkers();
  return {
    count: all.length,
    activeFile: storedActiveFile,
    fileCount: markersByFile.size,
    updatedAt: storedAt,
    markers: all
  };
}

module.exports = {
  syncMarkers,
  syncWorkspaceMarkers,
  allMarkers,
  formatMarkers,
  buildProblemsContext,
  getStoredSummary
};
