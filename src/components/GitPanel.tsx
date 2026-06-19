import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { GitBranch, RefreshCw, Check, FileDiff } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const GitPanel: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [diff, setDiff] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [st, lg] = await Promise.all([
        axios.get(`${API_BASE}/v3/git/status`),
        axios.get(`${API_BASE}/v3/git/log`, { params: { limit: 12 } })
      ]);
      setStatus(st.data);
      setLog(lg.data?.log || []);
      if (st.data?.isRepo) {
        const d = await axios.get(`${API_BASE}/v3/git/diff`);
        setDiff(d.data?.diff || '');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleStageAll = async () => {
    setBusy(true);
    await axios.post(`${API_BASE}/v3/git/stage`, { paths: [] });
    await refresh();
    setBusy(false);
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setBusy(true);
    await axios.post(`${API_BASE}/v3/git/commit`, { message: commitMsg });
    setCommitMsg('');
    await refresh();
    setBusy(false);
  };

  if (!status?.isRepo) {
    return (
      <div style={{ padding: '40px', color: '#888', textAlign: 'center' }}>
        <GitBranch size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <p>{t('git.notRepo')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto', color: '#ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={20} /> {t('git.title')}
          </h2>
          <span style={{ fontSize: '12px', color: '#888' }}>{status.branch} · {status.files?.length || 0} {t('git.changes')}</span>
        </div>
        <button type="button" onClick={refresh} disabled={busy} style={iconBtn}><RefreshCw size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '300px' }}>
        <div>
          <h3 style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{t('git.changedFiles')}</h3>
          <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '8px', maxHeight: '200px', overflow: 'auto' }}>
            {(status.files || []).map((f: any) => (
              <div key={f.file} style={{ fontSize: '12px', padding: '4px 6px', fontFamily: 'monospace' }}>
                <span style={{ color: f.staged ? '#34d399' : '#fbbf24' }}>{f.code}</span> {f.file}
              </div>
            ))}
            {status.clean && <p style={{ color: '#666', fontSize: '12px' }}>{t('git.clean')}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={handleStageAll} disabled={busy || status.clean} style={primaryBtn}>{t('git.stageAll')}</button>
          </div>
          <input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder={t('git.commitMessage')}
            style={{ ...inputStyle, marginTop: '12px' }} />
          <button type="button" onClick={handleCommit} disabled={busy || !commitMsg.trim()} style={{ ...primaryBtn, marginTop: '8px' }}>
            <Check size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{t('git.commit')}
          </button>

          <h3 style={{ fontSize: '13px', color: '#888', margin: '20px 0 8px' }}>{t('git.history')}</h3>
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {log.map((c) => (
              <div key={c.hash} style={{ padding: '6px 0', borderBottom: '1px solid #222' }}>
                <code style={{ color: '#93c5fd' }}>{c.short}</code> {c.message}
                <div style={{ color: '#555' }}>{c.author} · {c.when}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '13px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileDiff size={14} /> {t('git.diff')}
          </h3>
          <pre style={{
            background: '#1a1a1a', borderRadius: '8px', padding: '12px', fontSize: '11px',
            overflow: 'auto', maxHeight: 'calc(100vh - 200px)', whiteSpace: 'pre-wrap', color: '#ccc'
          }}>{diff || t('git.noDiff')}</pre>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', background: '#111', border: '1px solid #333',
  borderRadius: '8px', color: '#eee', fontSize: '13px', boxSizing: 'border-box'
};

const primaryBtn: React.CSSProperties = {
  background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 14px',
  borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
};

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #333', borderRadius: '8px',
  padding: '8px', color: '#888', cursor: 'pointer'
};

export default GitPanel;
