/**
 * My Computers — Control Plane pairing + Runtime doctor (Phase 2).
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Monitor, RefreshCw, Link2, Unlink } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';
import { getCachedDeviceToken, storePairingSession, clearCachedDeviceToken } from '../lib/runtimeBootstrap';

type Check = { id: string; ok: boolean; detail: string };
type DeviceRow = {
  id: string;
  name?: string;
  os?: string;
  runtime_version?: string;
  status?: string;
  capabilities?: Record<string, unknown>;
  sessions?: Array<{ id: string; label?: string; clientName?: string; expiresAt?: string }>;
};

const ComputersView: React.FC = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState('');
  const [pairBusy, setPairBusy] = useState(false);
  const [localCode, setLocalCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, d, list] = await Promise.all([
        axios.get(`${API_BASE}/v3/runtime/health`),
        axios.get(`${API_BASE}/v3/runtime/doctor`),
        axios.get(`${API_BASE}/v3/runtime/devices`).catch(() => ({ data: { devices: [] } }))
      ]);
      setHealth(h.data || null);
      setChecks(Array.isArray(d.data?.checks) ? d.data.checks : []);
      setDevices(Array.isArray(list.data?.devices) ? list.data.devices : []);
    } catch (e: unknown) {
      setHealth(null);
      setChecks([]);
      setDevices([]);
      setError(e instanceof Error ? e.message : t('computers.offline'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const startLocalPair = async () => {
    setPairBusy(true);
    setMsg(null);
    try {
      const r = await axios.post(`${API_BASE}/v3/runtime/pair/start`, {});
      setLocalCode(String(r.data?.code || ''));
      setMsg(t('computers.pairCodeReady'));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t('computers.pairFailed'));
    } finally {
      setPairBusy(false);
    }
  };

  const confirmPair = async () => {
    const code = pairCode.trim();
    if (!code) return;
    setPairBusy(true);
    setMsg(null);
    try {
      const r = await axios.post(`${API_BASE}/v3/runtime/pair/confirm`, {
        code,
        clientName: 'web-control-plane',
        label: 'Web Control Plane'
      });
      if (r.data?.sessionToken || r.data?.deviceToken) {
        storePairingSession({
          sessionToken: r.data.sessionToken || r.data.deviceToken,
          deviceToken: r.data.deviceToken,
          deviceId: r.data.deviceId
        });
      }
      setPairCode('');
      setMsg(t('computers.pairSuccess'));
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t('computers.pairFailed'));
    } finally {
      setPairBusy(false);
    }
  };

  const revokeAll = async () => {
    if (!window.confirm(t('computers.revokeConfirm'))) return;
    setPairBusy(true);
    try {
      await axios.post(`${API_BASE}/v3/runtime/revoke`, { rotate: true });
      clearCachedDeviceToken();
      setMsg(t('computers.revoked'));
      await refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t('computers.pairFailed'));
    } finally {
      setPairBusy(false);
    }
  };

  const online = !!health?.ok;
  const tokenPresent = !!getCachedDeviceToken();

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Monitor size={20} color="hsl(var(--accent))" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('computers.title')}</h1>
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
        {t('computers.hint')}
      </p>

      {error && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 16,
          border: '1px solid hsl(var(--destructive) / 0.4)',
          color: 'hsl(var(--destructive))', fontSize: 13
        }}>
          {error}
        </div>
      )}

      {msg && (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 16,
          border: '1px solid hsl(var(--border))', fontSize: 13,
          color: 'hsl(var(--text-secondary))'
        }}>
          {msg}
        </div>
      )}

      <div style={{
        padding: 16, borderRadius: 12, marginBottom: 16,
        border: '1px solid hsl(var(--border) / 0.6)',
        background: 'hsl(var(--bg-sidebar) / 0.35)'
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('computers.addComputer')}</div>
        <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 0 }}>{t('computers.pairHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            disabled={pairBusy}
            onClick={() => void startLocalPair()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--accent) / 0.12)', color: 'hsl(var(--text-primary))',
              cursor: 'pointer', fontSize: 12
            }}
          >
            <Link2 size={14} />
            {t('computers.showPairCode')}
          </button>
          {localCode && (
            <code style={{
              fontSize: 18, letterSpacing: '0.2em', padding: '6px 12px',
              borderRadius: 8, border: '1px dashed hsl(var(--border))'
            }}>
              {localCode}
            </code>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={pairCode}
            onChange={(e) => setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('computers.enterCode')}
            style={{
              flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8,
              border: '1px solid hsl(var(--border))', background: 'transparent',
              color: 'hsl(var(--text-primary))', fontSize: 14, letterSpacing: '0.15em'
            }}
          />
          <button
            type="button"
            disabled={pairBusy || pairCode.length < 6}
            onClick={() => void confirmPair()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: 'hsl(var(--accent))', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600
            }}
          >
            {t('computers.confirmPair')}
          </button>
          <button
            type="button"
            disabled={pairBusy}
            onClick={() => void revokeAll()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid hsl(var(--destructive) / 0.45)',
              background: 'transparent', color: 'hsl(var(--destructive))', cursor: 'pointer', fontSize: 12
            }}
          >
            <Unlink size={14} />
            {t('computers.revokeAll')}
          </button>
        </div>
      </div>

      {(devices.length ? devices : [{
        id: String(health?.deviceId || 'local'),
        name: String(health?.deviceName || t('computers.thisMachine')),
        os: undefined,
        runtime_version: String(health?.version || ''),
        status: online ? 'online' : 'offline'
      }]).map((dev) => (
        <div
          key={dev.id}
          style={{
            padding: 16, borderRadius: 12, marginBottom: 12,
            border: '1px solid hsl(var(--border) / 0.6)',
            background: 'hsl(var(--bg-sidebar) / 0.35)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{dev.name || t('computers.thisMachine')}</strong>
            <span style={{
              fontSize: 12,
              color: (dev.status === 'online' || online) ? 'hsl(142 71% 45%)' : 'hsl(var(--text-secondary))'
            }}>
              {loading ? '…' : (dev.status === 'online' || online) ? t('computers.online') : t('computers.offline')}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.7 }}>
            <div>ID: {dev.id}</div>
            <div>OS: {dev.os || '—'}</div>
            <div>Runtime: {dev.runtime_version || String(health?.version || '—')}</div>
            {dev.id === health?.deviceId && (
              <>
                <div>API: v{String(health?.apiVersion ?? '—')}</div>
                <div>Bind: {String(health?.bindHost || '—')}</div>
                <div>Auth: {health?.authRequired ? t('computers.authOn') : t('computers.authOff')}</div>
                <div>Token: {tokenPresent ? t('computers.tokenCached') : t('computers.tokenMissing')}</div>
              </>
            )}
            {!!dev.sessions?.length && (
              <div>{t('computers.sessions')}: {dev.sessions.length}</div>
            )}
          </div>
        </div>
      ))}

      {checks.length > 0 && (
        <div style={{
          padding: 16, borderRadius: 12,
          border: '1px solid hsl(var(--border) / 0.6)',
          background: 'hsl(var(--bg-sidebar) / 0.2)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('permission.runtimeDoctor')}</div>
          {checks.map((c) => (
            <div key={c.id} style={{ fontSize: 12, marginBottom: 6, color: 'hsl(var(--text-secondary))' }}>
              <span style={{ color: c.ok ? 'hsl(142 71% 45%)' : 'hsl(var(--destructive))' }}>
                {c.ok ? '✓' : '✗'}
              </span>{' '}
              {c.id}: {c.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComputersView;
