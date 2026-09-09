import React, { useState, useEffect } from 'react';
import { MoreHorizontal, MonitorPlay } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LocaleContext';
import {
  ADVANCED_VIEWS,
  BUILD_VIEWS,
  PRIMARY_VIEWS,
  SECONDARY_IDS,
  SETTINGS_VIEW,
  type ViewEntry,
  type ViewMode
} from '../shell/viewCatalog';
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
    const title = agent ? `${t(tab.labelKey)} — ${t('palette.agentHint')}` : t(tab.labelKey);
    return (
      <button
        key={tab.id}
        onClick={() => setViewMode(tab.id)}
        className={`sidebar-item ${viewMode === tab.id ? 'active' : ''} ${agent ? 'agent-surface' : ''}`}
        title={title}
        aria-label={title}
        aria-current={viewMode === tab.id ? 'page' : undefined}
      >
        <Icon size={20} />
        {viewMode === tab.id && (
          <motion.div layoutId="active-nav-indicator" className="sidebar-indicator" />
        )}
      </button>
    );
  };

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
        {item(SETTINGS_VIEW)}
      </div>
    </aside>
  );
};

export default Sidebar;
