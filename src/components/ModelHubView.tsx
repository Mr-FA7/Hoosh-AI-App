/**
 * Model Hub — product face of Model Gateway (Phase 4).
 * Categories: Local / Cloud / Custom. Free-first; no Hoosh token billing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Cpu, Plus, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';
import EngineView from './EngineView';

type ProviderRow = {
  id?: string;
  name?: string;
  kind?: string;
  baseUrl?: string;
  enabled?: boolean;
};

const ModelHubView: React.FC = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'hub' | 'engine'>('hub');
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [models, setModels] = useState<unknown[]>([]);
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem('hoosh_privacy_mode') || 'hybrid'; } catch { return 'hybrid'; }
  });
  const [customUrl, setCustomUrl] = useState('http://127.0.0.1:1234/v1');
  const [customName, setCustomName] = useState('Custom OpenAI-compatible');
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfg, cat] = await Promise.all([
        axios.get(`${API_BASE}/v3/providers/config`).catch(() => ({ data: {} })),
        axios.get(`${API_BASE}/v3/providers/models`).catch(() =>
          axios.get(`${API_BASE}/ai/models/catalog`).catch(() => ({ data: {} }))
        )
      ]);
      const list = cfg.data?.providers || cfg.data?.config?.providers || [];
      setProviders(Array.isArray(list) ? list : Object.entries(list || {}).map(([id, v]) => ({ id, ...(v as object) })));
      const m = cat.data?.models || cat.data?.items || [];
      setModels(Array.isArray(m) ? m : []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'error');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setPrivacyMode = (mode: string) => {
    setPrivacy(mode);
    try { localStorage.setItem('hoosh_privacy_mode', mode); } catch { /* ignore */ }
  };

  const addCustom = async () => {
    try {
      await axios.post(`${API_BASE}/v3/providers/catalog/apply`, {
        provider: {
          id: `custom-${Date.now()}`,
          name: customName,
          kind: 'openai-compatible',
          baseUrl: customUrl,
          enabled: true
        }
      });
      setMsg(t('modelHub.added'));
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t('modelHub.addFailed'));
    }
  };

  const localOnly = privacy === 'local-only' || privacy === 'strict-private';

  const filtered = providers.filter((p) => {
    const kind = String(p.kind || p.name || '').toLowerCase();
    const isLocal = /ollama|lmstudio|llama|local|vllm/.test(kind) || /11434|1234/.test(String(p.baseUrl || ''));
    if (localOnly && !isLocal) return false;
    return true;
  });

  if (tab === 'engine') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
          <button type="button" onClick={() => setTab('hub')} style={linkBtn}>{t('modelHub.backHub')}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><EngineView /></div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, maxWidth: 880, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Cpu size={20} color="hsl(var(--accent))" />
          <h1 style={{ margin: 0, fontSize: 20 }}>{t('modelHub.title')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setTab('engine')} style={btn}>{t('modelHub.openEngine')}</button>
          <button type="button" onClick={() => void refresh()} style={btn}><RefreshCw size={14} /></button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('modelHub.hint')}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['local-only', 'hybrid', 'cloud', 'strict-private'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPrivacyMode(m)}
            style={{
              ...btn,
              background: privacy === m ? 'hsl(var(--accent) / 0.2)' : 'transparent',
              borderColor: privacy === m ? 'hsl(var(--accent))' : 'hsl(var(--border))'
            }}
          >
            {t(`modelHub.privacy.${m}`)}
          </button>
        ))}
      </div>

      {msg && <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{msg}</p>}

      <h2 style={{ fontSize: 14 }}>{t('modelHub.providers')}</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        {filtered.map((p, i) => (
          <div key={p.id || i} style={card}>
            <strong>{p.name || p.id || 'Provider'}</strong>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
              {p.kind || '—'} · {p.baseUrl || '—'}
            </div>
          </div>
        ))}
        {!filtered.length && <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{t('modelHub.none')}</div>}
      </div>

      <h2 style={{ fontSize: 14 }}>{t('modelHub.models')} ({models.length})</h2>
      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 20 }}>
        {models.slice(0, 24).map((m: any, i) => (
          <div key={i}>{m?.name || m?.id || String(m)}</div>
        ))}
      </div>

      <h2 style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Plus size={14} /> {t('modelHub.addCustom')}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} style={input} placeholder="Name" />
        <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} style={input} placeholder="Base URL" />
        <button type="button" onClick={() => void addCustom()} style={{ ...btn, background: 'hsl(var(--accent))', color: '#fff', border: 'none' }}>
          {t('modelHub.saveProvider')}
        </button>
      </div>
    </div>
  );
};

const btn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))',
  background: 'transparent', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontSize: 12
};
const linkBtn = { ...btn, border: 'none' };
const card: React.CSSProperties = {
  padding: 12, borderRadius: 10, border: '1px solid hsl(var(--border) / 0.6)',
  background: 'hsl(var(--bg-sidebar) / 0.3)'
};
const input: React.CSSProperties = {
  padding: 10, borderRadius: 8, border: '1px solid hsl(var(--border))',
  background: 'transparent', color: 'hsl(var(--text-primary))'
};

export default ModelHubView;
