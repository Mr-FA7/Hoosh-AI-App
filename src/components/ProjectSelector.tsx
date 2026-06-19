import React, { useState, useEffect } from 'react';
import { FolderOpen, PlusCircle, Laptop, Rocket, ShieldCheck, Clock, ChevronRight, X, FolderInput } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_BASE as API } from '../apiBase';
import { browseFolderPath, type BrowseFolderPurpose } from '../lib/browseFolder';
import { companionGet, companionPost } from '../lib/companionHttp';
import { useRuntimeEnv } from '../hooks/useRuntimeEnv';
import { isHostedWebApp } from '../runtimeEnv';
import { isRealFilesystemPath, isWebProjectRoot, listRecentWebProjects } from '../lib/webWorkspace';
import LocalBridgePanel from './LocalBridgePanel';
import { useI18n } from '../i18n/LocaleContext';
import LanguageSwitcher from './LanguageSwitcher';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
}

interface ProjectSelectorProps {
  onSelect: (path: string) => void;
  onOpenSettings?: () => void;
}

type Tab = 'open' | 'new';

declare global {
  interface Window {
    electronAPI?: { openFolder: () => Promise<{ canceled: boolean; path?: string }> };
  }
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onSelect, onOpenSettings }) => {
  const { t: tx, locale } = useI18n();
  const runtime = useRuntimeEnv();
  const [tab, setTab] = useState<Tab>('open');
  const [path, setPath] = useState('');
  const [isError, setIsError] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newGoal, setNewGoal] = useState('');

  useEffect(() => {
    if (runtime.usesCompanionApi) {
      companionGet<{ ok?: boolean; projects?: RecentProject[] }>('/api/v3/project/recent')
        .then((r) => {
          if (r.data?.ok) {
            setRecentProjects(r.data.projects || []);
            return;
          }
          throw new Error('companion unavailable');
        })
        .catch(() => {
          axios.get(`${API}/v3/project/recent`)
            .then((r) => { if (r.data?.ok) setRecentProjects(r.data.projects || []); })
            .catch(() => setRecentProjects([]));
        });
      return;
    }
    setRecentProjects(
      listRecentWebProjects().map((p) => ({
        path: p.id,
        name: p.name,
        lastOpened: p.lastOpened,
      }))
    );
  }, [runtime.usesCompanionApi]);

  const browseFolder = async (setter: (p: string) => void, purpose: BrowseFolderPurpose) => {
    const result = await browseFolderPath({ purpose });
    if (result.ok) {
      setter(result.path);
      return;
    }
    if (result.canceled) return;
    const key = result.errorKey || 'project.folderPickerFailed';
    window.alert(tx(key));
  };

  const handleOpen = () => {
    const trimmed = path.trim();
    if (!trimmed) { setIsError(true); return; }
    if (!isWebProjectRoot(trimmed) && !runtime.usesCompanionApi) {
      window.alert(tx('project.openRequiresImportOrCompanion'));
      return;
    }
    onSelect(trimmed);
  };

  const handleCreate = async () => {
    if (!runtime.usesCompanionApi) {
      setCreateError(tx('project.createRequiresCompanion'));
      return;
    }
    if (!newName.trim()) {
      setCreateError(tx('project.nameRequired'));
      return;
    }
    if (!newParent.trim()) {
      setCreateError(tx('project.destinationRequired'));
      return;
    }
    if (!isRealFilesystemPath(newParent)) {
      setCreateError(tx('project.createNeedsLocalPath'));
      return;
    }
    setIsCreating(true);
    setCreateError('');
    try {
      const r = await companionPost<{ ok?: boolean; path?: string; error?: string }>('/api/v3/project/create', {
        name: newName.trim(),
        parentPath: newParent.trim(),
        template: 'blank',
        goal: newGoal.trim() || undefined
      });
      if (r.data?.ok && r.data.path) {
        onSelect(r.data.path);
      } else {
        setCreateError(r.data?.error || tx('project.createFailed'));
      }
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || e?.message || tx('project.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (locale === 'fa') {
        if (diff < 60000) return 'همین الان';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} دقیقه پیش`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ساعت پیش`;
        return d.toLocaleDateString('fa-IR');
      }
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    } catch { return ''; }
  };

  const BrowseBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} title="Browse folder"
      style={{
        padding: '0 14px', height: '100%', background: 'hsl(var(--accent) / 0.12)',
        border: '1px solid hsl(var(--accent) / 0.3)', borderRadius: '0 10px 10px 0',
        color: 'hsl(var(--accent))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--accent) / 0.22)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'hsl(var(--accent) / 0.12)')}>
      <FolderInput size={14} /> {tx('project.browse')}
    </button>
  );

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at top right, hsl(var(--accent) / 0.15), transparent), hsl(var(--bg-main))',
      color: 'hsl(var(--text-primary))'
    }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass"
        style={{
          width: '560px', maxWidth: '95vw',
          border: '1px solid hsl(var(--border) / 0.5)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          borderRadius: '16px', overflow: 'hidden'
        }}>

        <div style={{ padding: '28px 28px 20px', textAlign: 'center', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
          <img src="./fa7_logo.png" alt="Hoosh"
            style={{ width: '56px', marginBottom: '12px', filter: 'drop-shadow(0 0 20px hsl(var(--accent) / 0.5))' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Hoosh <span style={{ color: 'hsl(var(--accent))' }}>v7.0</span>
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '12px' }}>{tx('project.tagline')}</p>
          <div style={{
            marginTop: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '999px',
            border: '1px solid hsl(var(--accent) / 0.35)',
            background: 'hsl(var(--accent) / 0.1)',
            color: 'hsl(var(--accent))',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            <Laptop size={12} /> {tx(runtime.labelKey)}
          </div>
          <div style={{ marginTop: '14px' }}>
            <LanguageSwitcher compact />
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
          {(['open', 'new'] as Tab[]).map((tabId) => (
            <button key={tabId} onClick={() => setTab(tabId)}
              style={{
                flex: 1, padding: '13px', background: tab === tabId ? 'hsl(var(--accent) / 0.08)' : 'transparent',
                border: 'none', borderBottom: tab === tabId ? '2px solid hsl(var(--accent))' : '2px solid transparent',
                color: tab === tabId ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))',
                fontSize: '13px', fontWeight: tab === tabId ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
              {tabId === 'open' ? <FolderOpen size={14} /> : <PlusCircle size={14} />}
              {tabId === 'open' ? tx('project.tabOpen') : tx('project.tabNew')}
            </button>
          ))}
        </div>

        <div style={{ padding: '22px 24px 24px' }}>
          {isHostedWebApp() && !runtime.usesCompanionApi && (
            <LocalBridgePanel onConnected={runtime.refresh} />
          )}
          <AnimatePresence mode="wait">
            {tab === 'open' ? (
              <motion.div key="open" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                {recentProjects.length > 0 && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '11px', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <Clock size={11} /> {tx('project.recent')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {recentProjects.slice(0, 5).map((p) => (
                        <button key={p.path} onClick={() => onSelect(p.path)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px',
                            background: 'hsl(var(--bg-sidebar) / 0.5)', border: '1px solid hsl(var(--border) / 0.3)',
                            borderRadius: '8px', cursor: 'pointer', color: 'hsl(var(--text-primary))', textAlign: 'left', transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--accent) / 0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'hsl(var(--bg-sidebar) / 0.5)')}>
                          <FolderOpen size={15} style={{ color: 'hsl(var(--accent))', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</div>
                          </div>
                          <span style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', flexShrink: 0 }}>{formatDate(p.lastOpened)}</span>
                          <ChevronRight size={13} style={{ color: 'hsl(var(--text-secondary))', flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>
                    {tx('project.orSelectFolder')}
                  </label>
                  <div style={{ display: 'flex', height: '44px', marginBottom: '4px' }}>
                    <input type="text" placeholder="/Users/username/my-project"
                      value={path} onChange={(e) => { setPath(e.target.value); setIsError(false); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
                      style={{
                        flex: 1, padding: '0 14px', boxSizing: 'border-box',
                        background: 'hsl(0 0% 0% / 0.3)',
                        border: `1px solid ${isError ? 'hsl(0 100% 50% / 0.5)' : 'hsl(var(--border))'}`,
                        borderRight: 'none', borderRadius: '10px 0 0 10px',
                        color: '#fff', fontSize: '13px', outline: 'none'
                      }} />
                    <BrowseBtn onClick={() => browseFolder(setPath, 'open-project')} />
                  </div>
                  {isError && <p style={{ color: 'hsl(0 100% 60%)', fontSize: '11px', marginBottom: '10px' }}>{tx('project.pathError')}</p>}
                  {runtime.usesWebWorkspace && (
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '11px', marginBottom: '10px' }}>
                      {tx(runtime.browseHintKey)}
                    </p>
                  )}
                  <button className="btn-primary" onClick={handleOpen}
                    style={{ width: '100%', marginTop: '6px', background: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px' }}>
                    <FolderOpen size={15} /> {tx('project.openProject')}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="new" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                {!runtime.usesCompanionApi && (
                  <div style={{ padding: '12px 14px', marginBottom: '14px', background: 'hsl(45 100% 50% / 0.08)', border: '1px solid hsl(45 100% 50% / 0.25)', borderRadius: '10px', fontSize: '12px', color: 'hsl(45 90% 70%)' }}>
                    {tx('project.createRequiresCompanion')}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '6px' }}>{tx('project.projectName')}</label>
                      <input type="text" placeholder="my-awesome-app" value={newName}
                        onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                        style={{ width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: 'hsl(0 0% 0% / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '6px' }}>{tx('project.destinationFolder')}</label>
                    <div style={{ display: 'flex', height: '44px' }}>
                      <input type="text" placeholder="/Users/username/projects" value={newParent}
                        onChange={(e) => { setNewParent(e.target.value); setCreateError(''); }}
                        style={{ flex: 1, padding: '0 14px', background: 'hsl(0 0% 0% / 0.3)', border: '1px solid hsl(var(--border))', borderRight: 'none', borderRadius: '10px 0 0 10px', color: '#fff', fontSize: '13px', outline: 'none' }} />
                      <BrowseBtn onClick={() => browseFolder(setNewParent, 'pick-destination')} />
                    </div>
                    {runtime.usesCompanionApi && (
                      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '11px', marginTop: '6px' }}>
                        {tx('project.destinationHint')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '6px' }}>{tx('project.goalLabel')}</label>
                    <textarea 
                      placeholder={tx('project.goalPlaceholder')}
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      style={{ 
                        width: '100%', minHeight: '80px', padding: '12px 14px', boxSizing: 'border-box', 
                        background: 'hsl(0 0% 0% / 0.3)', border: '1px solid hsl(var(--border))', 
                        borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none',
                        resize: 'vertical'
                      }} 
                    />
                  </div>

                  {createError && (
                    <div style={{ padding: '10px 14px', background: 'hsl(0 100% 10% / 0.5)', border: '1px solid hsl(0 100% 50% / 0.3)', borderRadius: '10px', fontSize: '12px', color: 'hsl(0 100% 70%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <X size={14} /> {createError}
                    </div>
                  )}

                  <button className="btn-primary" onClick={handleCreate} disabled={isCreating || !newName.trim() || !runtime.usesCompanionApi}
                    style={{ background: 'hsl(var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', opacity: (!newName.trim() || isCreating) ? 0.6 : 1 }}>
                    <PlusCircle size={15} /> {isCreating ? tx('project.creating') : tx('project.createProject')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ padding: '10px 24px 14px', display: 'flex', justifyContent: 'space-between', opacity: 0.55, fontSize: '11px', borderTop: '1px solid hsl(var(--border) / 0.2)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Laptop size={11} /> {tx(runtime.labelKey)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Rocket size={11} /> {tx('project.footerAutonomous')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={11} /> {tx('project.footerSecure')}</span>
        </div>
        <div style={{ padding: '0 24px 18px', textAlign: 'center' }}>
          <button
            onClick={() => onOpenSettings?.()}
            style={{
              background: 'transparent',
              border: '1px solid hsl(var(--border) / 0.4)',
              borderRadius: '8px',
              color: 'hsl(var(--text-secondary))',
              fontSize: '12px',
              padding: '7px 12px',
              cursor: 'pointer'
            }}
          >
            {tx('project.openSettings')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProjectSelector;
