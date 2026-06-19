/**
 * Lightweight AST symbol extraction (JS/TS via acorn).
 */
let acorn;
try {
  acorn = require('acorn');
} catch {
  acorn = null;
}

function extractJsSymbols(content, filePath) {
  if (!acorn) return [];
  const symbols = [];
  try {
    const isTs = /\.tsx?$/.test(filePath);
    const parser = acorn.Parser.extend(
      isTs ? () => ({}) : () => ({})
    );
    const ast = parser.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    });

    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        symbols.push({ line: node.loc?.start?.line || 0, kind: 'function', name: node.id.name });
      }
      if (node.type === 'ClassDeclaration' && node.id?.name) {
        symbols.push({ line: node.loc?.start?.line || 0, kind: 'class', name: node.id.name });
      }
      if (node.type === 'VariableDeclarator' && node.id?.name) {
        symbols.push({ line: node.loc?.start?.line || 0, kind: 'const', name: node.id.name });
      }
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        walk(node.declaration);
      }
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(walk);
        else if (child && typeof child === 'object' && child.type) walk(child);
      }
    };
    walk(ast);
  } catch {
    /* parse error — fallback to regex in indexer */
  }
  return symbols.slice(0, 80);
}

function extractPySymbols(content) {
  const symbols = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^(async\s+)?def\s+(\w+)|^class\s+(\w+)/);
    if (m) symbols.push({ line: i + 1, kind: m[2] ? 'function' : 'class', name: m[2] || m[3] });
  });
  return symbols.slice(0, 80);
}

function extractSymbols(content, filePath) {
  const ext = (filePath || '').split('.').pop()?.toLowerCase();
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return extractJsSymbols(content, filePath);
  if (['ts', 'tsx'].includes(ext)) {
    const stripped = content
      .replace(/:\s*[\w<>\[\]|&{},\s.?]+(?=[,;=)\]])/g, '')
      .replace(/\b(interface|type)\s+\w+[^{]*\{[^}]*\}/g, '');
    return extractJsSymbols(stripped, filePath);
  }
  if (ext === 'py') return extractPySymbols(content);
  return [];
}

module.exports = { extractSymbols, extractJsSymbols, extractPySymbols };
