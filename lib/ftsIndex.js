/**
 * In-memory FTS-style index with BM25-ish scoring (Continue-inspired).
 */
const fs = require('fs-extra');
const path = require('path');

const INDEX_FILE = 'fts-index.json';

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

class FtsIndex {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.indexPath = path.join(projectRoot, '.fa7', INDEX_FILE);
    /** @type {Map<string, {tokens: string[], text: string, symbols: string[]}>} */
    this.docs = new Map();
    this.df = new Map();
    this.avgLen = 0;
  }

  async load() {
    try {
      if (await fs.pathExists(this.indexPath)) {
        const data = await fs.readJson(this.indexPath);
        this.docs = new Map(Object.entries(data.docs || {}));
        this.df = new Map(Object.entries(data.df || {}));
        this.avgLen = data.avgLen || 0;
      }
    } catch {
      this.docs.clear();
    }
  }

  async save() {
    await fs.ensureDir(path.dirname(this.indexPath));
    await fs.writeJson(this.indexPath, {
      docs: Object.fromEntries(this.docs),
      df: Object.fromEntries(this.df),
      avgLen: this.avgLen
    }, { spaces: 0 });
  }

  indexFile(relPath, content, symbols = []) {
    const symText = symbols.map((s) => (typeof s === 'string' ? s : s.content || '')).join(' ');
    const text = `${relPath} ${symText} ${content}`.slice(0, 50000);
    const tokens = tokenize(text);
    const old = this.docs.get(relPath);
    if (old) {
      for (const t of old.tokens) {
        const c = (this.df.get(t) || 1) - 1;
        if (c <= 0) this.df.delete(t);
        else this.df.set(t, c);
      }
    }
    for (const t of tokens) {
      this.df.set(t, (this.df.get(t) || 0) + 1);
    }
    this.docs.set(relPath, { tokens, text: text.slice(0, 2000), symbols: symText.split(' ').filter(Boolean) });
    let total = 0;
    for (const d of this.docs.values()) total += d.tokens.length;
    this.avgLen = this.docs.size ? total / this.docs.size : 0;
  }

  rebuildFromIndexer(indexer) {
    this.docs.clear();
    this.df.clear();
    for (const [relPath, data] of indexer.index.entries()) {
      this.indexFile(relPath, data.summary || '', data.symbols || []);
    }
    return { files: this.docs.size };
  }

  search(query, topK = 10) {
    const qTokens = tokenize(query);
    if (!qTokens.length || this.docs.size === 0) return [];
    const N = this.docs.size;
    const k1 = 1.2;
    const b = 0.75;
    const scores = [];

    for (const [relPath, doc] of this.docs.entries()) {
      let score = 0;
      const dl = doc.tokens.length || 1;
      const tfMap = new Map();
      for (const t of doc.tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);

      for (const qt of qTokens) {
        const df = this.df.get(qt) || 0;
        if (!df) continue;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const tf = tfMap.get(qt) || 0;
        const num = tf * (k1 + 1);
        const den = tf + k1 * (1 - b + b * (dl / (this.avgLen || 1)));
        score += idf * (num / den);
        if (relPath.toLowerCase().includes(qt)) score += 2;
      }
      if (score > 0) {
        const snippet = doc.text.slice(0, 300);
        scores.push({ path: relPath, score, text: snippet });
      }
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  formatForContext(hits) {
    if (!hits.length) return '';
    return '## FTS matches\n' + hits.map((h) => `### ${h.path} (${h.score.toFixed(2)})\n${h.text}`).join('\n\n');
  }
}

module.exports = { FtsIndex, tokenize };
