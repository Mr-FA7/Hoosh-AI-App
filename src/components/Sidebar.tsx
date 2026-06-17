import React from 'react';
import { Layout, Cpu, Terminal, Globe, PlayCircle, Activity, Settings, Package, MonitorPlay } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LocaleContext';
import './Sidebar.css';

interface SidebarProps {
  viewMode: 'editor' | 'engine' | 'terminal' | 'vmlab' | 'browser' | 'preview' | 'marketplace' | 'uat' | 'settings';
  setViewMode: (mode: any) => void;
  isDesktop?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ viewMode, setViewMode, isDesktop }) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'editor', icon: <Layout size={20} />, labelKey: 'sidebar.neuralEditor' as const },
    { id: 'engine', icon: <Cpu size={20} />, labelKey: 'sidebar.giraEngineering' as const },
    { id: 'terminal', icon: <Terminal size={20} />, labelKey: 'sidebar.terminal' as const },
    { id: 'vmlab', icon: <MonitorPlay size={20} />, labelKey: 'sidebar.vmMatrix' as const },
    { id: 'browser', icon: <Globe size={20} />, labelKey: 'sidebar.worldView' as const },
    { id: 'preview', icon: <PlayCircle size={20} />, labelKey: 'sidebar.activePreview' as const },
    { id: 'marketplace', icon: <Package size={20} />, labelKey: 'sidebar.giraMarketplace' as const },
    { id: 'uat', icon: <Activity size={20} />, labelKey: 'sidebar.uatFeedback' as const },
    { id: 'settings', icon: <Settings size={20} />, labelKey: 'sidebar.neuralConfig' as const },
  ] as const;

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
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`sidebar-item ${viewMode === tab.id ? 'active' : ''}`}
            title={t(tab.labelKey)}
          >
            {tab.icon}
            {viewMode === tab.id && (
              <motion.div 
                layoutId="active-nav-indicator"
                className="sidebar-indicator"
              />
            )}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
