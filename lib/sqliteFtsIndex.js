/**
 * SQLite FTS5 full-text index for large projects (optional; requires Node 22+ node:sqlite).
 * Falls back to JSON BM25 index when unavailable.
 */
const fs = require('fs-extra');
const path = require('path');

let DatabaseSync = null;
try {
  // eslint-disable-next-line global-require
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
  DatabaseSync = null;
}

function sqliteFtsAvailable() {
  return !!DatabaseSync;
}

class SqliteFtsIndex {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.dbPath = path.join(projectRoot, '.fa7', 'fts.sqlite');
    this.db = null;
  }

  _open() {
    if (this.db) return this.db;
    fs.ensureDirSync(path.dirname(this.dbPath));
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_docs USING fts5(
        path UNINDEXED,
        body,
        tokenize='unicode61 remove_diacritics 2'
      );
    `);
    return this.db;
  }

  async load() {
    this._open();
  }

  async save() {
    /* persisted on disk */
  }

  indexFile(relPath, content, symbols = []) {
    const db = this._open();
    const symText = symbols.map((s) => (typeof s === 'string' ? s : s.content || '')).join(' ');
    const body = `${relPath} ${symText} ${content}`.slice(0, 50000);
    db.prepare('DELETE FROM fts_docs WHERE path = ?').run(relPath);
    db.prepare('INSERT INTO fts_docs(path, body) VALUES (?, ?)').run(relPath, body);
  }

  rebuildFromIndexer(indexer) {
    const db = this._open();
    db.exec('DELETE FROM fts_docs');
    const insert = db.prepare('INSERT INTO fts_docs(path, body) VALUES (?, ?)');
    for (const [relPath, data] of indexer.index.entries()) {
      const symText = (data.symbols || []).map((s) => s.content || '').join(' ');
      const body = `${relPath} ${symText} ${data.summary || ''}`.slice(0, 50000);
      insert.run(relPath, body);
    }
    return { files: indexer.index.size };
  }

  search(query, topK = 10) {
    const db = this._open();
    const q = String(query || '').trim();
    if (!q) return [];
    try {
      const rows = db.prepare(
        `SELECT path, snippet(fts_docs, 1, '«', '»', '…', 24) AS text,
                bm25(fts_docs) AS rank
         FROM fts_docs
         WHERE fts_docs MATCH ?
         ORDER BY rank
         LIMIT ?`
      ).all(this._escapeFtsQuery(q), topK);
      return rows.map((r) => ({
        path: r.path,
        text: r.text || '',
        score: Math.max(0, 10 - Number(r.rank || 0))
      }));
    } catch {
      return [];
    }
  }

  _escapeFtsQuery(q) {
    return q.split(/\s+/).filter(Boolean).map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
  }

  formatForContext(hits) {
    if (!hits.length) return '';
    return '## FTS matches (SQLite)\n' + hits.map((h) => `### ${h.path} (${h.score.toFixed(2)})\n${h.text}`).join('\n\n');
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
  }
}

module.exports = { SqliteFtsIndex, sqliteFtsAvailable };
