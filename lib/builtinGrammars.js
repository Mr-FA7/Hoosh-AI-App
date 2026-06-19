/**
 * Built-in TextMate grammars (Monaco out-of-box, inspired by VS Code defaults).
 */
const fs = require('fs-extra');
const path = require('path');

const GRAMMAR_DIR = path.join(__dirname, 'grammars');

const BUILTIN = [
  { language: 'javascript', scopeName: 'source.js', file: 'javascript.tmLanguage.json' },
  { language: 'typescript', scopeName: 'source.ts', file: 'typescript.tmLanguage.json' },
  { language: 'python', scopeName: 'source.python', file: 'python.tmLanguage.json' },
  { language: 'json', scopeName: 'source.json', file: 'json.tmLanguage.json' },
  { language: 'markdown', scopeName: 'text.html.markdown', file: 'markdown.tmLanguage.json' },
  { language: 'css', scopeName: 'source.css', file: 'css.tmLanguage.json' },
  { language: 'html', scopeName: 'text.html.basic', file: 'html.tmLanguage.json' }
];

function listBuiltinGrammars() {
  return BUILTIN.map((g) => {
    const grammarPath = path.join(GRAMMAR_DIR, g.file);
    return {
      extension: 'hoosh-builtin',
      language: g.language,
      scopeName: g.scopeName,
      path: g.file,
      grammarPath: fs.pathExistsSync(grammarPath) ? grammarPath : null
    };
  }).filter((g) => g.grammarPath);
}

async function getBuiltinGrammar(language) {
  const meta = BUILTIN.find((g) => g.language === language);
  if (!meta) return null;
  const grammarPath = path.join(GRAMMAR_DIR, meta.file);
  if (!(await fs.pathExists(grammarPath))) return null;
  const content = await fs.readFile(grammarPath, 'utf8');
  return {
    language: meta.language,
    scopeName: meta.scopeName,
    content,
    format: 'json',
    extension: 'hoosh-builtin'
  };
}

async function mergeGrammars(extensionGrammars = []) {
  const byLang = new Map();
  for (const g of listBuiltinGrammars()) {
    byLang.set(g.language, g);
  }
  for (const g of extensionGrammars) {
    if (g.grammarPath) byLang.set(g.language, g);
  }
  return [...byLang.values()];
}

module.exports = { listBuiltinGrammars, getBuiltinGrammar, mergeGrammars, BUILTIN };
