const fs = require('fs-extra');
const path = require('path');
const { extractSymbols } = require('./lib/astIndexer');
const { pageRank } = require('./lib/pageRank');
const { extractTreeSitterTags } = require('./lib/treeSitterTags');

const SKIPPED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist_electron',
  'build',
  'models',
  'assets',
  'venv',
  '.venv',
  '__pycache__',
  'vendor',
  'external',
  'Example'
]);
const MAX_INDEX_FILE_BYTES = 512 * 1024;

class Indexer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.workspaceManager = null;
    this.index = new Map();
    this.reverseIndex = new Map(); // Reverse Mapping: dependency -> [files that use it]
    this.vectorIndex = null;
    this.ftsIndex = null;
    this.lanceIndex = null;
    this.recentEdits = [];
    this.pageRankScores = new Map();
  }

  setVectorIndex(vi) {
    this.vectorIndex = vi;
  }

  setFtsIndex(fts) {
    this.ftsIndex = fts;
  }

  trackRecentEdit(relPath) {
    const p = String(relPath || '').replace(/^\.\//, '');
    this.recentEdits = [p, ...this.recentEdits.filter((x) => x !== p)].slice(0, 20);
  }

  recomputePageRank() {
    this.pageRankScores = pageRank(this.index, this.reverseIndex);
  }

  setLanceIndex(li) {
    this.lanceIndex = li;
  }

  setWorkspaceManager(wm) {
    this.workspaceManager = wm || null;
  }

  workspaceFolders() {
    if (this.workspaceManager?.folders?.length) {
      return this.workspaceManager.folders;
    }
    if (!this.rootPath) return [];
    return [{ name: path.basename(this.rootPath), path: this.rootPath }];
  }

  async semanticSearch(query, topK = 8) {
    if (this.lanceIndex) {
      try {
        return await this.lanceIndex.search(query, topK);
      } catch {
        /* fallback to JSON vector */
      }
    }
    if (!this.vectorIndex) return [];
    try {
      return await this.vectorIndex.search(query, topK);
    } catch {
      return [];
    }
  }

  ftsSearch(query, topK = 10) {
    if (!this.ftsIndex) return [];
    try {
      return this.ftsIndex.search(query, topK);
    } catch {
      return [];
    }
  }

  async hybridSearch(query, topK = 8) {
    const fts = this.ftsSearch(query, topK);
    const vector = await this.semanticSearch(query, topK);
    const merged = new Map();
    for (const h of fts) {
      merged.set(h.path, { path: h.path, text: h.text, ftsScore: h.score, vectorScore: 0 });
    }
    for (const h of vector) {
      const prev = merged.get(h.path) || { path: h.path, text: h.text, ftsScore: 0, vectorScore: 0 };
      prev.vectorScore = h.score;
      prev.text = prev.text || h.text;
      merged.set(h.path, prev);
    }
    const ranked = Array.from(merged.values())
      .map((r) => ({ ...r, score: r.ftsScore * 0.45 + r.vectorScore * 0.55 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return { fts, vector, merged: ranked };
  }

  async scan() {
    const folders = this.workspaceFolders();
    const multi = folders.length > 1;
    console.log(`[Indexer] Scanning workspace (${folders.length} folder${folders.length === 1 ? '' : 's'})...`);
    this.index.clear();
    this.reverseIndex.clear();
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const prefix = multi && i > 0 ? `${folder.name}:` : '';
      console.log(`[Indexer]  → ${folder.name}`);
      await this.walk(folder.path, folder.path, prefix);
    }
    this.recomputePageRank();
    if (this.ftsIndex) {
      this.ftsIndex.rebuildFromIndexer(this);
      await this.ftsIndex.save().catch(() => {});
    }
  }

  updateProjectRoot(newPath) {
    this.rootPath = newPath;
    this.index.clear();
    console.log(`[Indexer] Project root updated to ${newPath}`);
  }

  async walk(dir, rootAbs, folderPrefix = '') {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const relToRoot = path.relative(rootAbs, fullPath).replace(/\\/g, '/');
      const relativePath = folderPrefix ? `${folderPrefix}${relToRoot}` : relToRoot;

      if (relToRoot.startsWith('.fa7/') && !relToRoot.startsWith('.fa7/extensions')) continue;
      if (file.startsWith('.') && relToRoot !== '.fa7' && !relToRoot.startsWith('.fa7/extensions')) continue;
      if (SKIPPED_DIR_NAMES.has(file) || file === '.DS_Store') continue;

      if (relativePath.startsWith('.fa7/extensions') || relToRoot.startsWith('.fa7/extensions')) {
          const isMetadata = file.toLowerCase().includes('readme') || file === 'package.json' || file.endsWith('.json');
          if (!isMetadata) continue;
      }
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
          await this.walk(fullPath, rootAbs, folderPrefix);
      } else if (this.isSupported(file)) {
          if (stat.size > MAX_INDEX_FILE_BYTES) continue;
          await this.indexFile(fullPath, relativePath);
      }
    }
  }

  isSupported(file) {
    const ext = path.extname(file);
    return ['.js', '.ts', '.tsx', '.py', '.css', '.html', '.md'].includes(ext);
  }

  async indexFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const rel = relativePath || path.relative(this.rootPath, filePath).replace(/\\/g, '/');
      
      const symbols = [];
      const dependencies = [];
      const lines = content.split('\n');
      
      const astSymbols = extractSymbols(content, rel);
      if (astSymbols.length > 0) {
        astSymbols.forEach((s) => {
          symbols.push({ line: s.line, content: `${s.kind} ${s.name}` });
        });
      }

      // Optional tree-sitter tags for higher-fidelity symbols (JS/TS/TSX).
      try {
        const tsTags = extractTreeSitterTags(content, rel, 60);
        for (const tag of tsTags) {
          symbols.push({ line: tag.line, content: `${tag.kind} ${tag.name}` });
        }
      } catch { /* optional */ }

      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Improved Symbol Extraction (Classes, Interfaces, Types, Functions, Consts, Exports, Decorators)
        if (/^(export\s+)?(class|interface|type|enum|function|async\s+function|const|let|var|def|class)\s+([a-zA-Z0-9_$]+)/.test(trimmed)) {
          symbols.push({ line: i + 1, content: trimmed });
        } else if (trimmed.startsWith('@')) { // Decorators
          symbols.push({ line: i + 1, content: trimmed });
        }
        
        // Robust Dependency Extraction
        const importMatch = line.match(/(import|require|from)\s+['"](.*?)['"]/);
        if (importMatch && importMatch[2]) {
            let depPath = importMatch[2];
            if (depPath.startsWith('.')) {
                depPath = path.join(path.dirname(rel), depPath);
                if (!path.extname(depPath)) depPath += '.ts'; 
            }
            dependencies.push(depPath);
        }
      });

      this.index.set(rel, {
        path: rel,
        folder: rel.includes(':') ? rel.split(':')[0] : null,
        symbols: symbols.slice(0, 50),
        dependencies,
        summary: content.substring(0, 500)
      });

      // Update Reverse Index
      dependencies.forEach(dep => {
        const list = this.reverseIndex.get(dep) || [];
        if (!list.includes(rel)) {
          list.push(rel);
          this.reverseIndex.set(dep, list);
        }
      });
    } catch (err) {
      console.error(`[Indexer] Failed to index ${filePath}`, err);
    }
  }

  getRelevantContext(query, activeFile) {
    let context = "Relevant Project Context:\n";
    const q = String(query || '').trim();
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0 && q) terms.push(q.toLowerCase());

    let activeKey = activeFile ? String(activeFile).replace(/^\.\//, '') : '';
    if (activeKey && !this.index.has(activeKey)) {
      const norm = path.normalize(activeKey).replace(/\\/g, '/');
      const hit = Array.from(this.index.keys()).find(
        (k) => k === norm || k === activeKey || k.endsWith(activeKey) || norm.endsWith(k)
      );
      if (hit) activeKey = hit;
      else activeKey = '';
    }

    let foundCount = 0;

    // 1. Prioritize files that the active file depends on
    const activeData = activeKey ? this.index.get(activeKey) : null;

    if (activeData && activeData.dependencies) {
      activeData.dependencies.forEach((dep) => {
        const match = Array.from(this.index.keys()).find((k) => k.includes(dep) || dep.includes(k));
        if (match && foundCount < 2) {
          const data = this.index.get(match);
          context += `\n--- Dependency: ${match} ---\n${data.summary}...\n`;
          foundCount++;
        }
      });
    }

    // 1b. If we have an active indexed file, always include a snippet (so queries like "see the app?" still get context)
    if (activeData && activeKey && foundCount < 4) {
      context += `\n--- Active file: ${activeKey} ---\n${activeData.summary}...\n`;
      foundCount++;
    }

    // 2. Search for relevant files based on query terms
    for (const [relPath, data] of this.index.entries()) {
      if (relPath === activeKey || context.includes(relPath)) continue;

      const isMatch = terms.some(
        (term) =>
          term.length > 0 &&
          (relPath.toLowerCase().includes(term) || data.summary.toLowerCase().includes(term))
      );

      if (isMatch && foundCount < 6) {
        const usedBy = this.reverseIndex.get(relPath) || [];
        const usedByStr = usedBy.length > 0 ? `\nUsed by: ${usedBy.slice(0, 5).join(', ')}` : '';
        context += `\n--- Related: ${relPath} ---${usedByStr}\n${data.summary}...\n`;
        foundCount++;
      }
    }

    if (foundCount > 0) return context;

    // 3. Fallback: expose indexed file list so the model knows the repo is not empty
    const keys = Array.from(this.index.keys()).sort();
    if (keys.length > 0) {
      const preview = keys.slice(0, 80).join('\n');
      return `${context}\n## Indexed project files (names only; ${keys.length} total)\n${preview}\n\n(Full contents: use <!--FA7_DEV_READ:relative/path--> in the assistant reply.)`;
    }

    try {
      const top = fs
        .readdirSync(this.rootPath)
        .filter((f) => !f.startsWith('.') && !['node_modules', 'dist', 'venv', '__pycache__'].includes(f))
        .slice(0, 40);
      if (top.length > 0) {
        return `${context}\n## Project root listing (${this.rootPath})\n${top.join('\n')}\n(Indexer may still be scanning supported extensions: .js .ts .tsx .py .css .html .md)`;
      }
    } catch {
      /* ignore */
    }

    return `${context}\n(No indexed files yet — workspace root is still in the system prompt; suggest FA7_DEV_READ after scan completes.)`;
  }

  /** Fuzzy file search for @mention UI */
  search(query, limit = 20) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) {
      return Array.from(this.index.keys()).sort().slice(0, limit);
    }
    const scored = [];
    for (const relPath of this.index.keys()) {
      const lower = relPath.toLowerCase();
      let score = 0;
      if (lower === q) score = 100;
      else if (lower.endsWith(q)) score = 80;
      else if (lower.includes(q)) score = 50;
      const base = path.basename(lower);
      if (base.includes(q)) score += 20;
      if (score > 0) scored.push({ path: relPath, score });
    }
    return scored
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, limit)
      .map((s) => s.path);
  }

  /**
   * RepoMap-style ranked summary (inspired by Aider) — fits key files/symbols in token budget.
   */
  getRepoMap(query, options = {}) {
    const maxChars = options.maxChars || 12000;
    const q = String(query || '').toLowerCase();
    const terms = q.split(/\s+/).filter((t) => t.length > 1);

    const ranked = [];
    for (const [relPath, data] of this.index.entries()) {
      let score = 0;
      const lower = relPath.toLowerCase();
      for (const term of terms) {
        if (lower.includes(term)) score += 3;
        if (data.summary.toLowerCase().includes(term)) score += 2;
        for (const s of data.symbols || []) {
          if (String(s.content).toLowerCase().includes(term)) score += 1;
        }
      }
      const usedBy = (this.reverseIndex.get(relPath) || []).length;
      score += Math.min(usedBy, 5);
      score += Math.min((data.symbols || []).length, 10) * 0.1;
      const pr = this.pageRankScores.get(relPath) || 0;
      score += pr * 50;
      if (this.recentEdits.includes(relPath)) score += 8;
      ranked.push({ relPath, data, score });
    }

    ranked.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));

    let out = '## Repository Map\n';
    let used = out.length;
    const lines = [];

    for (const { relPath, data, score } of ranked) {
      if (score <= 0 && terms.length > 0) continue;
      const symPreview = (data.symbols || [])
        .slice(0, 6)
        .map((s) => s.content)
        .join('; ');
      const block = `### ${relPath}\n${symPreview ? `Symbols: ${symPreview}\n` : ''}${data.summary.slice(0, 400)}...\n`;
      if (used + block.length > maxChars) break;
      lines.push(block);
      used += block.length;
    }

    if (lines.length === 0) {
      const keys = Array.from(this.index.keys()).sort().slice(0, 60);
      return `${out}\n${keys.join('\n')}`;
    }
    return out + lines.join('\n');
  }

  /** Returns a compressed tree of the project for Big-Picture planning. */
  getProjectMap() {
      const tree = {};
      for (const [relPath, data] of this.index.entries()) {
          const parts = relPath.split(path.sep);
          let current = tree;
          parts.forEach((part, i) => {
              if (i === parts.length - 1) {
                  current[part] = {
                      type: 'file',
                      symbols: data.symbols.slice(0, 5).map(s => s.content)
                  };
              } else {
                  if (!current[part]) current[part] = {};
                  current = current[part];
              }
          });
      }
      return JSON.stringify(tree, null, 2);
  }
}

module.exports = Indexer;
