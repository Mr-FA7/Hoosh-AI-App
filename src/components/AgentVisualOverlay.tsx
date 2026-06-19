import React, { useEffect, useMemo, useState } from 'react';
import { MousePointer2, Keyboard, Camera, CircleDot } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';
import {
  subscribeAgentVisualStream,
  type AgentVisualAction
} from '../lib/agentVisualBridge';

type Ripple = { id: number; x: number; y: number };
type LogItem = { id: number; text: string; ts: number };

interface AgentVisualOverlayProps {
  enabled?: boolean;
}

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

function toPercent(action: AgentVisualAction, viewport = DEFAULT_VIEWPORT) {
  const w = action.viewport?.width || viewport.width;
  const h = action.viewport?.height || viewport.height;
  const x = Number(action.x || 0);
  const y = Number(action.y || 0);
  return {
    left: `${Math.max(0, Math.min(100, (x / w) * 100))}%`,
    top: `${Math.max(0, Math.min(100, (y / h) * 100))}%`
  };
}

const AgentVisualOverlay: React.FC<AgentVisualOverlayProps> = ({ enabled = true }) => {
  const { t } = useI18n();
  const [cursor, setCursor] = useState<{ left: string; top: string } | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [typing, setTyping] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);
  const [space, setSpace] = useState<'viewport' | 'screen'>('viewport');

  const pushLog = (text: string) => {
    setLog((prev) => [{ id: Date.now() + Math.random(), text, ts: Date.now() }, ...prev].slice(0, 8));
  };

  useEffect(() => {
    if (!enabled) return;
    let typingTimer: number | undefined;
    const stop = subscribeAgentVisualStream((action) => {
      setLive(true);
      window.setTimeout(() => setLive(false), 4000);
      const kind = String(action.type || '');
      const actionSpace = action.space === 'screen' ? 'screen' : 'viewport';
      setSpace(actionSpace);

      if (kind === 'move' || kind === 'click') {
        setCursor(toPercent(action));
      }
      if (kind === 'click') {
        const pos = toPercent(action);
        const id = Date.now() + Math.random();
        setRipples((prev) => [...prev, {
          id,
          x: Number.parseFloat(pos.left),
          y: Number.parseFloat(pos.top)
        }]);
        window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700);
        pushLog(t('preview.visual.click').replace('{x}', String(Math.round(Number(action.x || 0)))).replace('{y}', String(Math.round(Number(action.y || 0)))));
      }
      if (kind === 'type') {
        const text = String(action.text || '');
        setTyping(text);
        if (typingTimer) window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(() => setTyping(''), 2600);
        pushLog(t('preview.visual.type').replace('{text}', text.slice(0, 48)));
      }
      if (kind === 'screenshot' && action.image) {
        setScreenshot(`data:image/png;base64,${action.image}`);
        pushLog(t('preview.visual.screenshot'));
      }
      if (kind === 'status' && action.message) {
        pushLog(action.message);
      }
    });
    return () => {
      if (typingTimer) window.clearTimeout(typingTimer);
      stop();
    };
  }, [enabled, t]);

  const badge = useMemo(
    () => (live ? t('preview.visual.live') : t('preview.visual.idle')),
    [live, t]
  );

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'hidden'
      }}
    >
      {screenshot && space === 'screen' ? (
        <img
          src={screenshot}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', opacity: 0.92 }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '999px',
          background: live ? 'rgba(34,197,94,0.18)' : 'rgba(0,0,0,0.55)',
          border: `1px solid ${live ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.12)'}`,
          color: live ? '#86efac' : '#d4d4d8',
          fontSize: '11px',
          fontWeight: 700
        }}
      >
        <CircleDot size={12} />
        {badge}
        <span style={{ opacity: 0.7 }}>· {space === 'screen' ? t('preview.visual.desktop') : t('preview.visual.browser')}</span>
      </div>

      {cursor ? (
        <div
          style={{
            position: 'absolute',
            left: cursor.left,
            top: cursor.top,
            transform: 'translate(-4px, -4px)',
            transition: 'left 180ms linear, top 180ms linear',
            filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.8))'
          }}
        >
          <MousePointer2 size={22} color="#c4b5fd" fill="#7c3aed" />
        </div>
      ) : null}

      {ripples.map((r) => (
        <span
          key={r.id}
          style={{
            position: 'absolute',
            left: `${r.x}%`,
            top: `${r.y}%`,
            width: '28px',
            height: '28px',
            marginLeft: '-14px',
            marginTop: '-14px',
            borderRadius: '999px',
            border: '2px solid rgba(168,85,247,0.9)',
            animation: 'hoosh-agent-click 700ms ease-out forwards'
          }}
        />
      ))}

      {typing ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '18px',
            transform: 'translateX(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: 'min(90%, 640px)',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(15,15,20,0.88)',
            border: '1px solid rgba(168,85,247,0.35)',
            color: '#fafafa',
            fontSize: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
          }}
        >
          <Keyboard size={14} color="#c4b5fd" />
          <span dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typing}</span>
        </div>
      ) : null}

      {log.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: '44px',
            right: '10px',
            width: 'min(280px, 42vw)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {log.slice(0, 5).map((item) => (
            <div
              key={item.id}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e4e4e7',
                fontSize: '10px',
                lineHeight: 1.35
              }}
            >
              {item.text}
            </div>
          ))}
        </div>
      ) : null}

      {screenshot && space === 'viewport' ? (
        <div style={{ position: 'absolute', right: '10px', bottom: '10px', width: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', background: 'rgba(0,0,0,0.65)', color: '#ddd', fontSize: '9px' }}>
            <Camera size={10} /> {t('preview.visual.agentSees')}
          </div>
          <img src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`} alt="" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : null}

      <style>{`
        @keyframes hoosh-agent-click {
          0% { transform: scale(0.4); opacity: 0.95; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default AgentVisualOverlay;
