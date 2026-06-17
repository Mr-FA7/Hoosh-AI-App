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
}

const Editor: React.FC<EditorProps> = ({ 
  content, fileName, onSave, isSaving, theme = 'vs-dark',
  workspaceTabs = [], activeTabIndex = -1, onWorkspaceTabSelect, onWorkspaceTabClose,
  onOpenFile, onFilesChanged, onOpenQuickStartTab,
  onOpenBrowserWorkspace, onOpenDownloadWorkspace, onOpenTerminalWorkspace
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

  React.useEffect(() => {
    setLocalContent(content);
  }, [content]);

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
  const activeAiStatus =
    activeWorkspaceTab &&
    activeWorkspaceTab.kind !== 'file' &&
    activeWorkspaceTab.kind !== 'home'
      ? activeWorkspaceTab.aiStatus
      : undefined;

  const handleEditorMount = (editor: any, monaco: any) => {
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: async (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        if (textUntilPosition.length < 10) return { suggestions: [] };
        try {
          const res = await axios.post(`${API_BASE}/ai/complete`, {
            prefix: textUntilPosition.slice(-500),
            suffix: model.getValue().slice(model.getOffsetAt(position), 500),
            fileName: fileTabPath
          });
          const suggestion = res.data.suggestion;
          return {
            suggestions: [{
              label: 'Hoosh',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: suggestion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              },
              detail: t('editor.aiGenerated')
            }]
          };
        } catch (err) {
          return { suggestions: [] };
        }
      }
    });

    if (theme === 'custom-ext-theme') {
        monaco.editor.setTheme('custom-ext-theme');
    }
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
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
};

export default Editor;
