import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plug, RefreshCw, CheckCircle2, Circle, Monitor } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';
import { checkBridgeSetup, resetCompanionProbeCache } from '../lib/companionProbe';
import { isHostedWebApp } from '../runtimeEnv';

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

  const btn = (href: string, label: string, primary = false) => (
    <a
      href={href}
      download
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
        borderRadius: '8px',
        background: primary ? 'hsl(var(--accent))' : 'transparent',
        border: primary ? 'none' : '1px solid hsl(var(--border))',
        color: primary ? '#fff' : 'hsl(var(--text-primary))',
        fontSize: '12px', fontWeight: primary ? 600 : 500, textDecoration: 'none',
      }}
    >
      <Download size={14} /> {label}
    </a>
  );

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

      <p style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>
        <Monitor size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {t('bridge.oneClickTitle')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {btn('/HooshBridgeSetup.exe', t('bridge.downloadWinExe'), true)}
        {btn('/hoosh-bridge-setup-win.zip', t('bridge.downloadWin'))}
        {btn('/hoosh-bridge-setup-mac.zip', t('bridge.downloadMac'))}
        {btn('/hoosh-local-bridge.zip', t('bridge.downloadExtensionOnly'))}
      </div>

      <ol style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', paddingLeft: '18px', margin: '0 0 12px', lineHeight: 1.6 }}>
        <li>{t('bridge.step1Installer')}</li>
        <li>{t('bridge.step3Reload')}</li>
      </ol>

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

      {companion && (
        <p style={{ marginTop: '10px', fontSize: '11px', color: 'hsl(142 71% 45%)', fontWeight: 600 }}>
          {t('bridge.connected')}
        </p>
      )}
    </div>
  );
};

export default LocalBridgePanel;
