const fs = require('fs-extra');
const path = require('path');

class Indexer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.index = new Map();
    this.reverseIndex = new Map(); // Reverse Mapping: dependency -> [files that use it]
  }

  async scan() {
    console.log(`[Indexer] Scanning ${this.rootPath}...`);
    this.index.clear();
    await this.walk(this.rootPath);
  }

  updateProjectRoot(newPath) {
    this.rootPath = newPath;
    this.index.clear();
    console.log(`[Indexer] Project root updated to ${newPath}`);
  }

  async walk(dir) {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const relativePath = path.relative(this.rootPath, fullPath);

      if (file.startsWith('.') && !relativePath.startsWith('.fa7/extensions')) continue;
      if (['node_modules', 'git', 'dist', 'models', 'assets', 'venv', '__pycache__', '.DS_Store'].some(d => file.includes(d))) continue;
      
      // Special handling for extensions: only index metadata
      if (relativePath.startsWith('.fa7/extensions')) {
          const isMetadata = file.toLowerCase().includes('readme') || file === 'package.json' || file.endsWith('.json');
          if (!isMetadata) continue;
      }
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
          await this.walk(fullPath);
      } else if (this.isSupported(file)) {
          await this.indexFile(fullPath);
      }
    }
  }

  isSupported(file) {
    const ext = path.extname(file);
    return ['.js', '.ts', '.tsx', '.py', '.css', '.html', '.md'].includes(ext);
  }

  async indexFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(this.rootPath, filePath);
      
      const symbols = [];
      const dependencies = [];
      const lines = content.split('\n');
      
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
                depPath = path.join(path.dirname(relativePath), depPath);
                if (!path.extname(depPath)) depPath += '.ts'; 
            }
            dependencies.push(depPath);
        }
      });

      this.index.set(relativePath, {
        path: relativePath,
        symbols: symbols.slice(0, 50),
        dependencies,
        summary: content.substring(0, 500)
      });

      // Update Reverse Index
      dependencies.forEach(dep => {
        const list = this.reverseIndex.get(dep) || [];
        if (!list.includes(relativePath)) {
          list.push(relativePath);
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
