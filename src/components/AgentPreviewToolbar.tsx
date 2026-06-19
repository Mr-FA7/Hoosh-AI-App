import React, { useState } from 'react';
import axios from 'axios';
import { Camera, MousePointer2, Send, FlaskConical, Server, Loader2 } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';
import { injectAgentPrompt, startAgentTestMission } from '../lib/agentContextBridge';

interface AgentPreviewToolbarProps {
  pageUrl: string;
  /** When true, show hint that element picking needs Electron/same-origin */
  pickHint?: string;
}

const AgentPreviewToolbar: React.FC<AgentPreviewToolbarProps> = ({ pageUrl, pickHint }) => {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'capture' | 'pick' | null>(null);

  const url = String(pageUrl || '').trim();

  const sendContext = (extra = '') => {
    if (!url) {
      window.alert(t('preview.noUrl'));
      return;
    }
    injectAgentPrompt(
      `${t('preview.contextPrefix')}\nURL: ${url}${extra ? `\n\n${extra}` : ''}\n\n${t('preview.contextSuffix')}`
    );
  };

  const captureToAgent = async () => {
    if (!url) {
      window.alert(t('preview.noUrl'));
      return;
    }
    setBusy('capture');
    try {
      const r = await axios.post(`${API_BASE}/v3/browser/capture`, { url });
      const data = r.data || {};
      if (!data.ok) {
        window.alert(data.error || t('preview.captureFailed'));
        return;
      }
      const lines = [
        t('preview.screenshotPrefix'),
        `URL: ${data.url || url}`,
        data.title ? `Title: ${data.title}` : '',
        data.text ? `\n${t('preview.visibleText')}:\n${String(data.text).slice(0, 4000)}` : '',
        data.screenshot
          ? `\n[${t('preview.screenshotAttached')} — base64 PNG ${Math.round(String(data.screenshot).length / 1024)}KB]`
          : ''
      ].filter(Boolean);
      injectAgentPrompt(lines.join('\n'));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : String(e);
      window.alert(msg || t('preview.captureFailed'));
    } finally {
      setBusy(null);
    }
  };

  const pickElement = async () => {
    if (!url) {
      window.alert(t('preview.noUrl'));
      return;
    }
    setBusy('pick');
    try {
      const r = await axios.post(`${API_BASE}/v3/browser/pick-context`, { url });
      const data = r.data || {};
      if (!data.ok) {
        window.alert(data.error || pickHint || t('preview.pickFailed'));
        return;
      }
      injectAgentPrompt(
        `${t('preview.pickPrefix')}\nURL: ${data.url || url}\nElement: \`${data.selector || 'body'}\`\n\n${data.excerpt || ''}`
      );
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : String(e);
      window.alert(msg || t('preview.pickFailed'));
    } finally {
      setBusy(null);
    }
  };

  const runTestMission = () => {
    if (!url) {
      window.alert(t('preview.noUrl'));
      return;
    }
    startAgentTestMission(
      `${t('preview.testMissionGoal')}\n\nURL: ${url}\n\n${t('preview.testMissionSteps')}`
    );
  };

  const showBackend = async () => {
    try {
      const [sys, health] = await Promise.all([
        axios.get(`${API_BASE}/v3/system/information`),
        axios.get(`${API_BASE}/v3/engines/health`)
      ]);
      injectAgentPrompt(
        `${t('preview.backendPrefix')}\nCompanion: ${API_BASE}\nPreview: ${url || '—'}\n\n` +
          `\`\`\`json\n${JSON.stringify({ system: sys.data, engines: health.data?.health }, null, 2).slice(0, 6000)}\n\`\`\``
      );
    } catch (e: unknown) {
      injectAgentPrompt(`${t('preview.backendPrefix')}\n${API_BASE}\n${String(e)}`);
    }
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e4e4e7',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(30,30,40,0.95) 0%, rgba(15,15,20,0.9) 100%)',
        flexShrink: 0
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: '#a78bfa', alignSelf: 'center', marginRight: '4px' }}>
        {t('preview.agentTools')}
      </span>
      <button type="button" style={btnStyle} onClick={() => sendContext()} title={t('preview.sendContextHint')}>
        <Send size={14} />
        {t('preview.sendContext')}
      </button>
      <button type="button" style={btnStyle} onClick={() => void captureToAgent()} disabled={busy === 'capture'} title={t('preview.screenshotHint')}>
        {busy === 'capture' ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
        {t('preview.screenshot')}
      </button>
      <button type="button" style={btnStyle} onClick={() => void pickElement()} disabled={busy === 'pick'} title={t('preview.pickHint')}>
        {busy === 'pick' ? <Loader2 size={14} /> : <MousePointer2 size={14} />}
        {t('preview.pickElement')}
      </button>
      <button type="button" style={{ ...btnStyle, borderColor: 'rgba(34,197,94,0.35)', color: '#86efac' }} onClick={runTestMission} title={t('preview.testHint')}>
        <FlaskConical size={14} />
        {t('preview.testWithAgent')}
      </button>
      <button type="button" style={btnStyle} onClick={() => void showBackend()} title={t('preview.backendHint')}>
        <Server size={14} />
        {t('preview.showBackend')}
      </button>
    </div>
  );
};

export default AgentPreviewToolbar;
