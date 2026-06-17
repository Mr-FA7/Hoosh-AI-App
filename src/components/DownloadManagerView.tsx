import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, FolderDown } from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type GiraJobSummary = {
  id: string;
  status: string;
  url: string;
  mode?: string;
  engine?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  exitCode?: number | null;
};

type Readiness = {
  ok?: boolean;
  hasMain?: boolean;
  pythonBin?: string | null;
};

interface DownloadManagerViewProps {
  /** From workspace tab — URL the assistant picked for direct download */
  initialUrl?: string;
}

/**
 * Gira — same as running `main.py --download-url …` with cwd on the FA7 server’s configured project tree
 * (fixed path in giraBdtmKernel; same behavior as running from that folder).
 */
const DownloadManagerView: React.FC<DownloadManagerViewProps> = ({ initialUrl }) => {
  const { t } = useI18n();
  const [url, setUrl] = useState(initialUrl || '');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [jobs, setJobs] = useState<GiraJobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  const poll = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/v3/gira/status`);
      if (r.data?.ok) {
        const rdy = r.data.ready;
        setReady(typeof rdy === 'boolean' ? rdy : !!(r.data.readiness && r.data.readiness.ok));
        setReadiness((r.data.readiness as Readiness) || null);
        setProjectRoot(typeof r.data.projectRoot === 'string' ? r.data.projectRoot : '');
        setJobs(Array.isArray(r.data.jobs) ? r.data.jobs : []);
      }
    } catch {
      setReady(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), 2500);
    return () => clearInterval(id);
  }, [poll]);

  const startDownload = async () => {
    const clean = url.trim();
    const ok =
      /^https?:\/\//i.test(clean) ||
      /^magnet:\?/i.test(clean);
    if (!ok) {
      setError(t('gira.urlError'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await axios.post(`${API}/v3/gira/download/direct`, { url: clean });
      if (!r.data?.ok) {
        setError(String(r.data?.error || 'Failed to start download.'));
        return;
      }
      await poll();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(msg || (e instanceof Error ? e.message : 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'hsl(var(--bg-main))',
        color: 'hsl(var(--text-primary))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '14px 18px',
          borderBottom: '1px solid hsl(var(--border) / 0.45)',
          background: 'hsl(var(--bg-sidebar) / 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <FolderDown size={20} color="hsl(var(--accent))" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>{t('gira.title')}</div>
            <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>{t('gira.blurb')}</div>
          </div>
        </div>
        {projectRoot ? (
          <div
            dir="ltr"
            style={{
              fontSize: '10px',
              color: 'hsl(var(--text-secondary))',
              marginBottom: '8px',
              wordBreak: 'break-all',
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'hsl(var(--bg-panel) / 0.5)',
              border: '1px solid hsl(var(--border) / 0.35)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'hsl(var(--accent))' }}>{t('gira.workingTree')}</span> {projectRoot}
          </div>
        ) : null}
        {ready === false && (
          <div
            style={{
              fontSize: '11px',
              color: '#fbbf24',
              marginBottom: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'hsl(45 80% 15% / 0.35)',
              border: '1px solid hsl(45 60% 30% / 0.5)',
            }}
          >
            {t('gira.notReady')}
            {readiness && !readiness.hasMain ? t('gira.noMain') : null}
            {readiness && !readiness.pythonBin ? t('gira.noPython') : null}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <input
            type="url"
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void startDownload()}
            placeholder={t('gira.urlPlaceholder')}
            style={{
              flex: '1 1 220px',
              minWidth: '180px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border) / 0.55)',
              background: 'hsl(var(--bg-panel))',
              color: 'hsl(var(--text-primary))',
              fontSize: '13px',
              fontFamily: 'ui-monospace, monospace',
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDownload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: busy ? 'hsl(var(--text-secondary) / 0.25)' : 'hsl(var(--accent))',
              color: '#0a0a0a',
              fontWeight: 700,
              fontSize: '13px',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            <Download size={16} />
            {busy ? '…' : t('gira.startDownload')}
          </button>
          <button
            type="button"
            onClick={() => void poll()}
            title={t('gira.refreshStatus')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border) / 0.5)',
              background: 'transparent',
              color: 'hsl(var(--text-secondary))',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {error ? (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#f87171' }}>{error}</div>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: 'hsl(var(--text-secondary))' }}>
          {t('gira.recentJobs')}
        </div>
        {jobs.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: 0, opacity: 0.85 }}>
            {t('gira.noJobs')}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jobs.map((j) => (
              <li
                key={j.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border) / 0.4)',
                  background: 'hsl(var(--bg-panel) / 0.4)',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'hsl(var(--accent))' }}>{j.status}</span>
                  <span style={{ fontSize: '10px', opacity: 0.75 }}>
                    {[j.mode, j.engine].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span style={{ opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>{j.id.slice(0, 12)}…</span>
                </div>
                <div
                  dir="ltr"
                  style={{
                    marginTop: '6px',
                    wordBreak: 'break-all',
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  {j.url || '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DownloadManagerView;
