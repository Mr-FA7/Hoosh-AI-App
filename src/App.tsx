import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import AIPanel from './components/AIPanel';
import ProposalUI from './components/ProposalUI';
import EngineView from './components/EngineView';
import TerminalView from './components/TerminalView';
import BrowserView from './components/BrowserView';
import ActivePreviewView from './components/ActivePreviewView';
import UatView from './components/UatView';
import VmLabView from './components/VmLabView';
import MarketplaceView from './components/MarketplaceView';
import SettingsView from './components/SettingsView';
import GitPanel from './components/GitPanel';
import ProjectSelector from './components/ProjectSelector';
import BottomBar from './components/BottomBar';
import ProblemsPanel from './components/ProblemsPanel';
import axios from 'axios';
import { API_BASE } from './apiBase';
import type { WorkspaceTab } from './types/workspaceTab';
import { newWorkspaceTabId } from './types/workspaceTab';
import { useI18n } from './i18n/LocaleContext';
import { isDesktopShell } from './lib/pythonBridge';
import { wireExtensionKeybindings, loadExtensionKeybindings } from './lib/extensionKeybindings';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#111', color: '#ff4444', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong in FA7 UI.</h2>
          <pre style={{ background: '#222', padding: '10px', borderRadius: '4px' }}>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} style={{ background: '#ff4444', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const { t } = useI18n();
  const [isDesktop, setIsDesktop] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(-1);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [currentMissionName, setCurrentMissionName] = useState<string | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [missionDiffZone, setMissionDiffZone] = useState<{ fileName: string; original: string; proposed: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<
    'editor' | 'engine' | 'terminal' | 'vmlab' | 'browser' | 'preview' | 'marketplace' | 'uat' | 'settings' | 'git' | 'problems'
  >('editor');
  const [problemCounts, setProblemCounts] = useState({ errors: 0, warnings: 0 });
  const [kavoshNavigateUrl, setKavoshNavigateUrl] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('fa7_editor_theme') || 'vs-dark');

  useEffect(() => {
    const refreshProblems = async () => {
      try {
        const r = await axios.get(`${API_BASE}/v3/context/problems/list`);
        const markers = r.data?.markers || [];
        setProblemCounts({
          errors: markers.filter((m: { severity: number }) => m.severity === 8).length,
          warnings: markers.filter((m: { severity: number }) => m.severity === 4).length
        });
      } catch { /* ignore */ }
    };
    void refreshProblems();
    const id = setInterval(refreshProblems, 5000);
    window.addEventListener('fa7-problems-updated', refreshProblems);
    return () => {
      clearInterval(id);
      window.removeEventListener('fa7-problems-updated', refreshProblems);
    };
  }, [projectRoot]);

  useEffect(() => {
    localStorage.setItem('fa7_editor_theme', currentTheme);
    const monaco = (window as any).monaco;
    if (monaco?.editor?.setTheme && currentTheme !== 'custom-ext-theme') {
      try { monaco.editor.setTheme(currentTheme); } catch { /* monaco not ready */ }
    }
  }, [currentTheme]);
  /** Bumps when file tree is refetched so FileExplorer drops stale per-folder cache without collapsing the root. */
  const [explorerSyncKey, setExplorerSyncKey] = useState(0);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const next = Array.isArray(res.data) ? res.data : [];
      setFiles((prev) => {
        const key = (rows: typeof next) =>
          JSON.stringify(
            [...rows].sort((a, b) => String(a.path).localeCompare(String(b.path)))
          );
        if (key(prev as typeof next) === key(next)) return prev;
        return next;
      });
      setExplorerSyncKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to fetch files', err);
      setFiles([]);
      setExplorerSyncKey((k) => k + 1);
    }
  }, []);

  useEffect(() => {
    if (!projectRoot) return;
    wireExtensionKeybindings();
    void loadExtensionKeybindings();
  }, [projectRoot]);

  useEffect(() => {
    setIsDesktop(isDesktopShell());
    (window as any).setProposals = setProposals;
    // Check if there is an active project root in the companion
    axios.get(`${API_BASE}/v3/project/path`)
      .then(res => {
        if (res.data?.path) {
          setProjectRoot(res.data.path);
          fetchFiles();
        }
      })
      .catch((err) => {
        console.warn('[App] Failed to fetch initial project root:', err);
      });
  }, [fetchFiles]);

  /** Keep explorer in sync after external deletes (Finder, terminal, etc.) */
  useEffect(() => {
    if (!projectRoot) return;
    const tick = () => {
      void fetchFiles();
    };
    const id = setInterval(tick, 10000);
    const onFocus = () => {
      void fetchFiles();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchFiles();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [projectRoot, fetchFiles]);

  useEffect(() => {
    if (!projectRoot || viewMode !== 'editor') return;
    void fetchFiles();
  }, [viewMode, fetchFiles, projectRoot]);

  const loadFileContent = useCallback(async (path: string) => {
    const res = await axios.get(`${API_BASE}/file`, { params: { path } });
    setActiveFile(path);
    setContent(res.data?.content ?? '');
  }, []);

  /** Load file when switching tabs (explorer uses handleFileSelect + loadFileContent). */
  useEffect(() => {
    const tab = workspaceTabs[activeTabIndex];
    if (!tab) return;
    if (tab.kind !== 'file') {
      if (activeFile !== null) setActiveFile(null);
      return;
    }
    if (activeFile === tab.path) return;
    void loadFileContent(tab.path).catch((err) => console.error('Failed to read file', err));
  }, [activeTabIndex, workspaceTabs, activeFile, loadFileContent]);

  const handleFileSelect = async (path: string) => {
    try {
      await loadFileContent(path);
      setWorkspaceTabs((prev) => {
        const i = prev.findIndex((t) => t.kind === 'file' && t.path === path);
        if (i >= 0) {
          queueMicrotask(() => setActiveTabIndex(i));
          return prev;
        }
        const id = `file:${path}`;
        const next = [...prev, { id, kind: 'file' as const, path }];
        queueMicrotask(() => setActiveTabIndex(next.length - 1));
        return next;
      });
      if (viewMode !== 'editor') setViewMode('editor');
    } catch (err: any) {
      if (err?.response?.status === 400 && err?.response?.data?.isDirectory) {
        return;
      }
      console.error('Failed to read file', err);
    }
  };

  const handleProblemOpen = useCallback(async (relPath: string, line: number, column = 1) => {
    setViewMode('editor');
    await handleFileSelect(relPath);
    window.dispatchEvent(new CustomEvent('fa7-goto-line', { detail: { line, column } }));
  }, [handleFileSelect]);

  const handleWorkspaceTabSelect = (idx: number) => {
    setActiveTabIndex(idx);
  };

  const handleWorkspaceTabClose = (idx: number) => {
    setWorkspaceTabs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        queueMicrotask(() => {
          setActiveFile(null);
          setContent('');
        });
      }
      setActiveTabIndex((cur) => {
        if (next.length === 0) return -1;
        if (idx === cur) return Math.min(cur, next.length - 1);
        if (idx < cur) return cur - 1;
        return cur;
      });
      return next;
    });
  };

  const openBrowserWorkspaceTab = (url: string) => {
    let title = 'Browser';
    try {
      title = new URL(url).hostname.replace(/^www\./, '') || title;
    } catch {
      /* ignore */
    }
    setWorkspaceTabs((prev) => {
      const next: WorkspaceTab[] = [
        ...prev,
        {
          id: newWorkspaceTabId(),
          kind: 'browser',
          url,
          title,
          aiStatus: 'The assistant opened this page for research.',
        },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setViewMode('editor');
  };

  const openTerminalWorkspaceTab = (opts?: { aiStatus?: string }) => {
    setWorkspaceTabs((prev) => {
      const next: WorkspaceTab[] = [
        ...prev,
        {
          id: newWorkspaceTabId(),
          kind: 'terminal',
          label: 'Terminal',
          aiStatus:
            opts?.aiStatus ??
            'Command output appears in chat; for an interactive shell, pick the AI or User session in the panel below.',
        },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setViewMode('editor');
  };

  const openAgentWorkspaceTab = (opts?: { aiStatus?: string }) => {
    setWorkspaceTabs((prev) => {
      const next: WorkspaceTab[] = [
        ...prev,
        {
          id: newWorkspaceTabId(),
          kind: 'agent',
          label: 'Negah / Mission',
          aiStatus: opts?.aiStatus ?? 'Mission and agent controls are in this panel.',
        },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setViewMode('editor');
  };

  const openDownloadWorkspaceTab = (opts?: { initialUrl?: string; aiStatus?: string }) => {
    setWorkspaceTabs((prev) => {
      const next: WorkspaceTab[] = [
        ...prev,
        {
          id: newWorkspaceTabId(),
          kind: 'download',
          label: 'Gira',
          initialUrl: opts?.initialUrl,
          aiStatus:
            opts?.aiStatus ??
            'The assistant opened Gira for a direct link; same engine and Gira project folder on disk.',
        },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setViewMode('editor');
  };

  const openHomeWorkspaceTab = () => {
    setWorkspaceTabs((prev) => {
      const i = prev.findIndex((t) => t.kind === 'home');
      if (i >= 0) {
        setActiveTabIndex(i);
        return prev;
      }
      const next: WorkspaceTab[] = [
        ...prev,
        { id: newWorkspaceTabId(), kind: 'home', label: 'New file' },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setViewMode('editor');
  };

  const handleProjectSelect = async (root: string) => {
      try {
          await axios.post(`${API_BASE}/v3/project/switch`, { path: root });
          setProjectRoot(root);
          fetchFiles();
      } catch (err: any) {
          alert('Failed to switch project: ' + (err?.response?.data?.error || err?.message || root));
      }
  };

  const handleCloseProject = async () => {
    try {
      await axios.post(`${API_BASE}/v3/project/close`);
      setProjectRoot(null);
      setFiles([]);
      setWorkspaceTabs([]);
      setActiveTabIndex(-1);
      setActiveFile(null);
      setContent('');
      setViewMode('editor');
    } catch (err: any) {
      alert('Failed to close project: ' + (err?.response?.data?.error || err?.message));
    }
  };

  const handleSave = async (newContent: string) => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      await axios.post(`${API_BASE}/file`, { path: activeFile, content: newContent });
      setContent(newContent);
    } catch (err) {
      console.error('Failed to save file', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyProposal = async (fileName: string, proposedContent: string) => {
    try {
      await axios.post(`${API_BASE}/file`, { path: fileName, content: proposedContent });
      if (activeFile === fileName) setContent(proposedContent);
      setProposals(prev => prev.filter(p => p.fileName !== fileName));
    } catch (err: any) {
      alert('Failed to apply: ' + err.message);
    }
  };


  if (!projectRoot && viewMode !== 'settings') {
    return <ProjectSelector onSelect={handleProjectSelect} onOpenSettings={() => setViewMode('settings')} />;
  }

  return (
    <ErrorBoundary>
      <div className="fa7-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Panel 1: Thinnest Bar */}
          <Sidebar viewMode={viewMode} setViewMode={setViewMode} isDesktop={isDesktop} />
          
          {/* Panel 2: Contextual Sidebar (Explorer) */}
          <AnimatePresence mode="popLayout">
            {viewMode === 'editor' && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 250, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ overflow: 'hidden' }}
              >
                <FileExplorer 
                  files={files} 
                  explorerSyncKey={explorerSyncKey}
                  activeFile={activeFile} 
                  onFileSelect={handleFileSelect} 
                  onRefresh={fetchFiles}
                  onProjectChange={setProjectRoot}
                />
              </motion.div>
            )}
          </AnimatePresence>
  
          {/* Panel 3: Main Workspace */}
          <main className="workspace-container" style={{ flex: 1, display: 'flex', background: 'hsl(var(--bg-main))' }}>
            <div className="editor-section" style={{ borderRight: 'none', flex: 1 }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    initial={{ opacity: 0.98 }}
                    animate={{ opacity: 1 }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {viewMode === 'editor' && (
                      <Editor 
                        content={content} 
                        fileName={activeFile || ''} 
                        onSave={handleSave}
                        isSaving={isSaving}
                        theme={currentTheme}
                        workspaceTabs={workspaceTabs}
                        activeTabIndex={activeTabIndex}
                        onOpenFile={handleFileSelect}
                        onFilesChanged={fetchFiles}
                        onWorkspaceTabSelect={handleWorkspaceTabSelect}
                        onWorkspaceTabClose={handleWorkspaceTabClose}
                        onOpenQuickStartTab={openHomeWorkspaceTab}
                        onOpenBrowserWorkspace={() =>
                          openBrowserWorkspaceTab('https://duckduckgo.com/')
                        }
                        onOpenDownloadWorkspace={() => openDownloadWorkspaceTab()}
                        onOpenTerminalWorkspace={() => openTerminalWorkspaceTab()}
                        missionDiffZone={missionDiffZone?.fileName === activeFile ? missionDiffZone : null}
                        onClearMissionDiffZone={() => setMissionDiffZone(null)}
                      />
                    )}
                    {viewMode === 'engine' && <EngineView />}
                    {viewMode === 'terminal' && <TerminalView />}
                    {viewMode === 'vmlab' && <VmLabView />}
                    {viewMode === 'browser' && <BrowserView navigateUrl={kavoshNavigateUrl} onNavigateUrlConsumed={() => setKavoshNavigateUrl(null)} />}
                    {viewMode === 'preview' && <ActivePreviewView projectRoot={projectRoot} />}
                    {viewMode === 'marketplace' && <MarketplaceView onThemeApplied={(themeName) => setCurrentTheme(themeName)} />}
                    {viewMode === 'uat' && <UatView />}
                    {viewMode === 'git' && <GitPanel />}
                    {viewMode === 'problems' && (
                      <ProblemsPanel onOpenLocation={(p, line, col) => { void handleProblemOpen(p, line, col); }} />
                    )}
                    {viewMode === 'settings' && (
                      <div style={{ height: '100%', overflow: 'auto', overscrollBehavior: 'contain' }}>
                        <div style={{ padding: '14px 20px 0' }}>
                          <button
                            onClick={() => (projectRoot ? void handleCloseProject() : setViewMode('editor'))}
                            style={{
                              background: 'transparent',
                              border: '1px solid hsl(var(--border) / 0.4)',
                              borderRadius: '8px',
                              color: 'hsl(var(--text-secondary))',
                              fontSize: '12px',
                              padding: '6px 10px',
                              cursor: 'pointer'
                            }}
                          >
                            {projectRoot ? t('app.switchProject') : t('app.backToSelector')}
                          </button>
                        </div>
                        <SettingsView onThemeChange={setCurrentTheme} currentTheme={currentTheme} />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </main>
  
          {/* Panel 4: AI Panel */}
          <AIPanel
            activeFile={activeFile}
            currentContent={content}
            onFileSelect={handleFileSelect}
            onMissionUpdate={(name) => setCurrentMissionName(name)}
            onRefreshExplorer={() => fetchFiles()}
            onOpenKavosh={(url) => openBrowserWorkspaceTab(url)}
            onOpenEditorTerminalTab={(opts) => openTerminalWorkspaceTab(opts)}
            onOpenEditorAgentTab={(opts) => openAgentWorkspaceTab(opts)}
            onOpenEditorDownloadTab={(opts) => openDownloadWorkspaceTab(opts)}
            onProposals={(incoming) => {
              if (!incoming || incoming.length === 0) return;
              setProposals((prev) => {
                const next = [...prev];
                for (const p of incoming) {
                  const idx = next.findIndex((x) => x.fileName === p.fileName);
                  if (idx >= 0) next[idx] = { ...next[idx], ...p };
                  else next.push(p);
                }
                return next;
              });
            }}
            onMissionDiffZone={(proposal) => setMissionDiffZone(proposal)}
          />
        </div>
  
        <BottomBar 
          status={currentMissionName || t('app.systemReady')} 
          errors={problemCounts.errors}
          warnings={problemCounts.warnings}
          onProblemsClick={() => setViewMode('problems')}
          language={
            activeFile
              ? activeFile.split('.').pop()?.toUpperCase()
              : workspaceTabs[activeTabIndex]?.kind === 'browser'
                ? 'WEB'
                : workspaceTabs[activeTabIndex]?.kind === 'terminal'
                  ? 'SHELL'
                  : workspaceTabs[activeTabIndex]?.kind === 'agent'
                    ? 'AGENT'
                    : workspaceTabs[activeTabIndex]?.kind === 'download'
                      ? 'GIRA'
                      : workspaceTabs[activeTabIndex]?.kind === 'home'
                        ? 'NEW'
                        : 'NO FILE'
          }
        />
  
        {/* Overlays */}
        <AnimatePresence>
          {proposals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{ position: 'absolute', bottom: 40, right: 400, zIndex: 100 }}
            >
              <ProposalUI proposals={proposals} onApply={handleApplyProposal} onClose={() => setProposals([])} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default App;
