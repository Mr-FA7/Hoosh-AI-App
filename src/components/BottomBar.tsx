import React from 'react';
import { ShieldCheck, Info, AlertTriangle, XCircle, Code, Cpu, Activity, Zap } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';

interface BottomBarProps {
  language?: string;
  errors?: number;
  warnings?: number;
  status?: string;
}

const BottomBar: React.FC<BottomBarProps> = ({ language = 'Javascript', errors = 0, warnings = 0, status = 'Ready' }) => {
  const { t } = useI18n();
  return (
    <div className="bottom-bar" style={{
        height: '24px',
        background: 'hsl(var(--accent) / 0.1)',
        borderTop: '1px solid hsl(var(--border) / 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'hsl(var(--text-secondary))',
        zIndex: 1000,
        position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'hsl(var(--accent))', color: '#000', padding: '0 8px', borderRadius: '2px', fontWeight: 600 }}>
            <Zap size={10} strokeWidth={3} />
            {t('bottomBar.autonomous')}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <XCircle size={12} color="hsl(0 100% 60%)" /> {errors}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <AlertTriangle size={12} color="hsl(45 100% 50%)" /> {warnings}
            </span>
        </div>

        <div style={{ opacity: 0.6 }}>
            {status}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={12} />
            <span>{t('bottomBar.aiLoad')} 12%</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Code size={12} />
            <span>{language}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Cpu size={12} />
            <span>{t('bottomBar.agent')} 7B</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'hsl(var(--accent))' }}>
            <ShieldCheck size={12} />
            <span>{t('bottomBar.sync')}</span>
        </div>
      </div>
    </div>
  );
};

export default BottomBar;
