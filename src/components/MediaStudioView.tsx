import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Mic, Music, Image, FileText, Video, Cpu, RefreshCw, Play, Layers, Download,
  CheckCircle2, XCircle, AlertCircle, Sparkles, ExternalLink, Package, GitBranch
} from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type CapRow = {
  id: string;
  name: string;
  category: string;
  license: string;
  integration: string;
  description?: string;
  tools?: string[];
  pipPackages?: string[];
  composeStack?: string | null;
  available: boolean;
  sourceAvailable?: boolean;
  mode: string | null;
  detail: string | null;
  exampleExists?: boolean;
  port?: number | null;
};

type Pipeline = { id: string; name: string; steps: number };

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'speech-in': <Mic size={16} />,
  'speech-out': <Mic size={16} />,
  music: <Music size={16} />,
  analysis: <Music size={16} />,
  vision: <Image size={16} />,
  video: <Video size={16} />,
  document: <FileText size={16} />,
  training: <Cpu size={16} />,
  llm: <Cpu size={16} />,
  automation: <Layers size={16} />,
  runtime: <Layers size={16} />,
};

const QUICK_ACTIONS: Record<string, { label: string; action: string; fields?: string[] }[]> = {
  'speech-in': [{ label: 'Transcribe', action: 'transcribe', fields: ['audio'] }],
  'speech-out': [
    { label: 'TTS', action: 'textToSpeech', fields: ['text'] },
    { label: 'Bark', action: 'generateAudio', fields: ['text'] }
  ],
  music: [
    { label: 'Separate stems', action: 'separateAudio', fields: ['audio'] },
    { label: 'Audio→MIDI', action: 'audioToMidi', fields: ['audio'] },
    { label: 'Generate music', action: 'generateMusic', fields: ['prompt'] }
  ],
  analysis: [{ label: 'Analyze', action: 'analyzeAudio', fields: ['audio'] }],
  vision: [{ label: 'Generate image', action: 'generateImage', fields: ['prompt'] }],
  video: [
    { label: 'Talking head', action: 'talkingHead', fields: ['image', 'audio'] },
    { label: 'Animate', action: 'animateImage', fields: ['config'] },
    { label: 'Lip sync', action: 'lipSync', fields: ['face', 'audio'] }
  ],
  document: [
    { label: 'OCR image', action: 'ocrDocument', fields: ['image'] },
    { label: 'OCR PDF', action: 'ocrPdf', fields: ['file'] }
  ],
  training: [{ label: 'Train LoRA', action: 'trainLoRA' }],
  llm: [{ label: 'Pull model', action: 'ollamaPull', fields: ['model'] }]
};

const OPEN_URLS: Record<string, number> = {
  comfyui: 8188,
  'stable-diffusion-webui': 7860,
  kohya_ss: 7861,
  n8n: 5678,
  tts: 5002
};

const MediaStudioView: React.FC = () => {
  const { t } = useI18n();
  const [caps, setCaps] = useState<CapRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [exampleRoot, setExampleRoot] = useState('');
  const [summary, setSummary] = useState<{ total: number; available: number; sourceAvailable?: number } | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<CapRow | null>(null);
  const [bootstrapJob, setBootstrapJob] = useState<string | null>(null);
  const [bootstrapLog, setBootstrapLog] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({
    text: 'Hello from FA7 Media Studio',
    audio: 'sample.wav',
    image: 'portrait.png',
    face: 'video.mp4',
    file: 'document.pdf',
    prompt: 'calm ambient music',
    config: 'configs/config.yaml',
    model: 'qwen2.5:7b'
  });

  const refresh = useCallback(async () => {
    setBusy('refresh');
    setMsg('');
    try {
      const [status, pipe] = await Promise.all([
        axios.get(`${API}/v3/media/status`),
        axios.get(`${API}/v3/media/pipelines`)
      ]);
      setCaps(Array.isArray(status.data?.capabilities) ? status.data.capabilities : []);
      setCategories(Array.isArray(status.data?.categories) ? status.data.categories : []);
      setExampleRoot(status.data?.exampleRoot || '');
      setSummary(status.data?.summary || null);
      setPipelines(Array.isArray(pipe.data?.pipelines) ? pipe.data.pipelines : []);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const post = async (url: string, body?: object) => {
    const res = await axios.post(`${API}${url}`, body || {});
    setMsg(JSON.stringify(res.data, null, 2).slice(0, 3000));
    return res.data;
  };

  const initStack = (id: string) => { setBusy('stack'); post('/v3/media/init-stack', { capabilityId: id }).finally(() => setBusy(null)); };
  const initAllStacks = () => { setBusy('stacks'); post('/v3/media/init-all-stacks').finally(() => setBusy(null)); };
  const installDeps = (id?: string) => { setBusy('pip'); post('/v3/media/install-deps', id ? { capabilityId: id } : {}).finally(() => setBusy(null)); };
  const runPipeline = (id: string) => { setBusy('pipe'); post('/v3/media/run', { pipelineId: id, input: inputs }).finally(() => setBusy(null)); };

  const pollBootstrap = useCallback(async (jobId: string) => {
    const poll = async () => {
      const res = await axios.get(`${API}/v3/media/bootstrap/${jobId}`);
      const events = Array.isArray(res.data?.events) ? res.data.events : [];
      setBootstrapLog(events.map((e: { phase: string; status?: string; sub?: { capability?: string } }) =>
        `[${e.phase}] ${e.status || ''} ${e.sub?.capability || ''}`.trim()
      ));
      if (res.data?.status === 'running') {
        setTimeout(poll, 2000);
      } else {
        setBusy(null);
        setBootstrapJob(null);
        setMsg(JSON.stringify(res.data?.report || res.data, null, 2).slice(0, 3000));
        refresh();
      }
    };
    poll();
  }, [refresh]);

  const completeSetup = async (withStacks: boolean) => {
    setBusy('bootstrap');
    setBootstrapLog([]);
    setMsg('');
    try {
      const res = await axios.post(`${API}/v3/media/bootstrap`, {
        startStacks: withStacks,
        pip: true,
        exampleReqs: true,
        initStacks: true
      });
      if (res.data?.jobId) {
        setBootstrapJob(res.data.jobId);
        pollBootstrap(res.data.jobId);
      } else {
        setMsg(JSON.stringify(res.data, null, 2));
        setBusy(null);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e.message);
      setBusy(null);
    }
  };

  const quickRun = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected) return;
    setBusy('run');
    try {
      await post('/v3/media/run', { capabilityId: selected.id, action, ...extra });
    } finally {
      setBusy(null);
    }
  };

  const filtered = filter === 'all' ? caps : caps.filter((c) => c.category === filter);
  const actions = selected ? (QUICK_ACTIONS[selected.category] || []) : [];

  return (
    <div className="media-studio-view" style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Sparkles size={22} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{t('media.title')}</h2>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{t('media.subtitle')}</p>
        </div>
        <button type="button" onClick={refresh} disabled={!!busy}><RefreshCw size={14} /> {t('media.refresh')}</button>
        <button type="button" onClick={() => completeSetup(false)} disabled={!!busy} style={{ fontWeight: 600 }}>
          <Sparkles size={14} /> {t('media.completeSetup')}
        </button>
        <button type="button" onClick={() => completeSetup(true)} disabled={!!busy}>
          <Layers size={14} /> {t('media.completeSetupStacks')}
        </button>
        <button type="button" onClick={initAllStacks} disabled={!!busy}><Layers size={14} /> {t('media.initAllStacks')}</button>
        <button type="button" onClick={() => installDeps()} disabled={!!busy}><Package size={14} /> {t('media.installAllDeps')}</button>
      </header>

      {summary && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          {summary.available} / {summary.total} {t('media.availableLabel')}
          {summary.sourceAvailable != null && (
            <span style={{ marginLeft: 12 }}>{summary.sourceAvailable} {t('media.sourceLabel')}</span>
          )}
          {exampleRoot && <span style={{ marginLeft: 12, opacity: 0.6 }}>ROOT: {exampleRoot}</span>}
        </div>
      )}

      {bootstrapLog.length > 0 && (
        <pre style={{ marginBottom: 12, padding: 10, background: '#0a1628', borderRadius: 8, fontSize: 11, maxHeight: 120, overflow: 'auto' }}>
          {bootstrapLog.slice(-15).join('\n')}
          {bootstrapJob && ' …'}
        </pre>
      )}

      {pipelines.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <GitBranch size={14} />
          <span style={{ fontSize: 13, opacity: 0.8 }}>{t('media.pipelines')}:</span>
          {pipelines.map((p) => (
            <button key={p.id} type="button" onClick={() => runPipeline(p.id)} disabled={!!busy} title={p.name}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({caps.length})</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className={filter === c.id ? 'active' : ''} onClick={() => setFilter(c.id)}>
            {CATEGORY_ICONS[c.id]} {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, minHeight: 380 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              style={{
                textAlign: 'left', padding: 10, borderRadius: 8,
                border: selected?.id === c.id ? '1px solid var(--accent, #6366f1)' : '1px solid #333',
                background: selected?.id === c.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                cursor: 'pointer', color: 'inherit'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.available ? <CheckCircle2 size={15} color="#22c55e" /> :
                  c.sourceAvailable ? <AlertCircle size={15} color="#eab308" /> :
                  <XCircle size={15} color="#ef4444" />}
                <strong style={{ fontSize: 14 }}>{c.name}</strong>
                <span style={{ fontSize: 10, opacity: 0.45 }}>{c.license}</span>
                {c.mode && <span style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.7 }}>{c.mode}</span>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>
                {(c.tools || []).join(', ')}
              </div>
            </button>
          ))}
        </div>

        <aside style={{ border: '1px solid #333', borderRadius: 8, padding: 12, overflow: 'auto' }}>
          {selected ? (
            <>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>{selected.name}</h3>
              <p style={{ fontSize: 12, opacity: 0.7 }}>{selected.description || selected.detail || t('media.notInstalled')}</p>
              {selected.pipPackages && selected.pipPackages.length > 0 && (
                <p style={{ fontSize: 11, opacity: 0.6 }}>pip: {selected.pipPackages.join(', ')}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {selected.composeStack && (
                  <button type="button" onClick={() => initStack(selected.id)} disabled={!!busy}>
                    <Layers size={14} /> {t('media.initStack')}
                  </button>
                )}
                {selected.pipPackages && selected.pipPackages.length > 0 && (
                  <button type="button" onClick={() => installDeps(selected.id)} disabled={!!busy}>
                    <Download size={14} /> {t('media.installDeps')}
                  </button>
                )}
                {OPEN_URLS[selected.id] && (
                  <a href={`http://localhost:${OPEN_URLS[selected.id]}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open UI :{OPEN_URLS[selected.id]}
                  </a>
                )}
                {actions.map((a) => (
                  <div key={a.action}>
                    {(a.fields || []).map((f) => (
                      <input
                        key={f}
                        style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
                        value={inputs[f] || ''}
                        onChange={(e) => setInputs((prev) => ({ ...prev, [f]: e.target.value }))}
                        placeholder={f}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => quickRun(a.action, Object.fromEntries((a.fields || []).map((f) => [f, inputs[f]])))}
                      disabled={!!busy}
                    >
                      <Play size={14} /> {a.label}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ opacity: 0.6 }}>{t('media.selectCapability')}</p>
          )}
        </aside>
      </div>

      {msg && (
        <pre style={{ marginTop: 12, padding: 12, background: '#111', borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 220 }}>
          {msg}
        </pre>
      )}
    </div>
  );
};

export default MediaStudioView;
