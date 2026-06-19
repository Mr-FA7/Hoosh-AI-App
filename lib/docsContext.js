const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const DOC_EXT = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);
const DEFAULT_FOLDERS = ['docs', 'doc', 'documentation'];
const MAX_DOC_CHARS = 80000;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function docsConfigPath(projectRoot) {
  return path.join(projectRoot, '.fa7', 'docs.json');
}

function docsCacheDir(projectRoot) {
  return path.join(projectRoot, '.fa7', 'docs-cache');
}

async function loadConfig(projectRoot) {
  const defaults = {
    sources: DEFAULT_FOLDERS.map((f) => ({ id: f, title: f, type: 'folder', path: f }))
  };
  try {
    const p = docsConfigPath(projectRoot);
    if (await fs.pathExists(p)) {
      const raw = await fs.readJson(p);
      const sources = Array.isArray(raw?.sources) ? raw.sources : defaults.sources;
      return { sources };
    }
  } catch { /* ignore */ }
  return defaults;
}

async function saveConfig(projectRoot, config) {
  const p = docsConfigPath(projectRoot);
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, config, { spaces: 2 });
}

function tokenize(q) {
  return String(q || '').toLowerCase().split(/\W+/).filter((t) => t.length > 1);
}

function scoreDoc(queryTokens, text, title) {
  const hay = `${title} ${text}`.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

async function walkFolder(projectRoot, relFolder, out) {
  const abs = path.join(projectRoot, relFolder);
  if (!(await fs.pathExists(abs))) return;
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    const rel = path.join(relFolder, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      await walkFolder(projectRoot, rel, out);
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!DOC_EXT.has(ext)) continue;
    try {
      const content = (await fs.readFile(path.join(projectRoot, rel), 'utf8')).slice(0, MAX_DOC_CHARS);
      out.push({ id: rel, title: rel, type: 'file', path: rel, content });
    } catch { /* skip */ }
  }
}

async function fetchUrlDoc(projectRoot, source) {
  const url = String(source.url || '').trim();
  if (!url) return null;
  const cacheDir = docsCacheDir(projectRoot);
  await fs.ensureDir(cacheDir);
  const hash = Buffer.from(url).toString('base64url').slice(0, 48);
  const cacheFile = path.join(cacheDir, `${hash}.txt`);
  try {
    if (await fs.pathExists(cacheFile)) {
      const stat = await fs.stat(cacheFile);
      if (Date.now() - stat.mtimeMs < MAX_CACHE_AGE_MS) {
        const content = await fs.readFile(cacheFile, 'utf8');
        return { id: source.id || url, title: source.title || url, type: 'url', url, content };
      }
    }
  } catch { /* refetch */ }

  try {
    const res = await axios.get(url, {
      timeout: 15000,
      maxContentLength: 2 * 1024 * 1024,
      headers: { 'User-Agent': 'Hoosh-AI-DocsIndexer/1.0' }
    });
    const raw = String(res.data || '');
    const content = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_DOC_CHARS);
    await fs.writeFile(cacheFile, content, 'utf8');
    return { id: source.id || url, title: source.title || url, type: 'url', url, content };
  } catch (e) {
    return {
      id: source.id || url,
      title: source.title || url,
      type: 'url',
      url,
      content: `(failed to fetch: ${e.message})`
    };
  }
}

async function collectDocs(projectRoot) {
  const config = await loadConfig(projectRoot);
  const docs = [];
  const seen = new Set();

  for (const src of config.sources) {
    if (src.type === 'folder' && src.path) {
      const rel = String(src.path).replace(/^\.\//, '');
      await walkFolder(projectRoot, rel, docs);
      continue;
    }
    if (src.type === 'file' && src.path) {
      const rel = String(src.path).replace(/^\.\//, '');
      if (seen.has(rel)) continue;
      seen.add(rel);
      try {
        const content = (await fs.readFile(path.join(projectRoot, rel), 'utf8')).slice(0, MAX_DOC_CHARS);
        docs.push({ id: rel, title: src.title || rel, type: 'file', path: rel, content });
      } catch { /* skip */ }
      continue;
    }
    if (src.type === 'url' && src.url) {
      const doc = await fetchUrlDoc(projectRoot, src);
      if (doc) docs.push(doc);
    }
  }

  for (const name of ['README.md', 'readme.md', 'CONTRIBUTING.md']) {
    const rel = name;
    if (seen.has(rel)) continue;
    const abs = path.join(projectRoot, rel);
    if (await fs.pathExists(abs)) {
      seen.add(rel);
      try {
        const content = (await fs.readFile(abs, 'utf8')).slice(0, MAX_DOC_CHARS);
        docs.push({ id: rel, title: rel, type: 'file', path: rel, content });
      } catch { /* skip */ }
    }
  }

  return { config, docs };
}

function rerankWithCodeHits(results, codeHits = []) {
  if (!codeHits.length) return results;
  const paths = new Set(
    codeHits.map((h) => String(h.path || h.file || h.id || '').replace(/^\.\//, '').toLowerCase()).filter(Boolean)
  );
  return [...results]
    .map((d) => {
      const p = String(d.path || d.id || '').toLowerCase();
      let boost = 0;
      for (const hit of paths) {
        if (p.includes(hit) || hit.includes(p)) boost += 2;
      }
      return { ...d, score: (d.score || 0) + boost };
    })
    .sort((a, b) => b.score - a.score);
}

async function searchDocs(projectRoot, query, topK = 8, options = {}) {
  const { config, docs } = await collectDocs(projectRoot);
  const q = String(query || '').trim();
  const tokens = tokenize(q);

  let ranked;
  if (!tokens.length) {
    ranked = docs.slice(0, topK).map((d) => ({ ...d, score: 0 }));
  } else {
    ranked = docs
      .map((d) => ({ ...d, score: scoreDoc(tokens, d.content, d.title) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) {
      ranked = docs.slice(0, Math.min(topK * 2, docs.length)).map((d) => ({ ...d, score: 0 }));
    }
  }

  if (options.codeHits?.length) {
    ranked = rerankWithCodeHits(ranked, options.codeHits);
  }

  return { config, results: ranked.slice(0, topK) };
}

function formatDocsContext(results, query) {
  const lines = ['## Documentation context'];
  if (query) lines.push(`Query: ${query}`);
  if (!results.length) {
    lines.push('\n(no documentation sources found — add folders/URLs in .fa7/docs.json)');
    return lines.join('\n');
  }
  for (const r of results) {
    const label = r.path || r.url || r.title;
    lines.push(`\n### ${label}`);
    const snippet = (r.content || '').trim().slice(0, 4000);
    lines.push('```\n' + snippet + '\n```');
  }
  return lines.join('\n');
}

async function addDocSource(projectRoot, body) {
  const config = await loadConfig(projectRoot);
  const type = String(body?.type || 'folder');
  const id = String(body?.id || body?.path || body?.url || Date.now());
  const entry = {
    id,
    title: String(body?.title || id),
    type
  };
  if (type === 'folder' || type === 'file') entry.path = String(body?.path || '').replace(/^\.\//, '');
  if (type === 'url') entry.url = String(body?.url || '');
  const exists = config.sources.some((s) => s.id === id);
  if (!exists) config.sources.push(entry);
  await saveConfig(projectRoot, config);
  return { ok: true, source: entry, sources: config.sources };
}

module.exports = {
  loadConfig,
  saveConfig,
  collectDocs,
  searchDocs,
  rerankWithCodeHits,
  formatDocsContext,
  addDocSource
};
