import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { PlayCircle, RefreshCcw, ExternalLink, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';
import AgentPreviewToolbar from './AgentPreviewToolbar';
import AgentVisualOverlay from './AgentVisualOverlay';

type PreviewMeta = {
  url?: string | null;
  ok?: boolean;
  reason?: string;
  projectName?: string;
  projectRoot?: string;
  devCommand?: string;
  suggestedPorts?: number[];
  blockedShellUrl?: string;
  fa7UiPort?: number;
  source?: string;
};

interface ActivePreviewViewProps {
  projectRoot?: string | null;
}

const ActivePreviewView: React.FC<ActivePreviewViewProps> = ({ projectRoot }) => {
  const { t } = useI18n();
  const [previewUrl, setPreviewUrl] = useState('');
  const [companionUrl, setCompanionUrl] = useState(API_BASE.replace(/\/api$/, ''));
  const [input, setInput] = useState('');
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const hasElectron = typeof (window as any).electronAPI !== 'undefined';

  const loadPreviewMeta = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/v3/project/preview-url`);
      const data = r.data as PreviewMeta;
      setMeta(data);
      if (r.data?.companionUrl) setCompanionUrl(String(r.data.companionUrl));

      const url = String(data?.url || '').trim();
      if (url) {
        setPreviewUrl(url);
        setInput(url);
      } else {
        setPreviewUrl('');
        const guess = data?.suggestedPorts?.[0];
        setInput(guess ? `http://127.0.0.1:${guess}` : '');
      }
    } catch {
      setMeta({ ok: false, reason: 'error' });
      setPreviewUrl('');
      setInput('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreviewMeta();
  }, [loadPreviewMeta, projectRoot]);

  const applyPreviewUrl = async (raw: string) => {
    const next = raw.trim();
    if (!next) {
      setPreviewUrl('');
      return;
    }
    setPreviewUrl(next);
    setFrameKey((k) => k + 1);
    try {
      await axios.post(`${API_BASE}/v3/project/preview-url`, { url: next });
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : String(e);
      if (msg) window.alert(msg);
    }
  };

  const openExternal = async () => {
    const u = input.trim() || previewUrl;
    if (!u) return;
    try {
      await axios.post(`${API_BASE}/shell/open-external-url`, { url: u });
    } catch {
      window.open(u, '_blank');
    }
  };

  const noServer = !loading && !previewUrl;
  const projectLabel = meta?.projectName || projectRoot?.split('/').pop() || t('preview.unknownProject');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#0a0a0a' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        <PlayCircle size={18} color="hsl(var(--accent))" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{t('preview.title')}</span>
        <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600 }}>{projectLabel}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void applyPreviewUrl(input.trim())}
          dir="ltr"
          placeholder={t('preview.urlPlaceholder')}
          style={{
            flex: 1,
            minWidth: '200px',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#fff',
            fontSize: '13px'
          }}
        />
        <button
          type="button"
          onClick={() => void applyPreviewUrl(input.trim())}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'hsl(var(--accent))', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
        >
          {t('preview.load')}
        </button>
        <button type="button" onClick={() => void loadPreviewMeta()} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer' }} title={t('preview.rescan')}>
          <RefreshCcw size={14} />
        </button>
        <button type="button" onClick={() => void openExternal()} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <ExternalLink size={14} />
          {t('browser.system')}
        </button>
      </div>

      {noServer && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#fcd34d', fontSize: '12px', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>{t('preview.noDevServerTitle')}</strong>
              <div style={{ marginTop: '6px' }}>{t('preview.noDevServerBody').replace('{project}', projectLabel)}</div>
              {meta?.devCommand ? (
                <code style={{ display: 'inline-block', marginTop: '8px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.35)', color: '#fef3c7' }}>
                  {meta.devCommand}
                </code>
              ) : null}
              {meta?.blockedShellUrl ? (
                <div style={{ marginTop: '8px', color: '#fde68a' }}>
                  {t('preview.blockedShell').replace('{url}', meta.blockedShellUrl)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <AgentPreviewToolbar pageUrl={previewUrl || input} pickHint={t('preview.pickElectronHint')} />

      <p style={{ margin: 0, padding: '8px 16px', fontSize: '11px', color: '#71717a', borderBottom: '1px solid #1a1a1a' }}>
        {previewUrl
          ? t('preview.hintRunning').replace('{companion}', companionUrl).replace('{project}', projectLabel)
          : t('preview.hint').replace('{companion}', companionUrl)}
      </p>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <AgentVisualOverlay enabled />
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>{t('preview.loading')}</div>
        ) : previewUrl ? (
          hasElectron ? (
            <webview key={frameKey} src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowpopups={true} />
          ) : (
            <iframe
              key={frameKey}
              title="active-preview"
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          )
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '13px', padding: '24px', textAlign: 'center', lineHeight: 1.6 }}>
            {t('preview.enterUrl')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivePreviewView;
