/**
 * LanceDB-backed vector index for large projects.
 * Uses Ollama embeddings via VectorIndex.embed() compatibility.
 */
const path = require('path');

class LanceVectorIndex {
  constructor(projectRoot, embedder) {
    this.projectRoot = projectRoot;
    this.embedder = embedder; // expects async (text) => vector
    this.dbDir = path.join(projectRoot, '.fa7', 'lancedb');
    this.tableName = 'code_chunks';
    this.ready = false;
    this.lancedb = null;
    this.table = null;
  }

  async init() {
    if (this.ready) return true;
    // eslint-disable-next-line global-require
    this.lancedb = require('@lancedb/lancedb');
    const db = await this.lancedb.connect(this.dbDir);
    const tables = await db.tableNames();
    if (tables.includes(this.tableName)) {
      this.table = await db.openTable(this.tableName);
    } else {
      this.table = await db.createTable(this.tableName, [], { mode: 'overwrite' });
    }
    this.ready = true;
    return true;
  }

  async upsertChunks(chunks) {
    await this.init();
    if (!chunks.length) return;
    await this.table.add(chunks);
  }

  async rebuildFromVectorIndex(vectorIndex) {
    await this.init();
    // Reuse existing JSON vectorIndex entries to seed LanceDB.
    await vectorIndex.load();
    const rows = (vectorIndex.entries || []).map((e) => ({
      path: e.path,
      chunk: e.chunk,
      text: e.text,
      vector: e.vector
    }));
    // overwrite by recreating table
    const db = await this.lancedb.connect(this.dbDir);
    this.table = await db.createTable(this.tableName, rows, { mode: 'overwrite' });
    const fs = require('fs-extra');
    await fs.ensureDir(this.dbDir);
    await fs.writeJson(path.join(this.dbDir, 'manifest.json'), {
      entryCount: rows.length,
      rebuiltAt: new Date().toISOString()
    }, { spaces: 2 });
    return { chunks: rows.length };
  }

  async needsRebuild(vectorIndex) {
    const fs = require('fs-extra');
    const manifestPath = path.join(this.dbDir, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) return true;
    try {
      await vectorIndex.load();
      const manifest = await fs.readJson(manifestPath);
      return Number(manifest.entryCount || 0) !== (vectorIndex.entries || []).length;
    } catch {
      return true;
    }
  }

  async search(query, topK = 8) {
    await this.init();
    const qVec = await this.embedder(query);
    const res = await this.table.search(qVec).limit(topK).toArray();
    return (res || []).map((r) => ({
      path: r.path,
      chunk: r.chunk,
      text: r.text,
      score: r._distance != null ? 1 / (1 + r._distance) : 0
    }));
  }
}

module.exports = { LanceVectorIndex };

