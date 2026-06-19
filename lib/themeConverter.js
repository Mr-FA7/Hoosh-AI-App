/**
 * Convert VS Code theme JSON → Monaco editor theme rules.
 * Inspired by monaco-vscode-textmate-theme-converter (simplified).
 */

function vscodeTokenToMonacoRule(token, settings = {}) {
  const rule = { token: token || '' };
  if (settings.foreground) rule.foreground = settings.foreground.replace(/^#/, '');
  if (settings.background) rule.background = settings.background.replace(/^#/, '');
  const font = [];
  if (settings.fontStyle) {
    const parts = String(settings.fontStyle).toLowerCase().split(/\s+/);
    if (parts.includes('bold')) font.push('bold');
    if (parts.includes('italic')) font.push('italic');
    if (parts.includes('underline')) font.push('underline');
  }
  if (font.length) rule.fontStyle = font.join(' ');
  return rule;
}

function convertVscodeTheme(themeJson, themeId = 'hoosh-converted') {
  const base = themeJson?.colors || {};
  const uiTheme = themeJson?.type === 'light' ? 'vs' : 'vs-dark';
  const rules = [];

  for (const entry of themeJson?.tokenColors || []) {
    if (entry.scope && entry.settings) {
      const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
      for (const scope of scopes) {
        rules.push(vscodeTokenToMonacoRule(scope, entry.settings));
      }
    }
  }

  return {
    base: uiTheme,
    inherit: true,
    rules,
    colors: {
      'editor.background': base['editor.background'] || '#1e1e1e',
      'editor.foreground': base['editor.foreground'] || '#d4d4d4',
      'editorLineNumber.foreground': base['editorLineNumber.foreground'] || '#858585',
      'editor.selectionBackground': base['editor.selectionBackground'] || '#264f78'
    },
    hooshThemeId: themeId
  };
}

module.exports = { convertVscodeTheme, vscodeTokenToMonacoRule };
