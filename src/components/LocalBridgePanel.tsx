import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plug, RefreshCw, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';
import { checkBridgeSetup, resetCompanionProbeCache } from '../lib/companionProbe';
import { isHostedWebApp } from '../runtimeEnv';

const REPO = 'https://github.com/Mr-FA7/Hoosh-AI-App';

type Props = {
  onConnected?: () => void;
};

const LocalBridgePanel: React.FC<Props> = ({ onConnected }) => {
  const { t } = useI18n();
  const [extension, setExtension] = useState(false);
  const [companion, setCompanion] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!isHostedWebApp()) return;
    setChecking(true);
    resetCompanionProbeCache();
    try {
      const status = await checkBridgeSetup();
      setExtension(status.extension);
      setCompanion(status.companion);
      if (status.companion) onConnected?.();
    } finally {
      setChecking(false);
    }
  }, [onConnected]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!isHostedWebApp()) return null;

  const dot = (ok: boolean) =>
    ok ? <CheckCircle2 size={14} color="hsl(142 71% 45%)" /> : <Circle size={14} color="hsl(var(--text-secondary))" />;

  return (
    <div style={{
      marginBottom: '18px',
      padding: '14px 16px',
      borderRadius: '12px',
      border: '1px solid hsl(var(--accent) / 0.35)',
      background: 'hsl(var(--accent) / 0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 700, fontSize: '13px' }}>
        <Plug size={16} /> {t('bridge.title')}
      </div>
      <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginBottom: '12px', lineHeight: 1.5 }}>
        {t('bridge.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{dot(extension)} {t('bridge.stepExtension')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{dot(companion)} {t('bridge.stepCompanion')}</div>
      </div>

      <ol style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', paddingLeft: '18px', margin: '0 0 12px', lineHeight: 1.6 }}>
        <li>{t('bridge.installCompanion')}</li>
        <li><code style={{ background: 'hsl(0 0% 0% / 0.35)', padding: '2px 6px', borderRadius: '4px' }}>npm run bridge</code></li>
        <li>{t('bridge.installExtension')}</li>
        <li>{t('bridge.reloadSite')}</li>
      </ol>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <a
          href={`${REPO}/tree/main/extensions/hoosh-local-bridge`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
            borderRadius: '8px', background: 'hsl(var(--accent))', color: '#fff',
            fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          }}
        >
          <Download size={14} /> {t('bridge.downloadExtension')}
        </a>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={checking}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
            borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'transparent',
            color: 'hsl(var(--text-primary))', fontSize: '12px', cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> {checking ? t('bridge.checking') : t('bridge.recheck')}
        </button>
        <a
          href={`${REPO}#readme`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 10px',
            fontSize: '11px', color: 'hsl(var(--accent))',
          }}
        >
          {t('bridge.docs')} <ExternalLink size={12} />
        </a>
      </div>

      {companion && (
        <p style={{ marginTop: '10px', fontSize: '11px', color: 'hsl(142 71% 45%)', fontWeight: 600 }}>
          {t('bridge.connected')}
        </p>
      )}
    </div>
  );
};

export default LocalBridgePanel;
