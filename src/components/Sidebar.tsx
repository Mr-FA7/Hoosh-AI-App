import React, { useState, useEffect } from 'react';
import { Layout, Cpu, Terminal, Globe, PlayCircle, Activity, Settings, Package, MonitorPlay, GitBranch, AlertTriangle, Layers, Sparkles, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LocaleContext';
import './Sidebar.css';

export type ViewMode =
  | 'editor' | 'engine' | 'terminal' | 'vmlab' | 'stacks' | 'workflows' | 'media'
  | 'browser' | 'preview' | 'marketplace' | 'uat' | 'settings' | 'git' | 'problems';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: any) => void;
  isDesktop?: boolean;
}

/**
 * The rail used to be 14 undifferentiated icons. Everything is still reachable,
 * but it is now tiered so the daily loop is obvious and the agent-infrastructure
 * surfaces (VM sandboxes, UAT runs, engine internals) stop competing with it.
 *
 * primary  — the everyday editor loop
 * build    — creation surfaces you visit deliberately
 * advanced — mostly driven by the agent; a human opens them to inspect
 */
const PRIMARY = [
  { id: 'editor', icon: <Layout size={20} />, labelKey: 'sidebar.neuralEditor' },
  { id: 'terminal', icon: <Terminal size={20} />, labelKey: 'sidebar.terminal' },
  { id: 'git', icon: <GitBranch size={20} />, labelKey: 'sidebar.git' },
  { id: 'problems', icon: <AlertTriangle size={20} />, labelKey: 'sidebar.problems' },
  { id: 'preview', icon: <PlayCircle size={20} />, labelKey: 'sidebar.activePreview' }
] as const;

const BUILD = [
  { id: 'marketplace', icon: <Package size={20} />, labelKey: 'sidebar.giraMarketplace' },
  { id: 'stacks', icon: <Layers size={20} />, labelKey: 'sidebar.stacks' },
  { id: 'workflows', icon: <GitBranch size={20} />, labelKey: 'sidebar.workflows' },
  { id: 'media', icon: <Sparkles size={20} />, labelKey: 'sidebar.mediaStudio' },
  { id: 'browser', icon: <Globe size={20} />, labelKey: 'sidebar.worldView' }
] as const;

const ADVANCED = [
  { id: 'engine', icon: <Cpu size={20} />, labelKey: 'sidebar.giraEngineering' },
  { id: 'vmlab', icon: <MonitorPlay size={20} />, labelKey: 'sidebar.vmMatrix' },
  { id: 'uat', icon: <Activity size={20} />, labelKey: 'sidebar.uatFeedback' }
] as const;

const SECONDARY_IDS = new Set<string>([...BUILD, ...ADVANCED].map((t) => t.id));

const Sidebar: React.FC<SidebarProps> = ({ viewMode, setViewMode, isDesktop }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  // Never hide the view the user is actually in.
  useEffect(() => {
    if (SECONDARY_IDS.has(viewMode)) setExpanded(true);
  }, [viewMode]);

  const item = (tab: { id: string; icon: React.ReactNode; labelKey: string }) => (
    <button
      key={tab.id}
      onClick={() => setViewMode(tab.id)}
      className={`sidebar-item ${viewMode === tab.id ? 'active' : ''}`}
      title={t(tab.labelKey)}
      aria-label={t(tab.labelKey)}
      aria-current={viewMode === tab.id ? 'page' : undefined}
    >
      {tab.icon}
      {viewMode === tab.id && (
        <motion.div layoutId="active-nav-indicator" className="sidebar-indicator" />
      )}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/fa7_logo.png" alt="FA7" />
        {isDesktop && (
          <div className="desktop-badge" title="Running in Native Desktop Shell">
            <MonitorPlay size={10} />
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        {PRIMARY.map(item)}

        <div className="sidebar-divider" role="separator" />

        <button
          className={`sidebar-item sidebar-more ${expanded ? 'open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? t('sidebar.showLess') : t('sidebar.showMore')}
          aria-label={expanded ? t('sidebar.showLess') : t('sidebar.showMore')}
          aria-expanded={expanded}
        >
          <MoreHorizontal size={20} />
        </button>

        {expanded && (
          <>
            <div className="sidebar-group-label">{t('sidebar.groupBuild')}</div>
            {BUILD.map(item)}
            <div className="sidebar-group-label">{t('sidebar.groupAdvanced')}</div>
            {ADVANCED.map(item)}
          </>
        )}
      </div>

      {/* Settings is a destination, not part of the working loop — pin it. */}
      <div className="sidebar-footer">
        {item({ id: 'settings', icon: <Settings size={20} />, labelKey: 'sidebar.neuralConfig' })}
      </div>
    </aside>
  );
};

export default Sidebar;
