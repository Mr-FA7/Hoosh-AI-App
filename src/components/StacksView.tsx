import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Layers, RefreshCw, Play, Square, FileText, Server, AlertCircle, CheckCircle2, Box,
  ExternalLink, Sparkles
} from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type ComposeFile = { file: string; services: string[] };
type ServiceRow = { name: string; service: string; state: string; ports: string; health?: string };
type DevProfile = {
  name?: string;
  compose?: string | null;
  autoUp?: boolean;
  waitHealthy?: boolean;
  preview?: { port?: number | null; path?: string };
  ports?: number[];
  services?: string[];
  sandbox?: { image?: string | null; memory?: string | null; cpus?: string | null };
};
type RuntimeInfo = {
  available?: boolean;
  engine?: string;
  version?: string;
  composeAvailable?: boolean;
  message?: string;
};

const StacksView: React.FC = () => {
  const { t } = useI18n();
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [files, setFiles] = useState<ComposeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const selectedFileRef = useRef('');
  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [profileFile, setProfileFile] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [logs, setLogs] = useState('');
  const [logService, setLogService] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [platformTab, setPlatformTab] = useState<'stacks' | 'containers' | 'images' | 'networks' | 'volumes'>('stacks');
  const [imageList, setImageList] = useState<any[]>([]);
  const [networkList, setNetworkList] = useState<any[]>([]);
  const [volumeList, setVolumeList] = useState<any[]>([]);
  const [pullImageName, setPullImageName] = useState('nginx:alpine');
  const [execCmd, setExecCmd] = useState('echo hello');
  const [execTarget, setExecTarget] = useState('');

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  const refresh = useCallback(async (fileHint?: string) => {
    setBusy('refresh');
    setMsg('');
    try {
      const [disc, rt, ctr] = await Promise.all([
        axios.get(`${API}/v3/stacks/discover`),
        axios.get(`${API}/v3/stacks/runtime`),
        axios.get(`${API}/v3/stacks/containers`).catch(() => ({ data: { containers: [] } }))
      ]);
      setRuntime(disc.data?.runtime || rt.data);
      const list: ComposeFile[] = Array.isArray(disc.data?.files) ? disc.data.files : [];
      setFiles(list);
      setProfile(disc.data?.profile || null);
      setProfileFile(disc.data?.profileFile || null);
      setContainers(Array.isArray(ctr.data?.containers) ? ctr.data.containers : []);

      const file = fileHint || selectedFileRef.current || list[0]?.file || '';
      if (file && file !== selectedFileRef.current) {
        setSelectedFile(file);
        selectedFileRef.current = file;
      }
      if (file) {
        const ps = await axios.get(`${API}/v3/stacks/ps`, { params: { file } });
        setServices(Array.isArray(ps.data?.services) ? ps.data.services : []);
        setPreviewUrls(Array.isArray(ps.data?.preview?.urls) ? ps.data.preview.urls : []);
      } else {
        setServices([]);
        setPreviewUrls([]);
      }
    } catch (e: unknown) {
      setMsg(String(e && typeof e === 'object' && 'message' in e ? (e as Error).message : e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshPlatform = useCallback(async () => {
    setBusy('platform');
    try {
      const [imgs, nets, vols, ctrs] = await Promise.all([
        axios.get(`${API}/v3/containers/images`),
        axios.get(`${API}/v3/containers/networks`),
        axios.get(`${API}/v3/containers/volumes`),
        axios.get(`${API}/v3/containers/list`)
      ]);
      setImageList(imgs.data?.images || []);
      setNetworkList(nets.data?.networks || []);
      setVolumeList(vols.data?.volumes || []);
      setContainers(ctrs.data?.containers || []);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (platformTab !== 'stacks') void refreshPlatform();
  }, [platformTab, refreshPlatform]);

  const pullImage = async () => {
    setBusy('pull');
    try {
      const r = await axios.post(`${API}/v3/containers/images/pull`, { image: pullImageName });
      setMsg(r.data?.ok ? `Pulled ${pullImageName}` : (r.data?.stderr || 'Pull failed'));
      await refreshPlatform();
    } finally {
      setBusy(null);
    }
  };

  const containerAct = async (action: string, id: string) => {
    setBusy(action);
    try {
      await axios.post(`${API}/v3/containers/${action}`, { id });
      await refreshPlatform();
    } finally {
      setBusy(null);
    }
  };

  const stackExtra = async (action: 'pull' | 'restart' | 'build') => {
    setBusy(action);
    try {
      await axios.post(`${API}/v3/stacks/${action}`, { composeFile: selectedFile || undefined });
      await refresh(selectedFileRef.current || undefined);
    } finally {
      setBusy(null);
    }
  };

  const tabBtn = (id: typeof platformTab, label: string): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: platformTab === id ? 'rgba(59,130,246,0.25)' : '#1a1a1a',
    color: platformTab === id ? '#93c5fd' : '#888'
  });

  const act = async (action: 'up' | 'down' | 'logs' | 'init') => {
    if (action !== 'init' && !selectedFile && files.length === 0) {
      setMsg(t('stacks.noCompose'));
      return;
    }
    setBusy(action);
    setMsg('');
    try {
      if (action === 'init') {
        const r = await axios.post(`${API}/v3/stacks/init-example`);
        const created = Array.isArray(r.data?.created) ? r.data.created.join(', ') : '';
        setMsg(created ? `${t('stacks.initExampleOk')} (${created})` : t('stacks.initExampleOk'));
      } else if (action === 'up') {
        const r = await axios.post(`${API}/v3/stacks/up`, { composeFile: selectedFile || undefined, build: true });
        if (r.data?.ok) {
          const health = r.data?.health;
          if (health?.ok) setMsg(t('stacks.healthOk'));
          else if (health && health.ok === false) setMsg(t('stacks.healthTimeout'));
          else setMsg(t('stacks.upOk'));
          if (Array.isArray(r.data?.preview?.urls)) setPreviewUrls(r.data.preview.urls);
        } else {
          setMsg(r.data?.stderr || r.data?.error || t('stacks.upFail'));
        }
      } else if (action === 'down') {
        const r = await axios.post(`${API}/v3/stacks/down`, { composeFile: selectedFile || undefined });
        setMsg(r.data?.ok ? t('stacks.downOk') : (r.data?.stderr || r.data?.error || t('stacks.downFail')));
      } else {
        const r = await axios.get(`${API}/v3/stacks/logs`, {
          params: { file: selectedFile || undefined, service: logService || undefined, tail: 200 }
        });
        setLogs(String(r.data?.logs || r.data?.stdout || r.data?.stderr || ''));
      }
      await refresh(selectedFileRef.current || undefined);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setMsg(ax.response?.data?.error || String(e));
    } finally {
      setBusy(null);
    }
  };

  const card: React.CSSProperties = {
    background: '#141414',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '14px',
    border: '1px solid #2a2a2a'
  };

  const btn = (primary = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    cursor: busy ? 'wait' : 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    background: primary ? 'rgba(59,130,246,0.25)' : '#222',
    color: primary ? '#93c5fd' : '#ccc',
    opacity: busy ? 0.7 : 1
  });

  return (
    <div style={{ padding: '20px', color: '#ddd', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Layers size={22} color="#60a5fa" />
        <h2 style={{ margin: 0, fontSize: '18px' }}>{t('stacks.title')}</h2>
        <button type="button" style={{ ...btn(), marginLeft: 'auto' }} onClick={() => void refresh()} disabled={!!busy}>
          <RefreshCw size={14} /> {t('stacks.refresh')}
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#888', marginTop: 0 }}>{t('stacks.hint')}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button type="button" style={tabBtn('stacks', t('platform.tabStacks'))} onClick={() => setPlatformTab('stacks')}>{t('platform.tabStacks')}</button>
        <button type="button" style={tabBtn('containers', t('platform.tabContainers'))} onClick={() => setPlatformTab('containers')}>{t('platform.tabContainers')}</button>
        <button type="button" style={tabBtn('images', t('platform.tabImages'))} onClick={() => setPlatformTab('images')}>{t('platform.tabImages')}</button>
        <button type="button" style={tabBtn('networks', t('platform.tabNetworks'))} onClick={() => setPlatformTab('networks')}>{t('platform.tabNetworks')}</button>
        <button type="button" style={tabBtn('volumes', t('platform.tabVolumes'))} onClick={() => setPlatformTab('volumes')}>{t('platform.tabVolumes')}</button>
      </div>

      {platformTab === 'containers' && (
        <div style={card}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('platform.tabContainers')}</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input value={execTarget} onChange={(e) => setExecTarget(e.target.value)} placeholder="container id/name" style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#0a0a0a', color: '#ddd', border: '1px solid #333', fontSize: '12px' }} />
            <input value={execCmd} onChange={(e) => setExecCmd(e.target.value)} placeholder="command" style={{ flex: 2, padding: '8px', borderRadius: '8px', background: '#0a0a0a', color: '#ddd', border: '1px solid #333', fontSize: '12px' }} />
            <button type="button" style={btn()} disabled={!!busy} onClick={async () => {
              setBusy('exec');
              try {
                const r = await axios.post(`${API}/v3/containers/exec`, { id: execTarget, command: execCmd });
                setMsg(r.data?.output || r.data?.stderr || '');
              } finally { setBusy(null); }
            }}>{t('platform.exec')}</button>
          </div>
          {containers.map((c) => (
            <div key={c.id || c.name} style={{ fontSize: '12px', padding: '8px 0', borderBottom: '1px solid #222', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ flex: 1, fontFamily: 'monospace', color: '#94a3b8' }}>{c.name} · {c.image} · {c.state}</span>
              <button type="button" style={btn()} onClick={() => void containerAct('start', c.name || c.id)}>Start</button>
              <button type="button" style={btn()} onClick={() => void containerAct('stop', c.name || c.id)}>Stop</button>
              <button type="button" style={btn()} onClick={() => void containerAct('restart', c.name || c.id)}>{t('platform.restart')}</button>
            </div>
          ))}
        </div>
      )}

      {platformTab === 'images' && (
        <div style={card}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input value={pullImageName} onChange={(e) => setPullImageName(e.target.value)} placeholder={t('platform.imageName')} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#0a0a0a', color: '#ddd', border: '1px solid #333', fontSize: '12px' }} />
            <button type="button" style={btn(true)} disabled={!!busy} onClick={() => void pullImage()}>{t('platform.pullImage')}</button>
          </div>
          {imageList.map((img) => (
            <div key={`${img.repository}:${img.tag}:${img.id}`} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #222', color: '#94a3b8', fontFamily: 'monospace' }}>
              {img.repository}:{img.tag} · {img.size}
            </div>
          ))}
        </div>
      )}

      {platformTab === 'networks' && (
        <div style={card}>
          {networkList.map((n) => (
            <div key={n.id || n.name} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #222', color: '#94a3b8' }}>
              {n.name} · {n.driver} · {n.scope}
            </div>
          ))}
        </div>
      )}

      {platformTab === 'volumes' && (
        <div style={card}>
          {volumeList.map((v) => (
            <div key={v.name} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #222', color: '#94a3b8' }}>
              {v.name} · {v.driver}
            </div>
          ))}
        </div>
      )}

      {platformTab === 'stacks' && (
      <>

      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Server size={14} /> {t('stacks.runtime')}
        </div>
        {runtime?.available ? (
          <div style={{ fontSize: '12px', color: '#a7f3d0' }}>
            <CheckCircle2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {runtime.engine} {runtime.version}
            {runtime.composeAvailable ? ` · compose` : ` · ${t('stacks.noComposePlugin')}`}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#fca5a5' }}>
            <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {runtime?.message || t('stacks.runtimeMissing')}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('stacks.devProfile')}</div>
        {profile ? (
          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
            <div><strong>{profile.name}</strong> {profileFile ? `· ${profileFile}` : ''}</div>
            {profile.compose && <div>compose: {profile.compose}</div>}
            {profile.autoUp && <div style={{ color: '#6ee7b7' }}>{t('stacks.autoUp')}</div>}
            {profile.sandbox?.image && (
              <div>
                sandbox: {profile.sandbox.image}
                {profile.sandbox.memory ? ` · ${profile.sandbox.memory}` : ''}
                {profile.sandbox.cpus ? ` · ${profile.sandbox.cpus} CPU` : ''}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px' }}>{t('stacks.noProfile')}</p>
        )}
        <button type="button" style={btn()} onClick={() => void act('init')} disabled={!!busy}>
          <Sparkles size={14} /> {t('stacks.initExample')}
        </button>
      </div>

      {previewUrls.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>{t('stacks.previewUrls')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', color: '#93c5fd', textDecoration: 'none'
                }}
              >
                <ExternalLink size={13} /> {url}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('stacks.composeFiles')}</div>
        {files.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{t('stacks.noCompose')}</p>
        ) : (
          <select
            value={selectedFile}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedFile(v);
              selectedFileRef.current = v;
              void refresh(v);
            }}
            style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#0a0a0a', color: '#ddd', border: '1px solid #333' }}
          >
            {files.map((f) => (
              <option key={f.file} value={f.file}>
                {f.file} {f.services?.length ? `(${f.services.join(', ')})` : ''}
              </option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button type="button" style={btn(true)} onClick={() => void act('up')} disabled={!!busy || !runtime?.composeAvailable}>
            <Play size={14} /> {t('stacks.up')}
          </button>
          <button type="button" style={btn()} onClick={() => void act('down')} disabled={!!busy || !runtime?.composeAvailable}>
            <Square size={14} /> {t('stacks.down')}
          </button>
          <button type="button" style={btn()} onClick={() => void act('logs')} disabled={!!busy || !runtime?.composeAvailable}>
            <FileText size={14} /> {t('stacks.logs')}
          </button>
          <button type="button" style={btn()} onClick={() => void stackExtra('pull')} disabled={!!busy || !runtime?.composeAvailable}>{t('platform.pull')}</button>
          <button type="button" style={btn()} onClick={() => void stackExtra('restart')} disabled={!!busy || !runtime?.composeAvailable}>{t('platform.restart')}</button>
          <button type="button" style={btn()} onClick={() => void stackExtra('build')} disabled={!!busy || !runtime?.composeAvailable}>{t('platform.build')}</button>
          <input
            value={logService}
            onChange={(e) => setLogService(e.target.value)}
            placeholder={t('stacks.serviceFilter')}
            style={{ flex: 1, minWidth: '120px', padding: '8px', borderRadius: '8px', background: '#0a0a0a', color: '#ddd', border: '1px solid #333', fontSize: '12px' }}
          />
        </div>
        {msg && <p style={{ fontSize: '12px', color: msg.includes('Fail') || msg.includes('ناموفق') ? '#fca5a5' : '#6ee7b7', marginTop: '10px' }}>{msg}</p>}
      </div>

      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>{t('stacks.services')}</div>
        {services.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{t('stacks.noServices')}</p>
        ) : (
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>{t('stacks.colService')}</th>
                <th style={{ padding: '6px 4px' }}>{t('stacks.colState')}</th>
                <th style={{ padding: '6px 4px' }}>{t('stacks.colPorts')}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name || s.service} style={{ borderTop: '1px solid #222' }}>
                  <td style={{ padding: '8px 4px', color: '#e5e5e5' }}>{s.service || s.name}</td>
                  <td style={{ padding: '8px 4px', color: /running|up/i.test(s.state) ? '#6ee7b7' : '#fbbf24' }}>
                    {s.state}{s.health ? ` (${s.health})` : ''}
                  </td>
                  <td style={{ padding: '8px 4px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.ports || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {containers.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Box size={14} /> {t('stacks.allContainers')}
          </div>
          <div style={{ maxHeight: '160px', overflow: 'auto', fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>
            {containers.slice(0, 20).map((c) => (
              <div key={c.id || c.name} style={{ padding: '4px 0', borderBottom: '1px solid #1f1f1f' }}>
                {c.name} · {c.image} · {c.state} {c.ports ? `· ${c.ports}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {logs && (
        <div style={card}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('stacks.logOutput')}</div>
          <pre style={{
            margin: 0, maxHeight: '280px', overflow: 'auto', fontSize: '11px',
            background: '#0a0a0a', padding: '10px', borderRadius: '8px', color: '#a3a3a3', whiteSpace: 'pre-wrap'
          }}>
            {logs}
          </pre>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default StacksView;
