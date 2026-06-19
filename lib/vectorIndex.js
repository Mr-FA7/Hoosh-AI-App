/**
 * Local vector index using Ollama embeddings + JSON persistence.
 */
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const INDEX_FILE = 'vector-index.json';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
    if (i < 0) break;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}

class VectorIndex {
  constructor(projectRoot, ollamaBase) {
    this.projectRoot = projectRoot;
    this.ollamaBase = String(ollamaBase || 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.indexPath = path.join(projectRoot, '.fa7', INDEX_FILE);
    this.entries = [];
    this.model = 'nomic-embed-text';
  }

  async load() {
    try {
      if (await fs.pathExists(this.indexPath)) {
        const data = await fs.readJson(this.indexPath);
        this.entries = data.entries || [];
        this.model = data.model || this.model;
      }
    } catch {
      this.entries = [];
    }
  }

  async save() {
    await fs.ensureDir(path.dirname(this.indexPath));
    await fs.writeJson(this.indexPath, { model: this.model, entries: this.entries }, { spaces: 0 });
  }

  async embed(text) {
    const r = await axios.post(`${this.ollamaBase}/api/embed`, {
      model: this.model,
      input: String(text).slice(0, 8000)
    }, { timeout: 60000 });
    const emb = r.data?.embeddings?.[0] || r.data?.embedding;
    if (!emb) throw new Error('No embedding returned — run: ollama pull nomic-embed-text');
    return emb;
  }

  async indexFile(relPath, content) {
    const chunks = chunkText(content);
    const newEntries = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const vector = await this.embed(chunks[i]);
        newEntries.push({
          path: relPath,
          chunk: i,
          text: chunks[i].slice(0, 500),
          vector
        });
      } catch (e) {
        console.warn('[VectorIndex] embed failed:', relPath, e.message);
        break;
      }
    }
    this.entries = this.entries.filter((e) => e.path !== relPath).concat(newEntries);
  }

  async rebuildFromIndexer(indexer, maxFiles = 80) {
    await this.load();
    const paths = Array.from(indexer.index?.keys() || []).slice(0, maxFiles);
    for (const rel of paths) {
      const data = indexer.index.get(rel);
      if (!data?.summary) continue;
      try {
        const full = await fs.readFile(path.join(this.projectRoot, rel), 'utf8');
        await this.indexFile(rel, full);
      } catch {
        await this.indexFile(rel, data.summary);
      }
    }
    await this.save();
    return { files: paths.length, chunks: this.entries.length };
  }

  async search(query, topK = 8) {
    await this.load();
    if (this.entries.length === 0) return [];
    let qVec;
    try {
      qVec = await this.embed(query);
    } catch {
      return [];
    }
    return this.entries
      .map((e) => ({ ...e, score: cosine(qVec, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ path: p, text, score, chunk }) => ({ path: p, text, score, chunk }));
  }

  formatForContext(hits) {
    if (!hits.length) return '';
    return '## Semantic search results\n' + hits.map((h) =>
      `### ${h.path} (score ${h.score.toFixed(3)})\n${h.text}`).join('\n\n');
  }
}

module.exports = { VectorIndex, chunkText, cosine };
