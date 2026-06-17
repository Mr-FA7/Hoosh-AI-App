import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { MonitorPlay, RefreshCw, Power, Square, Pause, Play, ExternalLink, Info, Camera, Server, Download, Disc } from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type VmRow = { name: string; uuid: string };

const OSTYPES = ['Ubuntu_64', 'Debian_64', 'Other_64', 'Windows10_64', 'Windows2019_64'] as const;

const VmLabView: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [vms, setVms] = useState<VmRow[]>([]);
  const [running, setRunning] = useState<VmRow[]>([]);
  const [vmwarePaths, setVmwarePaths] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  const [newName, setNewName] = useState('fa7-test');
  const [memoryMb, setMemoryMb] = useState(2048);
  const [diskMb, setDiskMb] = useState(20480);
  const [isoPath, setIsoPath] = useState('');
  const [ostype, setOstype] = useState<string>('Ubuntu_64');

  const [snapName, setSnapName] = useState('snap1');
  const [vmxPath, setVmxPath] = useState('');
  const [bootIsoPath, setBootIsoPath] = useState('');
  const [bootMem, setBootMem] = useState(2048);

  const refresh = useCallback(async () => {
    setBusy('refresh');
    setLog('');
    try {
      const [s, v, r, vmw] = await Promise.all([
        axios.get(`${API}/v3/vm-lab/status`),
        axios.get(`${API}/v3/vm-lab/vbox/vms`).catch(() => ({ data: { vms: [] } })),
        axios.get(`${API}/v3/vm-lab/vbox/running`).catch(() => ({ data: { vms: [] } })),
        axios.get(`${API}/v3/vm-lab/vmware/list`).catch(() => ({ data: { paths: [] } }))
      ]);
      setStatus(s.data);
      setVms(Array.isArray(v.data?.vms) ? v.data.vms : []);
      setRunning(Array.isArray(r.data?.vms) ? r.data.vms : []);
      setVmwarePaths(Array.isArray(vmw.data?.paths) ? vmw.data.paths : []);
    } catch (e: unknown) {
      setLog(String(e && typeof e === 'object' && 'message' in e ? (e as Error).message : e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const name = selected.trim();
    if (!name && action !== 'open_gui') {
      setLog('Select a VM name first.');
      return;
    }
    setBusy(action);
    setLog('');
    try {
      const r = await axios.post(`${API}/v3/vm-lab/vbox/action`, { action, name, ...extra });
      setLog(JSON.stringify(r.data, null, 2));
      await refresh();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const openVb = async () => {
    setBusy('open');
    try {
      const r = await axios.post(`${API}/v3/vm-lab/open/virtualbox-gui`);
      setLog(JSON.stringify(r.data, null, 2));
    } catch (e: unknown) {
      setLog(String(e));
    } finally {
      setBusy(null);
    }
  };

  const showInfo = async () => {
    const name = selected.trim();
    if (!name) {
      setLog('Select a VM first.');
      return;
    }
    setBusy('info');
    try {
      const r = await axios.get(`${API}/v3/vm-lab/vbox/info`, { params: { name } });
      setLog(JSON.stringify(r.data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const snapshot = async (action: 'list' | 'take' | 'restore' | 'delete') => {
    const name = selected.trim();
    if (!name) {
      setLog('Select a VM first.');
      return;
    }
    if (action !== 'list' && !snapName.trim()) {
      setLog('Enter snapshot name.');
      return;
    }
    setBusy('snap');
    try {
      const r = await axios.post(`${API}/v3/vm-lab/vbox/snapshot`, {
        action,
        name,
        snapshotName: action === 'list' ? undefined : snapName.trim()
      });
      setLog(JSON.stringify(r.data, null, 2));
      await refresh();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const createMinimal = async () => {
    if (!newName.trim()) {
      setLog('Enter a VM name.');
      return;
    }
    setBusy('create');
    try {
      const body: Record<string, unknown> = {
        name: newName.trim(),
        memoryMb,
        diskMb,
        ostype
      };
      if (isoPath.trim()) body.isoPath = isoPath.trim();
      const r = await axios.post(`${API}/v3/vm-lab/vbox/create-minimal`, body);
      setLog(JSON.stringify(r.data, null, 2));
      await refresh();
      if (r.data?.vmName) setSelected(String(r.data.vmName));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const ensureFa7Engine = async () => {
    setBusy('qemu-download');
    setLog(t('vmlab.downloadingQemu'));
    try {
      const r = await axios.post(`${API}/v3/vm-lab/embedded/qemu/ensure`, {}, { timeout: 900000 });
      setLog(JSON.stringify(r.data, null, 2));
      await refresh();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const bootFa7Iso = async () => {
    if (!bootIsoPath.trim()) {
      setLog('Enter the ISO path.');
      return;
    }
    setBusy('boot-iso');
    try {
      const r = await axios.post(
        `${API}/v3/vm-lab/embedded/qemu/boot-iso`,
        { isoPath: bootIsoPath.trim(), memoryMb: bootMem },
        { timeout: 60000 }
      );
      setLog(JSON.stringify(r.data, null, 2));
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const vmwareAct = async (action: 'list' | 'start' | 'stop' | 'suspend') => {
    setBusy('vmrun');
    try {
      const r = await axios.post(`${API}/v3/vm-lab/vmware/action`, {
        action,
        vmxPath: vmxPath.trim() || undefined,
        gui: 'gui',
        stopKind: 'hard'
      });
      setLog(JSON.stringify(r.data, null, 2));
      if (action === 'list' && Array.isArray(r.data?.paths)) setVmwarePaths(r.data.paths);
      await refresh();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      setLog(JSON.stringify(ax.response?.data ?? String(e), null, 2));
    } finally {
      setBusy(null);
    }
  };

  const vb = status?.virtualbox as { available?: boolean; version?: string | null } | undefined;
  const diskDir = (status?.vmLab as { diskStorageDir?: string })?.diskStorageDir;
  const vmrunPath = (status?.vmware as { vmrun?: string | null })?.vmrun;
  const fa7 = status?.fa7VmEngine as
    | {
        qemuSystem?: { path: string; source: string } | null;
        qemuImg?: { path: string; source: string } | null;
        canOneClickDownload?: boolean;
        embeddedRoot?: string;
        license?: string;
      }
    | undefined;

  return (
    <div
      style={{
        padding: '30px',
        background: 'transparent',
        color: 'hsl(var(--text-primary))',
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '10px', background: 'hsl(var(--accent) / 0.1)', borderRadius: '12px' }}>
          <MonitorPlay size={24} color="hsl(var(--accent))" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{t('vmlab.title')}</h2>
          <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0 }}>{t('vmlab.subtitle')}</p>
        </div>
      </div>

      <div
        style={{
          marginBottom: '16px',
          padding: '14px',
          background: 'hsl(var(--bg-sidebar) / 0.35)',
          borderRadius: '12px',
          border: '1px solid hsl(var(--border) / 0.4)',
          fontSize: '12px',
          lineHeight: 1.55,
          color: 'hsl(var(--text-secondary))'
        }}
      >
        <strong style={{ color: 'hsl(var(--text-primary))' }}>{t('vmlab.embeddedEngine')}</strong> {t('vmlab.embeddedHint')}
      </div>

      <div
        style={{
          marginBottom: '16px',
          padding: '14px',
          background: 'hsl(var(--bg-sidebar) / 0.35)',
          borderRadius: '12px',
          border: '1px solid hsl(var(--border) / 0.4)',
          fontSize: '12px',
          lineHeight: 1.55,
          color: 'hsl(var(--text-secondary))'
        }}
      >
        <strong style={{ color: 'hsl(var(--text-primary))' }}>{t('vmlab.guestTitle')}</strong> {t('vmlab.guestBody')}
      </div>

      <section style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Disc size={16} /> {t('vmlab.fa7Engine')}
        </h3>
        <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: '0 0 12px' }}>
          {fa7?.qemuSystem
            ? t('vmlab.qemuActive').replace('{path}', fa7.qemuSystem.path).replace('{source}', fa7.qemuSystem.source)
            : t('vmlab.qemuMissing')}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {fa7?.canOneClickDownload ? (
            <button type="button" onClick={() => void ensureFa7Engine()} disabled={!!busy} style={btnPrimary(!!busy)}>
              <Download size={16} /> {t('vmlab.installEngine')}
            </button>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: '10px', maxWidth: '520px' }}>
          <label style={lbl()}>
            {t('vmlab.bootFromIso')}
            <input value={bootIsoPath} onChange={(e) => setBootIsoPath(e.target.value)} placeholder="/Users/you/os.iso" style={inp()} />
          </label>
          <label style={lbl()}>
            {t('vmlab.guestRam')}
            <input type="number" value={bootMem} onChange={(e) => setBootMem(Number(e.target.value))} style={inp()} />
          </label>
          <button type="button" onClick={() => void bootFa7Iso()} disabled={!!busy} style={btnPrimary(!!busy)}>
            {t('vmlab.runQemuWithIso')}
          </button>
        </div>
        {fa7?.license && (
          <p style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', marginTop: '12px', opacity: 0.85 }}>{fa7.license}</p>
        )}
      </section>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={!!busy}
          style={btnPrimary(!!busy)}
        >
          <RefreshCw size={16} /> {t('vmlab.refresh')}
        </button>
        <button type="button" onClick={() => void openVb()} disabled={!!busy} style={btnGhost(!!busy)}>
          <ExternalLink size={16} /> {t('vmlab.hostGui')}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid hsl(var(--border) / 0.35)',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>{t('vmlab.detectionStatus')}</div>
          <div>FA7 qemu-system: {fa7?.qemuSystem?.path || '—'} ({fa7?.qemuSystem?.source || '—'})</div>
          <div>FA7 qemu-img: {fa7?.qemuImg?.path || '—'}</div>
          <div>VBoxManage (optional bridge): {vb?.available ? `OK (${vb.version || '?'})` : '—'}</div>
          <div>VDI (disk path): {diskDir || '—'}</div>
          <div>QEMU in PATH: {(status.qemu as { systemX64?: string })?.systemX64 || '—'}</div>
          <div>vmrun: {vmrunPath || '—'}</div>
          <div>macOS VM UI app (optional): {(status.optionalMacVmUi as { installed?: boolean })?.installed ? 'yes' : '—'}</div>
        </div>
      )}

      <section style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={16} /> {t('vmlab.minimalVm')}
        </h3>
        <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: '0 0 12px' }}>{t('vmlab.minimalBlurb')}</p>
        <div style={{ display: 'grid', gap: '10px', maxWidth: '520px' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('vmlab.vmNamePlaceholder')}
            style={inp()}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={lbl()}>
              {t('vmlab.ramMb')}
              <input type="number" value={memoryMb} onChange={(e) => setMemoryMb(Number(e.target.value))} style={inp()} />
            </label>
            <label style={lbl()}>
              {t('vmlab.diskMb')}
              <input type="number" value={diskMb} onChange={(e) => setDiskMb(Number(e.target.value))} style={inp()} />
            </label>
          </div>
          <select value={ostype} onChange={(e) => setOstype(e.target.value)} style={inp()}>
            {OSTYPES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <input
            value={isoPath}
            onChange={(e) => setIsoPath(e.target.value)}
            placeholder={t('vmlab.isoOptionalPlaceholder')}
            style={inp()}
          />
          <button type="button" onClick={() => void createMinimal()} disabled={!!busy} style={btnPrimary(!!busy)}>
            {t('vmlab.createRegister')}
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px' }}>{t('vmlab.registeredVms')}</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ ...inp(), maxWidth: '480px', marginBottom: '12px' }}
        >
          <option value="">{t('vmlab.selectVm')}</option>
          {vms.map((vm) => (
            <option key={vm.uuid} value={vm.name}>
              {vm.name} {running.some((x) => x.uuid === vm.uuid) ? t('vmlab.running') : ''}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button type="button" onClick={() => void showInfo()} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
            <Info size={14} style={{ marginRight: 6 }} />
            {t('vmlab.showvminfo')}
          </button>
          <button
            type="button"
            onClick={() => void act('start', { startMode: 'gui' })}
            disabled={!!busy || !selected}
            style={btnStyle(!!busy || !selected)}
          >
            <Power size={14} style={{ marginRight: 6 }} />
            {t('vmlab.startGui')}
          </button>
          <button type="button" onClick={() => void act('start', { startMode: 'headless' })} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
            {t('vmlab.startHeadless')}
          </button>
          <button type="button" onClick={() => void act('pause')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
            <Pause size={14} style={{ marginRight: 6 }} />
            {t('vmlab.pause')}
          </button>
          <button type="button" onClick={() => void act('resume')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
            <Play size={14} style={{ marginRight: 6 }} />
            {t('vmlab.resume')}
          </button>
          <button type="button" onClick={() => void act('stop', { stopKind: 'poweroff' })} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
            <Square size={14} style={{ marginRight: 6 }} />
            {t('vmlab.powerOff')}
          </button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '12px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={14} /> {t('vmlab.snapshots')}
          </h4>
          <input
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
            placeholder={t('vmlab.snapshotNamePlaceholder')}
            style={{ ...inp(), maxWidth: '280px', marginRight: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button type="button" onClick={() => void snapshot('list')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
              {t('vmlab.list')}
            </button>
            <button type="button" onClick={() => void snapshot('take')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
              {t('vmlab.take')}
            </button>
            <button type="button" onClick={() => void snapshot('restore')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
              {t('vmlab.restore')}
            </button>
            <button type="button" onClick={() => void snapshot('delete')} disabled={!!busy || !selected} style={btnStyle(!!busy || !selected)}>
              {t('vmlab.delete')}
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px' }}>{t('vmlab.vmrunSection')}</h3>
        <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: '0 0 10px' }}>{t('vmlab.vmrunBlurb')}</p>
        <input
          value={vmxPath}
          onChange={(e) => setVmxPath(e.target.value)}
          placeholder="/path/to/machine.vmx"
          style={{ ...inp(), maxWidth: '100%', marginBottom: '10px' }}
        />
        {vmwarePaths.length > 0 && (
          <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginBottom: '10px' }}>
            Running (vmrun list):{' '}
            {vmwarePaths.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setVmxPath(p)}
                style={{
                  display: 'block',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(var(--accent))',
                  cursor: 'pointer',
                  fontSize: '11px',
                  marginTop: '4px',
                  wordBreak: 'break-all'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void vmwareAct('list')} disabled={!!busy} style={btnPrimary(!!busy)}>
            vmrun list
          </button>
          <button type="button" onClick={() => void vmwareAct('start')} disabled={!!busy || !vmxPath.trim()} style={btnStyle(!!busy || !vmxPath.trim())}>
            Start
          </button>
          <button type="button" onClick={() => void vmwareAct('stop')} disabled={!!busy || !vmxPath.trim()} style={btnStyle(!!busy || !vmxPath.trim())}>
            Stop
          </button>
          <button type="button" onClick={() => void vmwareAct('suspend')} disabled={!!busy || !vmxPath.trim()} style={btnStyle(!!busy || !vmxPath.trim())}>
            Suspend
          </button>
        </div>
      </section>

      {log && (
        <pre
          style={{
            padding: '12px',
            background: 'hsl(var(--bg-sidebar) / 0.5)',
            borderRadius: '8px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '320px',
            border: '1px solid hsl(var(--border) / 0.4)'
          }}
        >
          {log}
        </pre>
      )}
    </div>
  );
};

function inp(): React.CSSProperties {
  return {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--bg-sidebar))',
    color: 'hsl(var(--text-primary))',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box'
  };
}

function lbl(): React.CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'hsl(var(--text-secondary))' };
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid hsl(var(--border))',
    background: disabled ? 'transparent' : 'hsl(var(--accent) / 0.08)',
    color: disabled ? 'hsl(var(--text-secondary) / 0.5)' : 'hsl(var(--text-primary))',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px'
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid hsl(var(--border))',
    background: disabled ? 'transparent' : 'hsl(var(--accent) / 0.12)',
    color: disabled ? 'hsl(var(--text-secondary) / 0.5)' : 'hsl(var(--accent))',
    cursor: disabled ? 'wait' : 'pointer',
    fontSize: '13px'
  };
}

function btnGhost(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid hsl(var(--border) / 0.5)',
    background: 'transparent',
    color: disabled ? 'hsl(var(--text-secondary) / 0.5)' : 'hsl(var(--text-secondary))',
    cursor: disabled ? 'wait' : 'pointer',
    fontSize: '13px'
  };
}

export default VmLabView;
