import React from 'react';
import { Download, Plug, RefreshCw, CheckCircle2, Circle, Monitor, Rocket } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';
import { isHostedWebApp } from '../runtimeEnv';
import BridgeStatusLed from './BridgeStatusLed';

type BridgeStatus = {
  extension: boolean;
  companion: boolean;
  connected: boolean;
  checking: boolean;
  hintKey?: 'bridge.hintNoExtension' | 'bridge.hintNoCompanion' | 'bridge.hintRefreshPage';
  refresh: () => Promise<void>;
};

type Props = {
  compact?: boolean;
  status: BridgeStatus;
};

const LocalBridgePanel: React.FC<Props> = ({ compact = false, status }) => {
  const { t } = useI18n();
  const { extension, companion, connected, checking, hintKey, refresh } = status;

  if (!isHostedWebApp()) return null;

  const panelBorder = checking
    ? 'hsl(45 93% 47% / 0.45)'
    : connected
      ? 'hsl(142 71% 45% / 0.55)'
      : 'hsl(0 72% 51% / 0.45)';
  const panelBg = checking
    ? 'hsl(45 93% 47% / 0.06)'
    : connected
      ? 'hsl(142 71% 45% / 0.07)'
      : 'hsl(0 72% 51% / 0.05)';

  const dot = (ok: boolean) =>
    ok ? <CheckCircle2 size={14} color="hsl(142 71% 45%)" /> : <Circle size={14} color="hsl(0 72% 51%)" />;

  const btn = (href: string, label: string, primary = false, download = true) => (
    <a
      href={href}
      {...(download ? { download: true } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
        borderRadius: '8px',
        background: primary ? 'hsl(var(--accent))' : 'transparent',
        border: primary ? 'none' : '1px solid hsl(var(--border))',
        color: primary ? '#fff' : 'hsl(var(--text-primary))',
        fontSize: '12px', fontWeight: primary ? 600 : 500, textDecoration: 'none',
      }}
    >
      {download ? <Download size={14} /> : <Rocket size={14} />} {label}
    </a>
  );

  return (
    <div style={{
      marginBottom: '18px',
      padding: compact ? '12px 14px' : '14px 16px',
      borderRadius: '12px',
      border: `1px solid ${panelBorder}`,
      background: panelBg,
      transition: 'border-color 0.25s ease, background 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: compact ? '8px' : '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
          <Plug size={16} /> {t('bridge.title')}
        </div>
        <BridgeStatusLed connected={connected} extension={extension} checking={checking} />
      </div>

      {!connected && !checking && (
        <div style={{ marginBottom: compact ? '8px' : '12px' }}>
          {btn('hoosh-bridge://open', t('bridge.launchDesktop'), true, false)}
        </div>
      )}

      {hintKey && !connected && !checking && (
        <p style={{
          fontSize: '11px',
          color: extension && !companion ? '#f97316' : 'hsl(0 72% 55%)',
          fontWeight: 600,
          marginBottom: compact ? '8px' : '12px',
          lineHeight: 1.55,
          padding: '8px 10px',
          borderRadius: '8px',
          background: extension && !companion ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${extension && !companion ? 'rgba(249,115,22,0.25)' : 'rgba(239,68,68,0.25)'}`,
        }}>
          {t(hintKey)}
        </p>
      )}

      {compact ? (
        <>
          <p style={{ fontSize: '11px', color: 'hsl(142 71% 45%)', fontWeight: 600, marginBottom: '8px', lineHeight: 1.5 }}>
            {t('bridge.connected')}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={checking}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
              borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'transparent',
              color: 'hsl(var(--text-primary))', fontSize: '11px', cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} /> {checking ? t('bridge.checking') : t('bridge.recheck')}
          </button>
        </>
      ) : (
        <>
          {/* Status indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{dot(extension)} Chrome extension</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{dot(companion)} Local companion (port 3001)</div>
          </div>

          {/* ONE-CLICK installer */}
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '6px' }}>
            <Monitor size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Step 1 — install companion + extension (Windows)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {btn('/HooshBridgeSetup.exe', '⬇ Windows Installer (.exe)', true)}
            {btn('/hoosh-bridge-setup-mac.zip', '⬇ macOS (.zip)')}
          </div>
          <p style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginBottom: '14px', lineHeight: 1.55 }}>
            Run the installer → it sets up companion + extension automatically → restart Chrome → refresh this page.
          </p>

          {/* MANUAL — Chrome */}
          <details style={{ marginBottom: '10px' }}>
            <summary style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }}>
              🌐 Chrome — load extension manually
            </summary>
            <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid hsl(var(--border))' }}>
              {btn('/hoosh-local-bridge.zip', '⬇ Chrome extension (.zip)')}
              <ol style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', paddingLeft: '16px', margin: '8px 0 0', lineHeight: 1.7 }}>
                <li>Unzip <code>hoosh-local-bridge.zip</code></li>
                <li>Open Chrome → go to <code>chrome://extensions</code></li>
                <li>Enable <strong>Developer mode</strong> (top-right toggle)</li>
                <li>Click <strong>Load unpacked</strong> → select the unzipped folder</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </details>

          {/* MANUAL — Firefox */}
          <details style={{ marginBottom: '14px' }}>
            <summary style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }}>
              🦊 Firefox — load extension manually
            </summary>
            <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid hsl(var(--border))' }}>
              {btn('/hoosh-local-bridge-firefox.zip', '⬇ Firefox extension (.zip)')}
              <ol style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', paddingLeft: '16px', margin: '8px 0 0', lineHeight: 1.7 }}>
                <li>Unzip <code>hoosh-local-bridge-firefox.zip</code></li>
                <li>Open Firefox → go to <code>about:debugging#/runtime/this-firefox</code></li>
                <li>Click <strong>Load Temporary Add-on…</strong></li>
                <li>Select <code>manifest.json</code> inside the unzipped folder</li>
                <li>Refresh this page</li>
              </ol>
              <p style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
                Note: Temporary add-ons are removed when Firefox restarts. For permanent install, use Firefox Developer Edition.
              </p>
            </div>
          </details>

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
        </>
      )}
    </div>
  );
};

export default LocalBridgePanel;
