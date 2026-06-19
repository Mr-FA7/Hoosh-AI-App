/** Apply VS Code extension theme JSON to Monaco + Hoosh shell CSS. */
export function applyExtensionTheme(
  themeData: { tokenColors?: any[]; colors?: Record<string, string> },
  uiTheme: string,
  onThemeApplied?: (monacoThemeId: string) => void
): void {
  const monacoThemeId = 'custom-ext-theme';
  const monaco = (window as any).monaco;
  if (monaco) {
    monaco.editor.defineTheme(monacoThemeId, {
      base: uiTheme === 'vs-dark' || uiTheme === 'hc-black' ? 'vs-dark' : 'vs',
      inherit: true,
      rules: themeData.tokenColors
        ? themeData.tokenColors.map((tc: any) => ({
            token: tc.scope ? (Array.isArray(tc.scope) ? tc.scope[0] : tc.scope) : '',
            foreground: tc.settings?.foreground,
            fontStyle: tc.settings?.fontStyle
          }))
        : [],
      colors: themeData.colors || {}
    });
    monaco.editor.setTheme(monacoThemeId);
  }

  if (themeData.colors) {
    const colors = themeData.colors;
    let styleTag = document.getElementById('fa7-dynamic-theme');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'fa7-dynamic-theme';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      :root {
        ${colors['editor.background'] ? `--bg-main-override: ${colors['editor.background']};` : ''}
        ${colors['sideBar.background'] ? `--bg-sidebar-override: ${colors['sideBar.background']};` : ''}
        ${colors['activityBar.background'] ? `--bg-panel-override: ${colors['activityBar.background']};` : ''}
        ${colors['button.background'] ? `--accent-override: ${colors['button.background']};` : ''}
        ${colors['editor.foreground'] ? `--text-primary-override: ${colors['editor.foreground']};` : ''}
        ${colors['editorGroup.border'] ? `--border-override: ${colors['editorGroup.border']};` : ''}
      }
      body, .workspace-container, .editor-section { background-color: var(--bg-main-override, hsl(var(--bg-main))) !important; }
      .sidebar, .file-explorer { background-color: var(--bg-sidebar-override, hsl(var(--bg-sidebar))) !important; }
      .ai-panel { background-color: var(--bg-panel-override, hsl(var(--bg-panel))) !important; }
      .btn-primary, [style*="background: hsl(var(--accent))"] { background-color: var(--accent-override, hsl(var(--accent))) !important; }
      body { color: var(--text-primary-override, hsl(var(--text-primary))) !important; }
    `;
  }

  localStorage.setItem('fa7_editor_theme', monacoThemeId);
  onThemeApplied?.(monacoThemeId);
}

export const BUILTIN_THEMES = [
  { id: 'vs-dark', label: 'VS Dark' },
  { id: 'vs', label: 'VS Light' },
  { id: 'hc-black', label: 'High Contrast' },
  { id: 'custom-ext-theme', label: 'Extension Theme' }
];
