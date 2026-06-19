import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import {
  Save,
  Wand2,
  ShieldAlert,
  BookOpen,
  FileCode,
  X,
  Plus,
  FilePlus,
  Upload,
  FolderOpen,
  Globe,
  Download,
  Terminal,
  Target,
  LayoutGrid,
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../apiBase';
import type { WorkspaceTab } from '../types/workspaceTab';
import { tabDisplayName } from '../types/workspaceTab';
import { useI18n } from '../i18n/LocaleContext';
import BrowserView from './BrowserView';
import TerminalView from './TerminalView';
import DownloadManagerView from './DownloadManagerView';
import InlineChat from './InlineChat';
import DiffZoneOverlay, { type DiffZoneProposal } from './DiffZoneOverlay';
import { wireEditorTextMate, registerExtensionLanguages } from '../lib/textMateSetup';
import { publishProblems } from '../lib/problemsContextSync';

interface EditorProps {
  content: string;
  fileName: string;
  onSave: (content: string) => void;
  isSaving: boolean;
  theme?: string;
  workspaceTabs: WorkspaceTab[];
  activeTabIndex: number;
  onWorkspaceTabSelect?: (index: number) => void;
  onWorkspaceTabClose?: (index: number) => void;
  /** Open a project-relative file in the editor (e.g. after create/import). */
  onOpenFile?: (path: string) => void | Promise<void>;
  /** Refresh explorer after files on disk change. */
  onFilesChanged?: () => void;
  /** Opens the "New file / import" panel as a tab (+ button). */
  onOpenQuickStartTab?: () => void;
  /** Open tool tabs in the editor strip (same as AI-docked tabs). */
  onOpenBrowserWorkspace?: () => void;
  onOpenDownloadWorkspace?: () => void;
  onOpenTerminalWorkspace?: () => void;
  /** Live mission diff overlay when the active file matches */
  missionDiffZone?: DiffZoneProposal | null;
  onClearMissionDiffZone?: () => void;
}

const Editor: React.FC<EditorProps> = ({ 
  content, fileName, onSave, isSaving, theme = 'vs-dark',
  workspaceTabs = [], activeTabIndex = -1, onWorkspaceTabSelect, onWorkspaceTabClose,
  onOpenFile, onFilesChanged, onOpenQuickStartTab,
  onOpenBrowserWorkspace, onOpenDownloadWorkspace, onOpenTerminalWorkspace,
  missionDiffZone, onClearMissionDiffZone
}) => {
  const { t } = useI18n();
  const [localContent, setLocalContent] = React.useState(content);
  /** Subfolder inside project (no leading slash); empty = project root */
  const [newFileFolder, setNewFileFolder] = React.useState('');
  const [newFileName, setNewFileName] = React.useState('notes.txt');
  const [importBusy, setImportBusy] = React.useState(false);
  const [createBusy, setCreateBusy] = React.useState(false);
  const [folderBrowseBusy, setFolderBrowseBusy] = React.useState(false);
  const [pickedSource, setPickedSource] = React.useState<string | null>(null);
  const [importDestRel, setImportDestRel] = React.useState('');
  const [inlineOpen, setInlineOpen] = React.useState(false);
  const [inlineSelection, setInlineSelection] = React.useState('');
  const [diffZone, setDiffZone] = React.useState<DiffZoneProposal | null>(null);
  const [lintNotice, setLintNotice] = React.useState<string | null>(null);
  const editorRef = React.useRef<any>(null);
  const nesTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nesDecorationsRef = React.useRef<string[]>([]);
  const diffDecorationsRef = React.useRef<string[]>([]);

  const buildInlineDiffDecorations = React.useCallback((monaco: any, original: string, proposed: string) => {
    if (!proposed) return [];
    const origLines = original.split('\n');
    const propLines = proposed.split('\n');
    const max = Math.max(origLines.length, propLines.length);
    const decorations: Array<{ range: any; options: Record<string, unknown> }> = [];
    for (let i = 0; i < max; i++) {
      const line = i + 1;
      const o = origLines[i];
      const p = propLines[i];
      if (o === p) continue;
      if (p === undefined && o !== undefined) {
        decorations.push({
          range: new monaco.Range(line, 1, line, Math.max(1, o.length + 1)),
          options: { isWholeLine: true, className: 'hoosh-diff-del-line' }
        });
      } else if (o === undefined && p !== undefined) {
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: 'hoosh-diff-add-line' }
        });
      } else {
        decorations.push({
          range: new monaco.Range(line, 1, line, Math.max(1, (o?.length || 0) + 1)),
          options: { isWholeLine: true, className: 'hoosh-diff-chg-line' }
        });
      }
    }
    return decorations;
  }, []);

  React.useEffect(() => {
    setLocalContent(content);
  }, [content]);

  React.useEffect(() => {
    if (missionDiffZone && missionDiffZone.fileName === fileName) {
      setDiffZone(missionDiffZone);
    }
  }, [missionDiffZone, fileName]);

  React.useEffect(() => {
    let cancelled = false;
    const loadExtensions = async () => {
      try {
        const [langRes, themeRes] = await Promise.all([
          axios.get(`${API_BASE}/v3/extensions/languages`),
          axios.get(`${API_BASE}/v3/extensions/themes`)
        ]);
        if (cancelled) return;
        const monaco = (window as unknown as { monaco?: any }).monaco;
        if (!monaco) return;
        for (const lang of langRes.data?.languages || []) {
          const ext = (lang.extensions || [])[0];
          if (!ext || !lang.id) continue;
          try { monaco.languages.register({ id: lang.id }); } catch { /* already */ }
        }
        for (const t of themeRes.data?.themes || []) {
          const themeId = `ext-${String(t.id || t.label || 'theme').replace(/\s+/g, '-')}`;
          const base = t.uiTheme === 'vs' ? 'vs' : t.uiTheme === 'hc-black' ? 'hc-black' : 'vs-dark';
          try {
            monaco.editor.defineTheme(themeId, {
              base,
              inherit: true,
              rules: [],
              colors: t.theme?.colors || {}
            });
          } catch { /* ignore bad theme */ }
        }
      } catch { /* extensions optional */ }
    };
    void loadExtensions();
    return () => { cancelled = true; };
  }, [fileName]);

  const getLanguage = (file: string) => {
    const ext = file.split('.').pop();
    switch (ext) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'typescript';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'md': return 'markdown';
      case 'json': return 'json';
      case 'rs': return 'rust';
      case 'py': return 'python';
      default: return 'text';
    }
  };

  const activeWorkspaceTab = activeTabIndex >= 0 ? workspaceTabs[activeTabIndex] : undefined;
  const fileTabPath =
    activeWorkspaceTab?.kind === 'file' ? activeWorkspaceTab.path : fileName;

  React.useEffect(() => {
    const editor = editorRef.current;
    const monaco = (window as unknown as { monaco?: any }).monaco;
    if (!editor || !monaco) return;
    if (!diffZone || diffZone.fileName !== fileTabPath) {
      diffDecorationsRef.current = editor.deltaDecorations(diffDecorationsRef.current, []);
      return;
    }
    const decs = buildInlineDiffDecorations(monaco, diffZone.original, diffZone.proposed);
    diffDecorationsRef.current = editor.deltaDecorations(diffDecorationsRef.current, decs);
  }, [diffZone, fileTabPath, buildInlineDiffDecorations]);

  const activeAiStatus =
    activeWorkspaceTab &&
    activeWorkspaceTab.kind !== 'file' &&
    activeWorkspaceTab.kind !== 'home'
      ? activeWorkspaceTab.aiStatus
      : undefined;

  const registerLspCompletion = (monaco: any, languageId: string) => {
    if (languageId !== 'typescript' && languageId !== 'javascript') return;
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', '/', '"', "'", '`'],
      provideCompletionItems: async (model: any, position: any) => {
        try {
          const res = await axios.post(`${API_BASE}/v3/lsp/completion`, {
            filePath: fileTabPath,
            line: position.lineNumber,
            character: position.column - 1,
            content: model.getValue()
          });
          const items = res.data?.items || [];
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          return {
            suggestions: items.map((item: any, idx: number) => ({
              label: item.label,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: item.insertText || item.label,
              detail: item.detail || 'LSP',
              range,
              sortText: `1_${idx}`
            }))
          };
        } catch {
          return { suggestions: [] };
        }
      }
    });
  };

  const registerLspHover = (monaco: any, languageId: string) => {
    monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model: any, position: any) => {
        try {
          const res = await axios.post(`${API_BASE}/v3/lsp/hover`, {
            filePath: fileTabPath,
            line: position.lineNumber,
            character: position.column - 1,
            content: model.getValue()
          });
          const hover = res.data?.hover;
          if (!hover?.contents) return null;
          const contents = Array.isArray(hover.contents)
            ? hover.contents.map((c: any) => ({ value: typeof c === 'string' ? c : c.value || '' }))
            : [{ value: String(hover.contents) }];
          return { range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1), contents };
        } catch {
          return null;
        }
      }
    });
  };

  const registerLspDefinition = (monaco: any, languageId: string) => {
    monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model: any, position: any) => {
        try {
          const res = await axios.post(`${API_BASE}/v3/lsp/definition`, {
            filePath: fileTabPath,
            line: position.lineNumber,
            character: position.column - 1,
            content: model.getValue()
          });
          const def = res.data?.definition;
          if (!def?.uri) return null;
          const targetPath = String(def.uri).replace(/^file:\/\//, '');
          return {
            uri: monaco.Uri.file(targetPath),
            range: new monaco.Range(
              def.range?.start?.line || 1,
              (def.range?.start?.character || 0) + 1,
              def.range?.end?.line || 1,
              (def.range?.end?.character || 0) + 1
            )
          };
        } catch {
          return null;
        }
      }
    });
  };

  const registerInlineNes = (monaco: any, languageId: string) => {
    if (typeof monaco.languages.registerInlineCompletionsProvider !== 'function') return;
    monaco.languages.registerInlineCompletionsProvider(languageId, {
      provideInlineCompletions: async (model: any, position: any) => {
        const offset = model.getOffsetAt(position);
        const fullText = model.getValue();
        const prefix = fullText.slice(Math.max(0, offset - 600), offset);
        const suffix = fullText.slice(offset, offset + 200);
        if (prefix.trim().length < 12) return { items: [] };
        try {
          const res = await axios.post(`${API_BASE}/ai/complete`, {
            prefix, suffix, fileName: fileTabPath, nes: true
          });
          const suggestion = String(res.data?.suggestion || '').trim();
          if (!suggestion) return { items: [] };
          return {
            items: [{
              insertText: suggestion,
              range: new monaco.Range(
                position.lineNumber, position.column,
                position.lineNumber, position.column
              )
            }]
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {}
    });
  };

  const scheduleNextEditSuggestion = (editor: any, monaco: any) => {
    if (nesTimerRef.current) clearTimeout(nesTimerRef.current);
    nesTimerRef.current = setTimeout(async () => {
      const model = editor.getModel();
      const pos = editor.getPosition();
      if (!model || !pos) return;
      const offset = model.getOffsetAt(pos);
      const fullText = model.getValue();
      const prefix = fullText.slice(Math.max(0, offset - 600), offset);
      const suffix = fullText.slice(offset, offset + 200);
      if (prefix.trim().length < 12) return;
      try {
        const res = await axios.post(`${API_BASE}/ai/complete`, {
          prefix,
          suffix,
          fileName: fileTabPath,
          nes: true
        });
        const suggestion = String(res.data?.suggestion || '').trim();
        if (!suggestion) return;
        const line = model.getLineContent(pos.lineNumber);
        const after = { lineNumber: pos.lineNumber, column: line.length + 1 };
        nesDecorationsRef.current = editor.deltaDecorations(nesDecorationsRef.current, [{
          range: new monaco.Range(pos.lineNumber, pos.column, after.lineNumber, after.column),
          options: {
            after: { content: ` ${suggestion}`, inlineClassName: 'hoosh-nes-hint' },
            hoverMessage: { value: t('editor.nextEditSuggestion') }
          }
        }]);
      } catch { /* ignore */ }
    }, 1400);
  };

  const registerAiCompletion = (monaco: any, languageId: string) => {
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', '(', ' ', '\n'],
      provideCompletionItems: async (model: any, position: any) => {
        const offset = model.getOffsetAt(position);
        const fullText = model.getValue();
        const prefix = fullText.slice(Math.max(0, offset - 800), offset);
        const suffix = fullText.slice(offset, offset + 400);
        if (prefix.trim().length < 8) return { suggestions: [] };
        try {
          const res = await axios.post(`${API_BASE}/ai/complete`, {
            prefix,
            suffix,
            fileName: fileTabPath,
            fuse: true
          });
          const suggestion = String(res.data?.suggestion || '').trim();
          const fused = (res.data?.fused as Array<{ label?: string; insertText?: string; detail?: string; sources?: string[] }>) || [];
          const candidates = fused.length > 0
            ? fused.slice(0, 8)
            : (suggestion ? [{ label: 'Hoosh AI', insertText: suggestion, detail: 'AI', sources: ['ai'] }] : []);
          if (candidates.length === 0) return { suggestions: [] };
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          return {
            suggestions: candidates.map((item, idx) => {
              const insertText = String(item.insertText || item.label || '').trim();
              const source = (item.sources || [])[0] || 'ai';
              const kind = source === 'lsp'
                ? monaco.languages.CompletionItemKind.Function
                : source === 'fts'
                  ? monaco.languages.CompletionItemKind.File
                  : monaco.languages.CompletionItemKind.Snippet;
              return {
                label: item.label || insertText.slice(0, 40),
                kind,
                insertText,
                range,
                detail: item.detail || source.toUpperCase(),
                sortText: `0_${idx}`
              };
            })
          };
        } catch {
          return { suggestions: [] };
        }
      }
    });
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    void registerExtensionLanguages(monaco);
    void wireEditorTextMate(monaco, editor);
    for (const lang of ['javascript', 'typescript', 'python', 'rust', 'go']) {
      registerAiCompletion(monaco, lang);
      registerInlineNes(monaco, lang);
      registerLspCompletion(monaco, lang);
      registerLspHover(monaco, lang);
      registerLspDefinition(monaco, lang);
    }

    const pushProblems = () => {
      const model = editor.getModel();
      if (!model) return;
      const uri = model.uri?.toString?.() || fileName;
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const normalized = markers.map((m: any) => ({
        resource: fileName || uri.replace(/^file:\/\//, ''),
        message: m.message,
        severity: m.severity,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn,
        source: m.source || 'monaco'
      }));
      publishProblems(normalized, fileName);
    };

    pushProblems();
    const markerSub = monaco.editor.onDidChangeMarkers((uris: any[]) => {
      const model = editor.getModel();
      if (!model) return;
      if (!uris?.length || uris.some((u: any) => String(u?.toString?.() || u) === String(model.uri?.toString?.() || model.uri))) {
        pushProblems();
      }
    });

    editor.onDidChangeModelContent(() => {
      nesDecorationsRef.current = editor.deltaDecorations(nesDecorationsRef.current, []);
      scheduleNextEditSuggestion(editor, monaco);
    });

    try {
      monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true
      });
      monaco.languages.typescript?.javascriptDefaults?.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        allowJs: true
      });
    } catch { /* monaco TS optional */ }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const sel = editor.getModel()?.getValueInRange(editor.getSelection()) || '';
      setInlineSelection(sel || editor.getModel()?.getLineContent(editor.getPosition()?.lineNumber || 1) || '');
      setInlineOpen(true);
    });

    if (theme === 'custom-ext-theme') {
        monaco.editor.setTheme('custom-ext-theme');
    }

    const gotoHandler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      const line = Number(detail.line || 1);
      const column = Number(detail.column || 1);
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    };
    window.addEventListener('fa7-goto-line', gotoHandler as EventListener);

    editor.onDidDispose(() => {
      markerSub.dispose();
      window.removeEventListener('fa7-goto-line', gotoHandler as EventListener);
    });
  };

  const sanitizeRel = (s: string) => String(s || '').trim().replace(/^\/+/, '');

  const buildNewFileRel = (): string => {
    const folder = sanitizeRel(newFileFolder).replace(/[/\\]+$/, '');
    const name = sanitizeRel(newFileName);
    if (!name) return '';
    if (!folder) return name;
    return `${folder}/${name}`;
  };

  const handleCreateNewFile = async () => {
    const rel = buildNewFileRel();
    if (!rel) {
      window.alert(t('editor.alertFileName'));
      return;
    }
    setCreateBusy(true);
    try {
      await axios.post(`${API_BASE}/file`, { path: rel, content: '' });
      onFilesChanged?.();
      if (onOpenFile) await onOpenFile(rel);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t('editor.alertCreateFailed'));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleBrowseProjectFolder = async () => {
    setFolderBrowseBusy(true);
    try {
      const r = await axios.get(`${API_BASE}/dialog/pick-project-subfolder`);
      if (!r.data?.ok || r.data?.canceled) return;
      const rel = r.data.rel != null ? String(r.data.rel) : '';
      setNewFileFolder(rel.replace(/[/\\]+$/, ''));
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || t('editor.alertPickFolder');
      window.alert(msg);
    } finally {
      setFolderBrowseBusy(false);
    }
  };

  const handlePickFileToImport = async () => {
    setImportBusy(true);
    setPickedSource(null);
    try {
      const r = await axios.get(`${API_BASE}/dialog/open-file`);
      if (!r.data?.ok || r.data?.canceled || !r.data?.path) return;
      const src = String(r.data.path);
      setPickedSource(src);
      const base = src.split(/[/\\]/).pop() || 'imported.txt';
      setImportDestRel(`imports/${base}`);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t('editor.alertPickFile'));
    } finally {
      setImportBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pickedSource) return;
    const dest = sanitizeRel(importDestRel);
    if (!dest) {
      window.alert(t('editor.alertImportDest'));
      return;
    }
    setImportBusy(true);
    try {
      const r = await axios.post(`${API_BASE}/v3/files/import-from-path`, {
        sourcePath: pickedSource,
        destRelative: dest
      });
      if (!r.data?.ok) throw new Error(r.data?.error || t('editor.alertImportFailed'));
      const rel = String(r.data.path || dest);
      setPickedSource(null);
      setImportDestRel('');
      onFilesChanged?.();
      if (onOpenFile) await onOpenFile(rel);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t('editor.alertImportFailed'));
    } finally {
      setImportBusy(false);
    }
  };

  const quickStartPanel = (
    <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '24px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <FileCode
              size={40}
              style={{ opacity: 0.12, marginBottom: '12px', flexShrink: 0, display: 'block' }}
              aria-hidden
            />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'hsl(var(--text-primary))', width: '100%' }}>
              {t('editor.noFileOpen')}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'hsl(var(--text-secondary))',
                opacity: 0.85,
                maxWidth: '360px',
              }}
            >
              {t('editor.noFileHint')}
            </p>
          </div>

          <div
            style={{
              border: '1px solid hsl(var(--border) / 0.45)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '12px',
              background: 'hsl(var(--bg-sidebar) / 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
              <FilePlus size={16} color="hsl(var(--accent))" />
              {t('editor.newFileTitle')}
            </div>
            <label style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '6px' }}>
              {t('editor.folderOptional')}
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => void handleBrowseProjectFolder()}
                disabled={createBusy || folderBrowseBusy}
                title={t('editor.folderOptional')}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--accent) / 0.45)',
                  background: 'hsl(var(--accent) / 0.12)',
                  color: 'hsl(var(--accent))',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: createBusy || folderBrowseBusy ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FolderOpen size={14} />
                {folderBrowseBusy ? '…' : t('editor.browse')}
              </button>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  background: 'hsl(var(--bg-main))',
                  fontSize: '11px',
                  color: newFileFolder ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                  wordBreak: 'break-all',
                  lineHeight: 1.35,
                }}
              >
                {newFileFolder ? newFileFolder : t('editor.projectRoot')}
              </div>
            </div>
            <div style={{ minHeight: 18, marginBottom: 8 }}>
              {newFileFolder ? (
                <button
                  type="button"
                  onClick={() => setNewFileFolder('')}
                  disabled={createBusy || folderBrowseBusy}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {t('editor.useRootInstead')}
                </button>
              ) : null}
            </div>
            <label style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '4px' }}>
              {t('editor.fileName')}
            </label>
            <input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. App.tsx"
              disabled={createBusy}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid hsl(var(--border) / 0.5)',
                background: 'hsl(var(--bg-main))',
                color: 'hsl(var(--text-primary))',
                fontSize: '12px',
                marginBottom: '8px',
              }}
            />
            <p style={{ margin: '0 0 10px', fontSize: '10px', lineHeight: 1.4, color: 'hsl(var(--text-secondary))', opacity: 0.9 }}>
              {t('editor.savesAs')}{' '}
              <code style={{ fontSize: '10px', color: 'hsl(var(--accent))', wordBreak: 'break-all' }}>
                {buildNewFileRel() || '…'}
              </code>
              <span style={{ display: 'block', marginTop: '4px', opacity: 0.75 }}>
                {t('editor.newFileHelp')}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void handleCreateNewFile()}
              disabled={createBusy}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'hsl(var(--accent))',
                color: '#0a0a0a',
                fontSize: '12px',
                fontWeight: 600,
                cursor: createBusy ? 'wait' : 'pointer',
                opacity: createBusy ? 0.7 : 1,
              }}
            >
              {createBusy ? t('editor.creating') : t('editor.createOpen')}
            </button>
          </div>

          <div
            style={{
              border: '1px solid hsl(var(--border) / 0.45)',
              borderRadius: '10px',
              padding: '14px',
              background: 'hsl(var(--bg-sidebar) / 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
              <Upload size={16} color="hsl(var(--accent))" />
              {t('editor.importTitle')}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '11px', lineHeight: 1.45, color: 'hsl(var(--text-secondary))' }}>
              {t('editor.importHint')}
            </p>
            {!pickedSource ? (
              <button
                type="button"
                onClick={() => void handlePickFileToImport()}
                disabled={importBusy}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--accent) / 0.4)',
                  background: 'hsl(var(--accent) / 0.12)',
                  color: 'hsl(var(--accent))',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: importBusy ? 'wait' : 'pointer',
                }}
              >
                {importBusy ? t('editor.openingPicker') : t('editor.chooseFile')}
              </button>
            ) : (
              <>
                <p style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', margin: '0 0 6px', wordBreak: 'break-all' }}>
                  {t('editor.from')} {pickedSource}
                </p>
                <label style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '4px' }}>
                  {t('editor.saveAsRel')}
                </label>
                <input
                  value={importDestRel}
                  onChange={(e) => setImportDestRel(e.target.value)}
                  placeholder="imports/myfile.txt"
                  disabled={importBusy}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    background: 'hsl(var(--bg-main))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedSource(null);
                      setImportDestRel('');
                    }}
                    disabled={importBusy}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid hsl(var(--border) / 0.5)',
                      background: 'transparent',
                      color: 'hsl(var(--text-secondary))',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('explorer.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmImport()}
                    disabled={importBusy}
                    style={{
                      flex: 2,
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'hsl(var(--accent))',
                      color: '#0a0a0a',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: importBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {importBusy ? t('editor.copying') : t('editor.copyOpen')}
                  </button>
                </div>
              </>
            )}
          </div>

          {(onOpenBrowserWorkspace ||
            onOpenDownloadWorkspace ||
            onOpenTerminalWorkspace) && (
            <div
              style={{
                border: '1px solid hsl(var(--border) / 0.45)',
                borderRadius: '10px',
                padding: '14px',
                marginTop: '12px',
                background: 'hsl(var(--bg-sidebar) / 0.2)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'hsl(var(--text-primary))',
                }}
              >
                <LayoutGrid size={16} color="hsl(var(--accent))" />
                {t('editor.workspaceTools')}
              </div>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: '11px',
                  lineHeight: 1.45,
                  color: 'hsl(var(--text-secondary))',
                }}
              >
                {t('editor.workspaceToolsHint')}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  disabled={!onOpenBrowserWorkspace}
                  onClick={() => onOpenBrowserWorkspace?.()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    background: 'hsl(var(--bg-main))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: onOpenBrowserWorkspace ? 'pointer' : 'not-allowed',
                    opacity: onOpenBrowserWorkspace ? 1 : 0.45,
                  }}
                >
                  <Globe size={14} color="hsl(var(--accent))" />
                  {t('editor.btnBrowser')}
                </button>
                <button
                  type="button"
                  disabled={!onOpenDownloadWorkspace}
                  onClick={() => onOpenDownloadWorkspace?.()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    background: 'hsl(var(--bg-main))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: onOpenDownloadWorkspace ? 'pointer' : 'not-allowed',
                    opacity: onOpenDownloadWorkspace ? 1 : 0.45,
                  }}
                >
                  <Download size={14} color="hsl(var(--accent))" />
                  {t('editor.btnGira')}
                </button>
                <button
                  type="button"
                  disabled={!onOpenTerminalWorkspace}
                  onClick={() => onOpenTerminalWorkspace?.()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    background: 'hsl(var(--bg-main))',
                    color: 'hsl(var(--text-primary))',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: onOpenTerminalWorkspace ? 'pointer' : 'not-allowed',
                    opacity: onOpenTerminalWorkspace ? 1 : 0.45,
                  }}
                >
                  <Terminal size={14} color="hsl(var(--accent))" />
                  {t('editor.btnTerminal')}
                </button>
              </div>
            </div>
          )}
    </>
  );

  if (workspaceTabs.length === 0) {
    return (
      <div
        className="editor-wrapper editor-empty"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '200px',
          background: 'hsl(var(--bg-main))',
          padding: '24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>{quickStartPanel}</div>
      </div>
    );
  }

  return (
    <div className="editor-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--bg-main))' }}>
      {/* Tab Strip */}
      <div style={{ 
          display: 'flex', 
          background: 'hsl(0 0% 0% / 0.15)', 
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          padding: '0 8px',
          gap: '2px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
      }}>
        {workspaceTabs.map((tab: WorkspaceTab, idx: number) => (
            <div 
                key={tab.id}
                onClick={() => onWorkspaceTabSelect && onWorkspaceTabSelect(idx)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    background: idx === activeTabIndex ? 'hsl(var(--bg-main))' : 'transparent',
                    borderTop: `2px solid ${idx === activeTabIndex ? 'hsl(var(--accent))' : 'transparent'}`,
                    color: idx === activeTabIndex ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRight: '1px solid hsl(var(--border) / 0.1)',
                    minWidth: '120px',
                    justifyContent: 'space-between'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tabDisplayName(tab, t)}</span>
                <X 
                    size={13} 
                    style={{ opacity: 0.5 }} 
                    onClick={(e) => { e.stopPropagation(); onWorkspaceTabClose && onWorkspaceTabClose(idx); }} 
                    className="hover:opacity-100" 
                />
            </div>
        ))}
        <div
          role="button"
          tabIndex={0}
          title={t('editor.newTabTitle')}
          onClick={() => onOpenQuickStartTab?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenQuickStartTab?.();
            }
          }}
          style={{
            padding: '8px',
            opacity: 0.55,
            display: 'flex',
            alignItems: 'center',
            cursor: onOpenQuickStartTab ? 'pointer' : 'default',
          }}
        >
            <Plus size={14} />
        </div>
      </div>

      {activeAiStatus ? (
        <div
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            fontSize: '11px',
            lineHeight: 1.45,
            color: 'hsl(var(--text-secondary))',
            background: 'hsl(var(--accent) / 0.08)',
            borderBottom: '1px solid hsl(var(--border) / 0.35)',
          }}
        >
          <span style={{ color: 'hsl(var(--accent))', fontWeight: 600, marginRight: '8px' }}>AI</span>
          {activeAiStatus}
        </div>
      ) : null}

      {activeWorkspaceTab?.kind === 'file' ? (
      <>
      <div className="header" style={{ 
          display: 'flex',
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'transparent',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          padding: '0 24px',
          height: '40px',
          minHeight: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <FileCode size={16} color="hsl(var(--accent))" />
             <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
               {fileTabPath.split('/').pop()}
             </span>
             {fileTabPath && <span style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', opacity: 0.5 }}>{fileTabPath}</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {fileTabPath && (
            <>
              <button 
                className="btn-primary" 
                title={t('editor.titleAiFix')}
                style={{ background: 'hsl(0 100% 50% / 0.1)', color: 'hsl(0 100% 60%)', border: '1px solid hsl(0 100% 50% / 0.2)', padding: '6px 12px' }}
                onClick={async () => {
                   const res = await axios.post(`${API_BASE}/v2/analyze`, { fileName: fileTabPath });
                   alert(t('editor.aiAnalysis') + ' ' + res.data.analysis);
                }}
              >
                <ShieldAlert size={14} />
              </button>
              <button 
                className="btn-primary" 
                title={t('editor.titleAiRefactor')}
                style={{ background: 'hsl(var(--accent) / 0.1)', color: 'hsl(var(--accent))', border: '1px solid hsl(var(--accent) / 0.2)', padding: '6px 12px' }}
                onClick={async () => {
                   const res = await axios.post(`${API_BASE}/v2/multi-edit`, { 
                     prompt: 'Refactor this file for better performance and readability',
                     files: [fileTabPath]
                   });
                   (window as any).setProposals(res.data.proposals);
                }}
              >
                <Wand2 size={14} />
              </button>
              <button 
                className="btn-primary ai-glow" 
                onClick={() => onSave(localContent)}
                disabled={isSaving}
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '6px 16px',
                    background: isSaving ? 'hsl(var(--text-secondary) / 0.2)' : 'hsl(var(--accent))',
                    boxShadow: isSaving ? 'none' : '0 4px 12px hsl(var(--accent) / 0.3)'
                }}
              >
                {isSaving ? <BookOpen size={14} className="animate-spin" /> : <Save size={14} />}
                <span style={{ fontSize: '13px' }}>{isSaving ? t('editor.processing') : t('editor.saveFile')}</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div className="glass" style={{ height: '100%', overflow: 'hidden', padding: '4px', flex: 1, minHeight: 0 }}>
            <MonacoEditor
              key={fileTabPath}
              height="100%"
              language={getLanguage(fileTabPath)}
              theme={theme}
              value={localContent}
              onMount={handleEditorMount}
              onChange={(val) => setLocalContent(val || '')}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20 },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                roundedSelection: true,
                quickSuggestions: { other: true, comments: true, strings: true }
              }}
            />
        </div>
      </div>
      </>
      ) : activeWorkspaceTab?.kind === 'browser' ? (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <BrowserView
          key={activeWorkspaceTab.id}
          embedded
          navigateUrl={activeWorkspaceTab.url}
          onNavigateUrlConsumed={() => {}}
        />
      </div>
      ) : activeWorkspaceTab?.kind === 'terminal' ? (
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TerminalView />
      </div>
      ) : activeWorkspaceTab?.kind === 'download' ? (
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DownloadManagerView initialUrl={activeWorkspaceTab.initialUrl} />
      </div>
      ) : activeWorkspaceTab?.kind === 'home' ? (
      <div
        className="editor-quickstart"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'hsl(var(--bg-main))',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>{quickStartPanel}</div>
      </div>
      ) : null}
      <InlineChat
        open={inlineOpen}
        fileName={fileTabPath}
        selectedText={inlineSelection}
        onClose={() => setInlineOpen(false)}
        onApply={(text) => {
          setDiffZone({ fileName: fileTabPath, original: localContent, proposed: text });
          setInlineOpen(false);
        }}
      />
      <DiffZoneOverlay
        proposal={diffZone}
        onApply={async (text) => {
          const editor = editorRef.current;
          const model = editor?.getModel?.();
          if (editor && model && diffZone) {
            const monaco = (window as any).monaco;
            if (monaco?.Range) {
              const { buildInlineEdits } = await import('../lib/inlineDiffApply');
              const edits = buildInlineEdits(monaco, diffZone.original, text);
              if (edits.length) {
                editor.executeEdits('hoosh-diffzone-inline', edits);
              } else {
                editor.executeEdits('hoosh-diffzone', [{
                  range: model.getFullModelRange(),
                  text,
                  forceMoveMarkers: true
                }]);
              }
            } else {
              editor.executeEdits('hoosh-diffzone', [{
                range: model.getFullModelRange(),
                text,
                forceMoveMarkers: true
              }]);
            }
          }
          setLocalContent(text);
          setLintNotice(null);
          try {
            const r = await axios.post(`${API_BASE}/v3/context/apply-file`, {
              path: fileTabPath,
              content: text,
              runLint: true
            });
            if (r.data?.lint?.failed) {
              setLintNotice(String(r.data.lint.feedback || t('editor.lintFailed')).slice(0, 2000));
            }
          } catch {
            onSave(text);
          }
          axios.post(`${API_BASE}/v3/context/track-edit`, { path: fileTabPath }).catch(() => {});
          setDiffZone(null);
          onClearMissionDiffZone?.();
        }}
        onReject={() => {
          setDiffZone(null);
          setLintNotice(null);
          onClearMissionDiffZone?.();
        }}
      />
      {lintNotice && (
        <div style={{
          position: 'absolute', bottom: diffZone ? '44%' : 8, left: 8, right: 8, zIndex: 55,
          background: 'rgba(127,29,29,0.92)', border: '1px solid #ef4444', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, color: '#fecaca', maxHeight: 120, overflow: 'auto'
        }}>
          <strong>{t('editor.lintFailed')}</strong>
          <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{lintNotice}</pre>
        </div>
      )}
    </div>
  );
};

export default Editor;
