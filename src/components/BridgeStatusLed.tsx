import React from 'react';
import { useI18n } from '../i18n/LocaleContext';

type Props = {
  connected: boolean;
  checking: boolean;
  prominent?: boolean;
};

const BridgeStatusLed: React.FC<Props> = ({ connected, checking, prominent = false }) => {
  const { t } = useI18n();

  const ledColor = checking ? '#eab308' : connected ? '#22c55e' : '#ef4444';
  const ledGlow = checking
    ? '0 0 12px 3px rgba(234,179,8,0.6)'
    : connected
      ? '0 0 14px 4px rgba(34,197,94,0.75)'
      : '0 0 12px 3px rgba(239,68,68,0.55)';
  const statusLabel = checking
    ? t('bridge.statusChecking')
    : connected
      ? t('bridge.statusConnected')
      : t('bridge.statusDisconnected');
  const borderColor = checking
    ? 'rgba(234,179,8,0.5)'
    : connected
      ? 'rgba(34,197,94,0.55)'
      : 'rgba(239,68,68,0.5)';
  const bgColor = checking
    ? 'rgba(234,179,8,0.12)'
    : connected
      ? 'rgba(34,197,94,0.12)'
      : 'rgba(239,68,68,0.1)';

  const ledSize = prominent ? 14 : 11;
  const fontSize = prominent ? 13 : 11;
  const padding = prominent ? '8px 14px' : '4px 10px';

  return (
    <>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: prominent ? 10 : 8,
          padding,
          borderRadius: '999px',
          border: `1px solid ${borderColor}`,
          background: bgColor,
        }}
        title={statusLabel}
        aria-label={statusLabel}
      >
        <span
          style={{
            width: ledSize,
            height: ledSize,
            borderRadius: '50%',
            background: ledColor,
            boxShadow: ledGlow,
            flexShrink: 0,
            animation: checking || connected ? 'bridge-led-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <span style={{ fontSize, fontWeight: 700, color: ledColor, letterSpacing: '0.02em' }}>
          {statusLabel}
        </span>
      </div>
      <style>{`
        @keyframes bridge-led-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.9); }
        }
      `}</style>
    </>
  );
};

export default BridgeStatusLed;
