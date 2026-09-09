import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Code, Cpu } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';

interface BottomBarProps {
  language?: string;
  errors?: number;
  warnings?: number;
  status?: string;
  onProblemsClick?: () => void;
  onOpenPalette?: () => void;
  /** Real model currently selected / streaming (from AIPanel). */
  modelName?: string | null;
  modelSource?: string | null;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function shortModelLabel(name: string): string {
  const n = name.trim();
  if (n.length <= 28) return n;
  return `${n.slice(0, 12)}…${n.slice(-12)}`;
}

const BottomBar: React.FC<BottomBarProps> = ({
  language = 'Javascript',
  errors = 0,
  warnings = 0,
  status = 'Ready',
  onProblemsClick,
  onOpenPalette,
  modelName,
  modelSource
}) => {
  const { t } = useI18n();
  const paletteHint = isMac ? t('palette.hintMac') : t('palette.hintWin');
  const modelLabel = modelName ? shortModelLabel(modelName) : t('bottomBar.noModel');
  const sourceHint = modelSource ? ` · ${modelSource}` : '';

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
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={onProblemsClick} role="button" tabIndex={0}>
                <XCircle size={12} color="hsl(0 100% 60%)" /> {errors}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={onProblemsClick} role="button" tabIndex={0}>
                <AlertTriangle size={12} color="hsl(45 100% 50%)" /> {warnings}
            </span>
        </span>

        <div style={{ opacity: 0.6 }}>
            {status}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button
          type="button"
          onClick={onOpenPalette}
          title={t('palette.title')}
          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '11px', padding: 0 }}
        >
          {paletteHint}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Code size={12} />
            <span>{language}</span>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: 220 }}
          title={modelName ? `${modelName}${sourceHint}` : t('bottomBar.noModel')}
        >
            <Cpu size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('bottomBar.model')} {modelLabel}
            </span>
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
