/**
 * Tree-sitter tag extraction for RepoMap (Aider-inspired).
 * Optional: if tree-sitter packages fail to load, returns [].
 */
const path = require('path');

function safeRequire(id) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(id);
  } catch {
    return null;
  }
}

function getParserForFile(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  const Parser = safeRequire('tree-sitter');
  if (!Parser) return null;
  const parser = new Parser();

  if (ext === '.js' || ext === '.jsx') {
    const Lang = safeRequire('tree-sitter-javascript');
    if (!Lang) return null;
    parser.setLanguage(Lang);
    return { parser, kind: 'javascript' };
  }
  if (ext === '.ts' || ext === '.tsx') {
    const ts = safeRequire('tree-sitter-typescript');
    if (!ts) return null;
    const Lang = ext === '.tsx' ? ts.tsx : ts.typescript;
    if (!Lang) return null;
    parser.setLanguage(Lang);
    return { parser, kind: ext === '.tsx' ? 'tsx' : 'typescript' };
  }
  return null;
}

function nodeText(source, node) {
  return source.slice(node.startIndex, node.endIndex);
}

function extractTreeSitterTags(source, filePath, max = 80) {
  const entry = getParserForFile(filePath);
  if (!entry) return [];
  const { parser } = entry;
  const tree = parser.parse(String(source || ''));
  const out = [];

  const visit = (node) => {
    if (!node || out.length >= max) return;
    const type = node.type;
    if (type === 'function_declaration' || type === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        out.push({
          kind: 'function',
          name: nodeText(source, nameNode),
          line: node.startPosition.row + 1
        });
      }
    }
    if (type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        out.push({
          kind: 'class',
          name: nodeText(source, nameNode),
          line: node.startPosition.row + 1
        });
      }
    }
    if (type === 'interface_declaration' || type === 'type_alias_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        out.push({
          kind: type === 'interface_declaration' ? 'interface' : 'type',
          name: nodeText(source, nameNode),
          line: node.startPosition.row + 1
        });
      }
    }
    for (const child of node.namedChildren || []) visit(child);
  };

  visit(tree.rootNode);
  return out;
}

module.exports = { extractTreeSitterTags };

