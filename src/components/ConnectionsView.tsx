/**
 * Connections — universal registry surface (Architecture v2).
 * Aggregates live status for Runtime, models, MCP, Docker without new backends.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Cable, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type Row = {
  id: string;
  name: string;
  kind: string;
  status: 'connected' | 'degraded' | 'offline' | 'unknown';
  detail?: string;
};

const ConnectionsView: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next: Row[] = [];

    try {
      const h = await axios.get(`${API_BASE}/v3/runtime/health`);
      next.push({
        id: 'runtime',
        name: t('connections.runtime'),
        kind: 'device',
        status: h.data?.ok ? 'connected' : 'offline',
        detail: `${h.data?.version || ''} · ${h.data?.deviceId || ''}`.trim()
      });
    } catch {
      next.push({
        id: 'runtime',
        name: t('connections.runtime'),
        kind: 'device',
        status: 'offline',
        detail: t('computers.offline')
      });
    }

    try {
      const m = await axios.get(`${API_BASE}/ai/models/catalog`);
      const models = Array.isArray(m.data?.models) ? m.data.models : [];
      const local = models.filter((x: { installed?: boolean; source?: string }) =>
        x?.installed || /ollama|local|lmstudio/i.test(String(x?.source || ''))
      );
      next.push({
        id: 'models',
        name: t('connections.models'),
        kind: 'model-provider',
        status: models.length ? 'connected' : 'degraded',
        detail: t('connections.modelsDetail')
          .replace('{total}', String(models.length))
          .replace('{local}', String(local.length || models.length))
      });
    } catch {
      next.push({
        id: 'models',
        name: t('connections.models'),
        kind: 'model-provider',
        status: 'unknown',
        detail: t('connections.probeFailed')
      });
    }

    try {
      const mcp = await axios.get(`${API_BASE}/v3/mcp/status`);
      const servers = mcp.data?.servers || mcp.data?.configured || [];
      const n = Array.isArray(servers) ? servers.length : Number(mcp.data?.count || 0);
      const connected = mcp.data?.ok !== false && (n > 0 || mcp.data?.connected);
      next.push({
        id: 'mcp',
        name: t('connections.mcp'),
        kind: 'mcp',
        status: connected ? 'connected' : 'degraded',
        detail: t('connections.count').replace('{n}', String(n))
      });
    } catch {
      next.push({
        id: 'mcp',
        name: t('connections.mcp'),
        kind: 'mcp',
        status: 'unknown',
        detail: t('connections.probeFailed')
      });
    }

    try {
      const stacks = await axios.get(`${API_BASE}/v3/stacks/runtime`);
      const runtime = stacks?.data?.runtime || stacks?.data?.docker || stacks?.data?.engine;
      next.push({
        id: 'docker',
        name: t('connections.docker'),
        kind: 'docker',
        status: stacks?.data?.ok === false ? 'degraded' : 'connected',
        detail: runtime ? String(runtime) : t('connections.dockerOk')
      });
    } catch {
      next.push({
        id: 'docker',
        name: t('connections.docker'),
        kind: 'docker',
        status: 'unknown',
        detail: t('connections.probeFailed')
      });
    }

    setRows(next);
    setLoading(false);
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const tone = (s: Row['status']) => {
    if (s === 'connected') return 'hsl(142 71% 45%)';
    if (s === 'offline') return 'hsl(var(--destructive))';
    if (s === 'degraded') return 'hsl(38 92% 50%)';
    return 'hsl(var(--text-secondary))';
  };

  const label = (s: Row['status']) => {
    if (s === 'connected') return t('connections.statusConnected');
    if (s === 'offline') return t('connections.statusOffline');
    if (s === 'degraded') return t('connections.statusDegraded');
    return t('connections.statusUnknown');
  };

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cable size={20} color="hsl(var(--accent))" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('connections.title')}</h1>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))',
            background: 'transparent', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontSize: 12
          }}
        >
          <RefreshCw size={14} />
          {t('computers.refresh')}
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 0, marginBottom: 18 }}>
        {t('connections.hint')}
      </p>

      {loading && <div style={{ fontSize: 13, opacity: 0.6 }}>{t('settings.gathering')}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              padding: '14px 16px', borderRadius: 12,
              border: '1px solid hsl(var(--border) / 0.55)',
              background: 'hsl(var(--bg-sidebar) / 0.3)',
              display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>{r.kind}</div>
              {r.detail && (
                <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 6 }}>{r.detail}</div>
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: tone(r.status), whiteSpace: 'nowrap' }}>
              {label(r.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionsView;
