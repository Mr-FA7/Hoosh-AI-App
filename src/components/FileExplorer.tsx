import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Folder, FileCode, RefreshCw, FolderOpen, Edit3, ChevronRight, FolderInput, FolderPlus, X } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../apiBase';
import { browseFolderPath } from '../lib/browseFolder';
import { fetchProjectFiles } from '../lib/workspaceApi';
import { getWebProjectMeta, isWebProjectRoot } from '../lib/webWorkspace';
import { useI18n } from '../i18n/LocaleContext';

interface FileExplorerProps {
  files: any[];
  projectRoot?: string | null;
  /** Incremented after each successful tree refetch so nested folder cache is cleared while keeping expanded folders open. */
  explorerSyncKey?: number;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onRefresh: () => void;
  onProjectChange?: (path: string) => void;
}

type FsEntry = { name: string; path: string; isDirectory: boolean; workspaceRoot?: boolean };

const FileExplorer: React.FC<FileExplorerProps> = ({ files, projectRoot = null, explorerSyncKey = 0, activeFile, onFileSelect, onRefresh, onProjectChange }) => {
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [projectInfo, setProjectInfo] = useState<{ path: string; name: string; folders?: Array<{ name: string; path: string }> } | null>(null);
  const [workspaceFolders, setWorkspaceFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [newPath, setNewPath] = useState('');
  /** Relative folder paths (e.g. `src/components`) that are expanded */
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  /** Loaded children per folder path */
  const [childrenCache, setChildrenCache] = useState<Record<string, FsEntry[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    fetchProjectInfo();
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/ai/system-stats`);
        setStats(res.data);
      } catch (e) {
        console.error('Stats fail', e);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void fetchProjectInfo();
  }, [projectRoot]);

  const fetchProjectInfo = async () => {
    if (projectRoot && isWebProjectRoot(projectRoot)) {
      const meta = getWebProjectMeta(projectRoot);
      if (meta) {
        setProjectInfo({ path: meta.path, name: meta.name, folders: [{ name: meta.name, path: meta.path }] });
        setNewPath(meta.path);
        setWorkspaceFolders([{ name: meta.name, path: meta.path }]);
      }
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/v3/project/path`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      setProjectInfo(res.data);
      setNewPath(res.data.path);
      const folders = Array.isArray(res.data.folders) ? res.data.folders : [];
      setWorkspaceFolders(folders);
    } catch (e) {
      console.error('Failed to fetch project info', e);
    }
  };

  const handleExplorerRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProjectInfo();
      await Promise.resolve(onRefresh());
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenProject = async () => {
    try {
      const res = await axios.post(`${API_BASE}/v3/project/open`, { path: newPath });
      const opened = res.data?.path || newPath;
      setIsEditingPath(false);
      fetchProjectInfo();
      onProjectChange?.(opened);
      onRefresh();
    } catch (e: any) {
      alert(t('explorer.alertOpenFailed') + ' ' + (e.response?.data?.error || e.message));
    }
  };

  const handleBrowseProjectPath = async () => {
    const result = await browseFolderPath({ purpose: 'pick-destination' });
    if (result.ok) {
      setNewPath(result.path);
      return;
    }
    if (result.canceled) return;
    alert(t(result.errorKey || 'explorer.alertPickerFailed'));
  };

  const handleAddWorkspaceFolder = async () => {
    try {
      const r = await axios.get(`${API_BASE}/dialog/open-folder`);
      if (!r.data?.ok || r.data.canceled || !r.data.path) return;
      await axios.post(`${API_BASE}/v3/workspace/folders`, { path: r.data.path });
      await handleExplorerRefresh();
    } catch (e: any) {
      alert(t('explorer.alertAddFolderFailed') + ' ' + (e.response?.data?.error || e.message));
    }
  };

  const handleRemoveWorkspaceFolder = async (folderPath: string) => {
    if (!folderPath || workspaceFolders.length <= 1) return;
    try {
      await axios.delete(`${API_BASE}/v3/workspace/folders`, { data: { path: folderPath } });
      await handleExplorerRefresh();
    } catch (e: any) {
      alert(t('explorer.alertRemoveFolderFailed') + ' ' + (e.response?.data?.error || e.message));
    }
  };

  const primaryFolderPath = workspaceFolders[0]?.path || projectInfo?.path || '';

  const cacheRef = useRef(childrenCache);
  cacheRef.current = childrenCache;
  const expandedRef = useRef(expandedPaths);
  expandedRef.current = expandedPaths;
  const inflightRef = useRef<Set<string>>(new Set());

  const loadChildren = useCallback(async (relPath: string, force = false) => {
    if (!force && cacheRef.current[relPath] !== undefined) return;
    if (inflightRef.current.has(relPath)) {
      if (!force) return;
      inflightRef.current.delete(relPath);
    }
    inflightRef.current.add(relPath);
    setLoadingPaths((p) => new Set(p).add(relPath));
    try {
      const rows = await fetchProjectFiles(relPath, projectRoot || projectInfo?.path || null);
      setChildrenCache((c) => ({ ...c, [relPath]: rows }));
    } catch (e) {
      console.error('List folder failed', relPath, e);
      setChildrenCache((c) => ({ ...c, [relPath]: [] }));
    } finally {
      inflightRef.current.delete(relPath);
      setLoadingPaths((p) => {
        const n = new Set(p);
        n.delete(relPath);
        return n;
      });
    }
  }, [projectRoot, projectInfo?.path]);

  const expandedKey = useMemo(() => [...expandedPaths].sort().join('|'), [expandedPaths]);

  useEffect(() => {
    expandedPaths.forEach((relPath) => {
      void loadChildren(relPath);
    });
  }, [expandedKey, loadChildren]);

  useEffect(() => {
    setChildrenCache({});
    setExpandedPaths(new Set());
  }, [files]);

  useEffect(() => {
    if (explorerSyncKey === 0) return;
    setChildrenCache({});
    expandedRef.current.forEach((relPath) => {
      void loadChildren(relPath, true);
    });
  }, [explorerSyncKey, loadChildren]);

  const toggleFolder = useCallback((relPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }, []);

  const sortEntries = (entries: FsEntry[]) =>
    [...entries].sort((a, b) => {
      const ad = a.isDirectory === true;
      const bd = b.isDirectory === true;
      if (ad !== bd) return ad ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  const renderTree = (entries: FsEntry[], depth: number): React.ReactNode => {
    return sortEntries(entries).map((entry) => {
      /** API must send boolean; loose truthy breaks on string "false" */
      const isFolder = entry.isDirectory === true;

      if (!isFolder) {
        return (
          <div
            key={`f-${entry.path}`}
            className={`file-item ${activeFile === entry.path ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(entry.path);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px 5px 6px',
              paddingLeft: 6 + depth * 14,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 1,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: 16, flexShrink: 0 }} aria-hidden />
            <FileCode size={14} color={activeFile === entry.path ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))'} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.name}</span>
          </div>
        );
      }

      const isOpen = expandedPaths.has(entry.path);
      const kids = childrenCache[entry.path];
      const loading = loadingPaths.has(entry.path) && kids === undefined;

      return (
        <div key={`d-${entry.path}`}>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFolder(entry.path);
              }
            }}
            className="file-item"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFolder(entry.path);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px 5px 4px',
              paddingLeft: 4 + depth * 14,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              marginBottom: 1,
              transition: 'all 0.15s ease',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                width: 16,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--text-secondary))',
              }}
              aria-hidden
            >
              <ChevronRight
                size={15}
                strokeWidth={2.2}
                style={{
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}
              />
            </span>
            <Folder size={14} style={{ opacity: 0.65, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.name}</span>
          </div>
          {isOpen && loading && (
            <div style={{ paddingLeft: 28 + depth * 14, fontSize: 10, opacity: 0.45, paddingBottom: 4 }}>{t('explorer.loading')}</div>
          )}
          {isOpen && kids && kids.length > 0 && <div>{renderTree(kids, depth + 1)}</div>}
          {isOpen && kids && kids.length === 0 && !loading && (
            <div style={{ paddingLeft: 28 + depth * 14, fontSize: 10, opacity: 0.4, paddingBottom: 4 }}>{t('explorer.emptyFolder')}</div>
          )}
        </div>
      );
    });
  };

  const rootEntries = useMemo(() => (Array.isArray(files) ? (files as FsEntry[]) : []), [files]);

  return (
    <div className="file-explorer" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Project Header */}
      <div 
        className="project-header" 
        style={{ 
          padding: '16px', 
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          background: 'hsl(var(--bg-sidebar) / 0.2)'
        }}
      >
        {!isEditingPath ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setIsEditingPath(true)}>
            <FolderOpen size={16} color="hsl(var(--accent))" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {projectInfo?.name || t('explorer.loadingProject')}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {projectInfo?.path}
              </div>
            </div>
            <Edit3 size={12} style={{ opacity: 0.4 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.5 }}>{t('explorer.openProjectPath')}</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch', minWidth: 0 }}>
              <input 
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/absolute/path/to/project"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'hsl(var(--bg-main))',
                  border: '1px solid hsl(var(--border) / 0.8)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: 'white',
                  outline: 'none'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenProject()}
              />
              <button 
                onClick={handleOpenProject}
                style={{
                  background: 'hsl(var(--accent))',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'black',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {t('explorer.go')}
              </button>
              <button
                onClick={handleBrowseProjectPath}
                title={t('project.browse')}
                style={{
                  background: 'hsl(var(--accent) / 0.15)',
                  border: '1px solid hsl(var(--accent) / 0.35)',
                  borderRadius: '4px',
                  color: 'hsl(var(--accent))',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <FolderInput size={12} /> {t('project.browse')}
              </button>
            </div>
            <button 
              onClick={() => setIsEditingPath(false)}
              style={{ background: 'none', border: 'none', color: 'hsl(var(--text-secondary))', fontSize: '10px', cursor: 'pointer', textAlign: 'left', opacity: 0.5 }}
            >
              {t('explorer.cancel')}
            </button>
          </div>
        )}
        {projectInfo?.path && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('explorer.workspaceFolders')}
              </span>
              <button
                type="button"
                onClick={handleAddWorkspaceFolder}
                title={t('explorer.addFolder')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'hsl(var(--accent) / 0.12)',
                  border: '1px solid hsl(var(--accent) / 0.3)',
                  borderRadius: 4,
                  color: 'hsl(var(--accent))',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 8px',
                  cursor: 'pointer'
                }}
              >
                <FolderPlus size={12} /> {t('explorer.addFolder')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {workspaceFolders.map((folder) => {
                const isPrimary = folder.path === primaryFolderPath;
                return (
                  <div
                    key={folder.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: 'hsl(var(--bg-main) / 0.35)',
                      border: '1px solid hsl(var(--border) / 0.35)'
                    }}
                  >
                    <Folder size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}{isPrimary ? ` (${t('explorer.primaryFolder')})` : ''}
                      </div>
                      <div style={{ opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.path}</div>
                    </div>
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWorkspaceFolder(folder.path)}
                        title={t('explorer.removeFolder')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--text-secondary))',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          opacity: 0.6
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="header" style={{ padding: '12px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>{t('explorer.title')}</span>
        <button
          type="button"
          title={t('explorer.refreshTitle')}
          aria-label={t('explorer.refreshTitle')}
          disabled={refreshing}
          onClick={() => void handleExplorerRefresh()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            margin: 0,
            border: 'none',
            background: 'transparent',
            cursor: refreshing ? 'wait' : 'pointer',
            opacity: refreshing ? 0.85 : 0.5,
            color: 'inherit',
          }}
          className="hover:opacity-100 transition-opacity"
        >
          <RefreshCw size={12} className={refreshing ? 'fa7-refresh-spin' : ''} />
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>{renderTree(rootEntries, 0)}</div>
    </div>
  );
};

export default FileExplorer;
