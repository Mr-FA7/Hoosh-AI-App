import React, { useState } from 'react';
import { Download, Plug, RefreshCw, CheckCircle2, Circle } from 'lucide-react';
import { isHostedWebApp } from '../runtimeEnv';
import BridgeStatusLed from './BridgeStatusLed';

type BridgeStatus = {
  extension: boolean;
  companion: boolean;
  connected: boolean;
  checking: boolean;
  hintKey?: string;
  refresh: () => Promise<void>;
};

type Props = { compact?: boolean; status: BridgeStatus };

const LocalBridgePanel: React.FC<Props> = ({ compact = false, status }) => {
  const { connected, checking, refresh } = status;
  const [os] = useState(() => navigator.userAgent.includes('Mac') ? 'mac' : 'win');

  if (!isHostedWebApp()) return null;

  const border = checking ? '#b45309' : connected ? '#16a34a' : '#dc2626';
  const bg    = checking ? 'rgba(180,83,9,.06)' : connected ? 'rgba(22,163,74,.07)' : 'rgba(220,38,38,.05)';

  if (connected) return (
    <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`, background: bg, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <CheckCircle2 size={15} color="#16a34a" />
      <span style={{ color: '#16a34a', fontWeight: 600 }}>Hoosh Companion connected</span>
      <button onClick={() => void refresh()} disabled={checking} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #334155', borderRadius: 6, padding: '3px 8px', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>
        <RefreshCw size={11} style={{ verticalAlign: 'middle' }} />
      </button>
    </div>
  );

  return (
    <div style={{ padding: compact ? '12px 14px' : '16px', borderRadius: 12, border: `1px solid ${border}`, background: bg, marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
          <Plug size={15} /> Local Companion
        </div>
        <BridgeStatusLed connected={connected} extension={status.extension} checking={checking} />
      </div>

      {checking ? (
        <p style={{ fontSize: 12, color: '#94a3b8' }}>Checking for local companion…</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>
            برای دسترسی به فایل‌ها، ترمینال و AI لوکال، یک‌بار Companion رو نصب کنید — بدون نیاز به افزونه.
          </p>

          {/* Big download button */}
          <a
            href={os === 'mac' ? '/hoosh-bridge-setup-mac.zip' : '/HooshBridgeSetup.exe'}
            download
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 18px', borderRadius: 10, background: '#2563eb', color: '#fff',
              fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 10,
            }}
          >
            <Download size={15} />
            {os === 'mac' ? 'دانلود برای macOS' : 'دانلود Hoosh Companion (Windows)'}
          </a>

          <ol style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 18, margin: '0 0 14px', lineHeight: 1.8 }}>
            {os === 'win' ? <>
              <li>فایل <strong>HooshBridgeSetup.exe</strong> را اجرا کنید</li>
              <li>نصب کنید — همه چیز خودکار راه‌اندازی می‌شود</li>
              <li>این صفحه را <strong>Refresh</strong> کنید</li>
            </> : <>
              <li>zip را باز کرده، <strong>HooshCompanion.command</strong> را اجرا کنید</li>
              <li>پنجره ترمینال را باز نگه دارید</li>
              <li>این صفحه را <strong>Refresh</strong> کنید</li>
            </>}
          </ol>

          {/* OS switch */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['win', 'mac'] as const).map(o => (
              <button key={o} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                background: os === o ? '#1e40af' : 'transparent',
                border: `1px solid ${os === o ? '#2563eb' : '#334155'}`,
                color: os === o ? '#fff' : '#94a3b8',
              }}
                onClick={() => {/* readonly for now */}}>
                {o === 'win' ? '🪟 Windows' : '🍎 Mac'}
              </button>
            ))}
          </div>

          {/* Recheck */}
          <button
            onClick={() => void refresh()} disabled={checking}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> {checking ? 'در حال بررسی…' : 'بررسی مجدد اتصال'}
          </button>

          {/* Manual / Firefox details */}
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 11, color: '#64748b', cursor: 'pointer' }}>نصب دستی / Firefox</summary>
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
              <p style={{ marginBottom: 6 }}><strong style={{ color: '#cbd5e1' }}>Chrome:</strong></p>
              <ol style={{ paddingLeft: 16, margin: '0 0 10px' }}>
                <li><a href="/hoosh-local-bridge.zip" download style={{ color: '#60a5fa' }}>دانلود hoosh-local-bridge.zip</a> و Extract</li>
                <li>Chrome ← <code>chrome://extensions</code></li>
                <li>Developer mode را فعال کنید</li>
                <li>Load unpacked ← پوشه Extract شده</li>
              </ol>
              <p style={{ marginBottom: 6 }}><strong style={{ color: '#cbd5e1' }}>Firefox:</strong></p>
              <ol style={{ paddingLeft: 16, margin: 0 }}>
                <li><a href="/hoosh-local-bridge-firefox.zip" download style={{ color: '#60a5fa' }}>دانلود hoosh-local-bridge-firefox.zip</a> و Extract</li>
                <li>Firefox ← <code>about:debugging#/runtime/this-firefox</code></li>
                <li>Load Temporary Add-on ← manifest.json</li>
              </ol>
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default LocalBridgePanel;
