import React, { useState, useEffect } from 'react';
import { MoreHorizontal, MonitorPlay } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LocaleContext';
import {
  ADVANCED_VIEWS,
  BUILD_VIEWS,
  HOME_VIEW,
  PRIMARY_VIEWS,
  SECONDARY_IDS,
  isWorkspaceView,
  type ViewEntry,
  type ViewMode
} from '../shell/viewCatalog';
import AccountMenu from './AccountMenu';
import './Sidebar.css';

export type { ViewMode };

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isDesktop?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ viewMode, setViewMode, isDesktop }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (SECONDARY_IDS.has(viewMode)) setExpanded(true);
  }, [viewMode]);

  const item = (tab: ViewEntry) => {
    const Icon = tab.Icon;
    const agent = tab.audience === 'agent';
    const workspace = tab.id === 'editor';
    const active = workspace ? isWorkspaceView(viewMode) : viewMode === tab.id;
    const title = workspace
      ? t('sidebar.workspace')
      : agent
        ? `${t(tab.labelKey)} — ${t('palette.agentHint')}`
        : t(tab.labelKey);

    return (
      <button
        key={tab.id}
        onClick={() => {
          if (workspace) {
            // Same surface as Home — only leave other tools; don't yank off the composer.
            if (!isWorkspaceView(viewMode)) setViewMode('editor');
            return;
          }
          setViewMode(tab.id);
        }}
        className={`sidebar-item ${active ? 'active' : ''} ${agent ? 'agent-surface' : ''}`}
        title={title}
        aria-label={title}
        aria-current={active ? 'page' : undefined}
      >
        <Icon size={20} />
        {active && (
          <motion.div layoutId="active-nav-indicator" className="sidebar-indicator" />
        )}
      </button>
    );
  };

  const goNewChat = () => setViewMode(HOME_VIEW.id);

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-logo"
        onClick={goNewChat}
        title={t('sidebar.home')}
        aria-label={t('sidebar.home')}
      >
        <img src="/fa7_logo.png" alt="" />
        {isDesktop && (
          <div className="desktop-badge" title="Running in Native Desktop Shell">
            <MonitorPlay size={10} />
          </div>
        )}
      </button>

      <div className="sidebar-nav">
        {PRIMARY_VIEWS.map(item)}

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
            {BUILD_VIEWS.map(item)}
            <div className="sidebar-group-label">{t('sidebar.groupAdvanced')}</div>
            {ADVANCED_VIEWS.map(item)}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <AccountMenu viewMode={viewMode} setViewMode={setViewMode} />
      </div>
    </aside>
  );
};

export default Sidebar;
