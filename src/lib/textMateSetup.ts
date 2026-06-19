/**
 * Wire Open VSX TextMate grammars into Monaco via monaco-textmate + onigasm.
 */
import { API_BASE } from '../apiBase';

const wiredEditors = new WeakSet<object>();
let registryReady: Promise<{
  registry: import('monaco-textmate').Registry;
  scopeByLang: Map<string, string>;
}> | null = null;

async function getRegistry() {
  if (!registryReady) {
    registryReady = (async () => {
      const [{ Registry }, { loadWASM }] = await Promise.all([
        import('monaco-textmate'),
        import('onigasm')
      ]);
      const wasmUrl = new URL('onigasm/lib/onigasm.wasm', import.meta.url).href;
      await loadWASM(wasmUrl);

      const gramRes = await fetch(`${API_BASE}/v3/extensions/grammars`);
      const gramData = await gramRes.json();
      const grammars: Array<{ language: string; scopeName: string; grammarPath?: string | null }> =
        gramData.grammars || [];

      const scopeByLang = new Map<string, string>();
      const grammarCache = new Map<string, { format: 'json' | 'plist'; content: string }>();

      for (const g of grammars) {
        if (!g.language || !g.scopeName || !g.grammarPath) continue;
        scopeByLang.set(g.language, g.scopeName);
      }

      const registry = new Registry({
        getGrammarDefinition: async (scopeName) => {
          const g = grammars.find((x) => x.scopeName === scopeName);
          if (!g?.language) throw new Error(`Grammar not found: ${scopeName}`);
          if (!grammarCache.has(g.language)) {
            const r = await fetch(`${API_BASE}/v3/extensions/grammar/${encodeURIComponent(g.language)}`);
            if (!r.ok) throw new Error(`Failed to load grammar ${g.language}`);
            const data = await r.json();
            const content = String(data.content || '');
            grammarCache.set(g.language, {
              format: content.trim().startsWith('{') ? 'json' : 'plist',
              content
            });
          }
          return grammarCache.get(g.language)!;
        }
      });

      return { registry, scopeByLang };
    })();
  }
  return registryReady;
}

export async function wireEditorTextMate(monaco: any, editor: any): Promise<void> {
  if (wiredEditors.has(editor)) return;
  try {
    const { registry, scopeByLang } = await getRegistry();
    if (scopeByLang.size === 0) return;

    const { wireTmGrammars } = await import('monaco-editor-textmate');
    const grammars = new Map(scopeByLang);
    await wireTmGrammars(monaco, registry, grammars, editor);
    wiredEditors.add(editor);
  } catch (e) {
    console.warn('[Hoosh] TextMate wire skipped:', e);
  }
}

export async function registerExtensionLanguages(monaco: any): Promise<void> {
  try {
    const gramRes = await fetch(`${API_BASE}/v3/extensions/grammars`);
    const gramData = await gramRes.json();
    for (const g of gramData.grammars || []) {
      if (!g.language) continue;
      try {
        monaco.languages.register({ id: g.language });
      } catch { /* already */ }
    }
  } catch { /* optional */ }
}
