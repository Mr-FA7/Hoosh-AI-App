import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Download, Cpu, Package, CheckCircle, Shield, Trash2, RefreshCw, Mic, MicOff, HardDrive, Cloud, Zap, CheckSquare, Search, AlertCircle, Info, Activity } from 'lucide-react';
import './EngineView.css';
import axios from 'axios';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type Preset = { name: string; label: string };
type OllamaConfig = { ollamaBase: string; ollamaApiKey: string; activeBase?: string };
type ModelAccessMode = 'online' | 'offline' | 'hybrid' | 'user';
type ModelAccessPrefs = {
  mode: ModelAccessMode;
  allowOnline: boolean;
  allowOffline: boolean;
  allowHybrid: boolean;
  enabledModels: string[];
};

const MODEL_PREFS_KEY = 'hoosh_model_preferences_v1';

function ollamaNamesCompatible(a: string, b: string): boolean {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y + ':') || y.startsWith(x + ':');
}

/** Match catalog row to Ollama /api/ps rows (e.g. `llama3.2` ↔ `llama3.2:latest`). */
function catalogRowMatchesRunningPs(catalogName: string, psModels: any[] | undefined | null): boolean {
  const list = Array.isArray(psModels) ? psModels : [];
  const n = String(catalogName || '').trim();
  if (!n) return false;
  return list.some((r: any) => ollamaNamesCompatible(n, String(r?.name || '')));
}

const DEFAULT_MODEL_PREFS: ModelAccessPrefs = {
  mode: 'hybrid',
  allowOnline: true,
  allowOffline: true,
  allowHybrid: true,
  enabledModels: []
};

const readModelPrefs = (): ModelAccessPrefs => {
  try {
    const raw = localStorage.getItem(MODEL_PREFS_KEY);
    if (!raw) return { ...DEFAULT_MODEL_PREFS };
    const parsed = JSON.parse(raw);
    const mode: ModelAccessMode =
      parsed?.mode === 'online' || parsed?.mode === 'offline' || parsed?.mode === 'hybrid' || parsed?.mode === 'user'
        ? parsed.mode
        : 'hybrid';
    return {
      mode,
      allowOnline: parsed?.allowOnline !== false,
      allowOffline: parsed?.allowOffline !== false,
      allowHybrid: parsed?.allowHybrid !== false,
      enabledModels: Array.isArray(parsed?.enabledModels) ? parsed.enabledModels.map((x: any) => String(x)).filter(Boolean) : []
    };
  } catch {
    return { ...DEFAULT_MODEL_PREFS };
  }
};

/** When not in "user" mode, keep mode in sync with channel toggles. */
function reconcileModelAccessChannels(allowOnline: boolean, allowOffline: boolean): Omit<ModelAccessPrefs, 'enabledModels'> {
  if (allowOnline && allowOffline) {
    return { mode: 'hybrid', allowOnline: true, allowOffline: true, allowHybrid: true };
  }
  if (allowOnline && !allowOffline) {
    return { mode: 'online', allowOnline: true, allowOffline: false, allowHybrid: false };
  }
  if (!allowOnline && allowOffline) {
    return { mode: 'offline', allowOnline: false, allowOffline: true, allowHybrid: false };
  }
  return { mode: 'hybrid', allowOnline: true, allowOffline: true, allowHybrid: true };
}

function enabledModelsForPresetMode(
  mode: ModelAccessMode,
  rows: Array<{ name: string; installed?: boolean; online?: boolean; availableOnline?: boolean }>
): string[] {
  if (mode === 'hybrid') return rows.map((r) => r.name);
  if (mode === 'online') return rows.filter((m) => m.online || m.availableOnline).map((m) => m.name);
  if (mode === 'offline') return rows.filter((m) => m.installed).map((m) => m.name);
  return rows.map((r) => r.name);
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const EngineView: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<any>(null);
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [interactiveInstall, setInteractiveInstall] = useState<{ name: string; command: string } | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [pullName, setPullName] = useState('');
  const [pullLog, setPullLog] = useState('');
  const [ollamaCfg, setOllamaCfg] = useState<OllamaConfig>({ ollamaBase: '', ollamaApiKey: '' });
  const [ollamaVersion, setOllamaVersion] = useState<any>(null);
  const [ollamaPs, setOllamaPs] = useState<any>(null);
  const [embedModel, setEmbedModel] = useState('llama3.2');
  const [embedInput, setEmbedInput] = useState('');
  const [embedOut, setEmbedOut] = useState<string>('');
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [catalogModels, setCatalogModels] = useState<any[]>([]);
  const [probingOnline, setProbingOnline] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [modelPrefs, setModelPrefs] = useState<ModelAccessPrefs>(() => readModelPrefs());
  const [modelQuery, setModelQuery] = useState('');
  const [healthQuery, setHealthQuery] = useState('');
  const [customTools, setCustomTools] = useState<any[]>([]);
  const [customName, setCustomName] = useState('');
  const [customCheck, setCustomCheck] = useState('');
  const [customInstall, setCustomInstall] = useState('');
  const [customUninstall, setCustomUninstall] = useState('');
  const [manualInstallCmd, setManualInstallCmd] = useState('');
  const [giraVoiceText, setGiraVoiceText] = useState('');
  const [giraVoiceLog, setGiraVoiceLog] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const speechRef = useRef<any | null>(null);
  /** Abort current Ollama pull (client) — then we DELETE partial model on companion */
  const pullAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchData();
    fetchOllamaMeta();
    fetchInstalledModels();
    fetchModelCatalog();
    fetchCustomTools();
    fetch('/data/ollama-model-presets.json')
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d?.presets) ? d.presets : []))
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!Ctor);
    return () => {
      try { speechRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MODEL_PREFS_KEY, JSON.stringify(modelPrefs));
    try {
      window.dispatchEvent(new CustomEvent('fa7-model-prefs-changed'));
    } catch {
      /* ignore */
    }
  }, [modelPrefs]);

  const fetchInstalledModels = async () => {
    try {
      const r = await axios.get(`${API_BASE}/ai/models`);
      setInstalledModels(r.data?.models || []);
    } catch { setInstalledModels([]); }
  };

  const fetchModelCatalog = async (probe = false) => {
    try {
      const r = await axios.get(`${API_BASE}/ai/models/catalog${probe ? '?probe=1' : ''}`);
      if (r.data?.ok && Array.isArray(r.data?.models)) {
        setCatalogModels(r.data.models);
      } else {
        setCatalogModels([]);
      }
    } catch {
      setCatalogModels([]);
    }
  };
  const runOnlineProbe = async () => {
    setProbingOnline(true);
    try {
      await fetchModelCatalog(true);
    } finally {
      setProbingOnline(false);
    }
  };

  const fetchCustomTools = async () => {
    try {
      const r = await axios.get(`${API_BASE}/v3/system/custom-tools`);
      setCustomTools(r.data?.tools || []);
    } catch {
      setCustomTools([]);
    }
  };

  const deleteModel = async (name: string) => {
    if (!window.confirm(`Delete model "${name}"? This cannot be undone.`)) return;
    setDeletingModel(name);
    try {
      await axios.delete(`${API_BASE}/ai/models/${encodeURIComponent(name)}`);
      await fetchInstalledModels();
      await fetchModelCatalog();
    } catch (e: any) {
      window.alert('Failed to delete: ' + (e?.response?.data?.error || e?.message || 'unknown error'));
    } finally {
      setDeletingModel(null);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const gb = bytes / 1e9;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
  };

  const fetchData = async () => {
    const [s, h] = await Promise.all([
      axios.get(`${API_BASE}/v3/engine/status`),
      axios.get(`${API_BASE}/v3/system/health`)
    ]);
    setStatus(s.data);
    setHealth(h.data);
  };

  const fetchOllamaMeta = async () => {
    try {
      const [cfg, ver, ps] = await Promise.all([
        axios.get(`${API_BASE}/ollama/config`),
        axios.get(`${API_BASE}/ollama/version`).catch(() => ({ data: null })),
        axios.get(`${API_BASE}/ollama/ps`).catch(() => ({ data: null }))
      ]);
      if (cfg.data?.ok) {
        setOllamaCfg({
          ollamaBase: cfg.data.ollamaBase || '',
          ollamaApiKey: cfg.data.ollamaApiKey || '',
          activeBase: cfg.data.activeBase || ''
        });
      }
      setOllamaVersion(ver.data);
      setOllamaPs(ps.data);
    } catch {
      /* ignore */
    }
  };

  const setupEngine = async () => {
    setLoading('engine');
    try {
      await axios.post(`${API_BASE}/v3/engine/setup`);
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const runFullBodyScan = async () => {
    setDiagnosing(true);
    setShowDiagModal(true);
    try {
      const res = await axios.get(`${API_BASE}/diagnostics`);
      setDiagnosticResult(res.data);
    } catch (e) {
      setDiagnosticResult({ error: 'Neural bridge disconnected.' });
    } finally {
      setDiagnosing(false);
    }
  };

  const applyRepair = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/repair`, { id });
      runFullBodyScan(); // Refresh
    } catch (e) {
      alert('Repair failed.');
    }
  };

  const installTool = async (name: string) => {
    setLoading(name);
    try {
      const r = await axios.post(`${API_BASE}/v3/system/install`, { name });
      if (r.data?.error) {
        window.alert(r.data.error + (r.data?.details ? `\n\n${r.data.details}` : ''));
      } else if (r.data?.message) {
        window.alert(r.data.message);
      }
      if (r.data?.interactive && r.data?.command) {
        setInteractiveInstall({ name, command: String(r.data.command) });
      }
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const uninstallTool = async (name: string) => {
    if (!window.confirm(`Remove "${name}" from this machine? You can install it again later.`)) return;
    setLoading(`uninstall:${name}`);
    try {
      const r = await axios.post(`${API_BASE}/v3/system/uninstall`, { name });
      if (r.data?.error) {
        window.alert(r.data.error);
      }
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const addCustomTool = async () => {
    if (!customName.trim() || !customInstall.trim()) {
      window.alert('Name and install command are required.');
      return;
    }
    setLoading('custom:add');
    try {
      const r = await axios.post(`${API_BASE}/v3/system/custom-tools`, {
        name: customName,
        check_cmd: customCheck,
        install_cmd: customInstall,
        uninstall_cmd: customUninstall
      });
      if (!r.data?.ok) {
        window.alert(r.data?.error || 'Failed to add custom tool');
      }
      setCustomName('');
      setCustomCheck('');
      setCustomInstall('');
      setCustomUninstall('');
      await fetchCustomTools();
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const removeCustomTool = async (name: string) => {
    if (!window.confirm(`Remove custom tool "${name}" from list?`)) return;
    setLoading(`custom:rm:${name}`);
    try {
      await axios.delete(`${API_BASE}/v3/system/custom-tools/${encodeURIComponent(name)}`);
      await fetchCustomTools();
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const runManualInstallCommand = async () => {
    const command = manualInstallCmd.trim();
    if (!command) return;
    setLoading('manual-install');
    try {
      const r = await axios.post(`${API_BASE}/v3/system/install-command`, {
        command,
        source: 'user'
      });
      if (!r.data?.ok && r.data?.status !== 'success') {
        window.alert(r.data?.error || 'Command failed');
      } else if (r.data?.message) {
        window.alert(r.data.message);
      }
      await fetchData();
    } finally {
      setLoading(null);
    }
  };

  const downloadOllamaRuntime = async () => {
    setLoading('runtime-dl');
    try {
      const r = await axios.post(`${API_BASE}/ollama/download-runtime`);
      if (r.data?.cached) {
        window.alert('Binary already exists in ~/.nava-ai.');
      } else if (r.data?.ok) {
        const restarted = r.data?.ollamaRestarted;
        window.alert(
          restarted
            ? 'Download completed and managed Ollama service restarted automatically.'
            : 'Download completed.'
        );
      }
      await fetchData();
      await fetchOllamaMeta();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      window.alert(ax?.response?.data?.error || ax?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const saveOllamaConfig = async () => {
    setLoading('ollama-config');
    try {
      const r = await axios.post(`${API_BASE}/ollama/config`, {
        ollamaBase: ollamaCfg.ollamaBase,
        ollamaApiKey: ollamaCfg.ollamaApiKey
      });
      if (r.data?.ok) {
        setOllamaCfg((p) => ({ ...p, activeBase: r.data.activeBase || p.activeBase }));
      }
      await fetchData();
      await fetchOllamaMeta();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      window.alert(ax?.response?.data?.error || ax?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const setCloud = () => {
    setOllamaCfg((p) => ({ ...p, ollamaBase: 'https://ollama.com/api' }));
  };

  const setLocal = () => {
    setOllamaCfg((p) => ({ ...p, ollamaBase: '' }));
  };

  const runEmbed = async () => {
    if (!embedInput.trim()) return;
    setLoading('embed');
    setEmbedOut('');
    try {
      const r = await axios.post(`${API_BASE}/ollama/embed`, {
        model: embedModel,
        input: embedInput
      });
      const v = r.data?.embeddings || r.data?.embedding || null;
      if (Array.isArray(v)) {
        const first = Array.isArray(v[0]) ? v[0] : v;
        setEmbedOut(`dims: ${first?.length ?? '?'}\npreview: ${JSON.stringify(first?.slice?.(0, 8) ?? first)}`);
      } else {
        setEmbedOut(JSON.stringify(r.data, null, 2));
      }
    } catch (e: unknown) {
      setEmbedOut(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(null);
    }
  };

  const deletePartialPull = async (modelName: string) => {
    try {
      await axios.delete(`${API_BASE}/ai/models/${encodeURIComponent(modelName)}`);
      setPullLog((p) => p + '✓ Download stopped; incomplete model removed.\n');
    } catch (del: any) {
      const st = del?.response?.status;
      const msg =
        st === 404
          ? 'Nothing was registered to remove.'
          : String(del?.response?.data?.error || del?.message || 'Delete failed');
      setPullLog((p) => p + ` (${msg})\n`);
    }
    await fetchInstalledModels();
    await fetchModelCatalog();
    await fetchData();
  };

  const pullModelStream = async (name: string) => {
    const n = name.trim();
    if (!n) return;
    const ac = new AbortController();
    pullAbortRef.current = ac;
    setLoading('pull');
    setPullLog('');
    try {
      const res = await fetch(`${API_BASE}/ollama/pull-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
        signal: ac.signal
      });
      if (!res.ok) {
        if (res.status === 499) {
          setPullLog((p) => p + '\n⚠️ Cancelled.\n');
          await deletePartialPull(n);
          return;
        }
        const j = await res.json().catch(() => ({}));
        setPullLog('Error: ' + ((j as { error?: string }).error || res.status));
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setPullLog('No stream body');
        return;
      }
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            await fetchInstalledModels();
            await fetchModelCatalog();
            break;
          }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const j = JSON.parse(line) as Record<string, unknown>;
              const bit =
                typeof j.status === 'string'
                  ? j.status
                  : typeof j.digest === 'string'
                    ? j.digest
                    : JSON.stringify(j);
              setPullLog((p) => p + bit + '\n');
            } catch {
              setPullLog((p) => p + line + '\n');
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
      await fetchData();
    } catch (e: unknown) {
      const isAbort =
        e instanceof DOMException
          ? e.name === 'AbortError'
          : e instanceof Error
            ? e.name === 'AbortError'
            : typeof e === 'object' &&
              e !== null &&
              (e as { name?: string }).name === 'AbortError';
      if (isAbort) {
        setPullLog((p) => p + '\n⚠️ Cancelled — removing partial download…\n');
        await deletePartialPull(n);
      } else {
        setPullLog(String(e instanceof Error ? e.message : e));
      }
    } finally {
      pullAbortRef.current = null;
      setLoading(null);
    }
  };

  const extractCommandPayload = (cmd: string, keywords: string[]) => {
    const source = String(cmd || '').trim();
    let result = source;
    for (const kw of keywords) {
      const idx = source.toLowerCase().indexOf(kw);
      if (idx >= 0) {
        result = source.slice(idx + kw.length).trim();
        break;
      }
    }
    return result.replace(/^[:\-\s]+/, '').trim();
  };

  const runGiraVoiceCommand = async (raw?: string) => {
    const text = String(raw ?? giraVoiceText).trim();
    if (!text) return;
    const lower = text.toLowerCase();
    setGiraVoiceLog((p) => `${p}${p ? '\n' : ''}> ${text}`);

    const urlMatch = text.match(/https?:\/\/\S+/i);
    if (urlMatch) {
      setLoading('gira-voice');
      try {
        const url = urlMatch[0];
        const r = await axios.post(`${API_BASE}/v3/gira/download/direct`, { url });
        if (r.data?.ok) setGiraVoiceLog((p) => `${p}\n✅ Download started: ${url}`);
        else setGiraVoiceLog((p) => `${p}\n❌ Gira failed: ${r.data?.error || 'unknown error'}`);
      } catch (e: any) {
        setGiraVoiceLog((p) => `${p}\n❌ ${e?.response?.data?.error || e?.message || 'error'}`);
      } finally {
        setLoading(null);
      }
      return;
    }

    const wantsDelete = /(delete|remove|uninstall)/i.test(lower);
    const wantsDownload = /(pull|download|get)/i.test(lower);

    if (wantsDelete) {
      const model = extractCommandPayload(text, ['delete model', 'delete', 'remove model', 'remove']).trim();
      if (!model) {
        setGiraVoiceLog((p) => `${p}\n⚠️ Model name is missing for delete.`);
        return;
      }
      await deleteModel(model);
      setGiraVoiceLog((p) => `${p}\n🗑️ Delete requested for model: ${model}`);
      return;
    }

    if (wantsDownload) {
      const model = extractCommandPayload(text, ['pull model', 'pull', 'download model', 'download', 'get model', 'get']).trim();
      if (!model) {
        setGiraVoiceLog((p) => `${p}\n⚠️ Model name or download URL is missing.`);
        return;
      }
      await pullModelStream(model);
      setGiraVoiceLog((p) => `${p}\n⬇️ Pull requested for model: ${model}`);
      return;
    }

    setGiraVoiceLog((p) => `${p}\nℹ️ Command not recognized. Example: "download model llama3.2", "delete model mistral:latest", or a direct URL.`);
  };

  const toggleGiraVoice = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      window.alert('Voice input is not supported in this environment.');
      return;
    }
    if (isVoiceListening) {
      try { speechRef.current?.stop?.(); } catch { /* ignore */ }
      setIsVoiceListening(false);
      return;
    }
    const rec = new Ctor();
    speechRef.current = rec;
    rec.lang = /[\u0600-\u06FF]/.test(giraVoiceText) ? 'fa-IR' : 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const base = giraVoiceText;
    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = String(event.results[i]?.[0]?.transcript || '');
        if (event.results[i].isFinal) final += txt;
        else interim += txt;
      }
      const merged = `${base}${base && (interim || final) ? ' ' : ''}${(final || interim).trim()}`.trim();
      setGiraVoiceText(merged);
    };
    rec.onerror = () => setIsVoiceListening(false);
    rec.onend = () => {
      setIsVoiceListening(false);
      speechRef.current = null;
    };
    try {
      rec.start();
      setIsVoiceListening(true);
    } catch {
      setIsVoiceListening(false);
    }
  };

  const rt = status?.ollamaRuntime;
  const filteredHealth = health.filter((tool) =>
    String(tool?.name || '').toLowerCase().includes(healthQuery.trim().toLowerCase())
  );
  const installedMap = new Map<string, any>(installedModels.map((m: any) => [String(m?.name || ''), m]));
  const presetMap = new Map<string, string>(presets.map((p) => [p.name, p.label]));
  const allModelNames = Array.from(new Set([
    ...Array.from(presetMap.keys()),
    ...installedModels.map((m: any) => String(m?.name || ''))
  ])).filter(Boolean);
  const fallbackRows = allModelNames.map((name) => {
    const installed = installedMap.get(name) || null;
    const label = presetMap.get(name) || name;
    const isRunning = catalogRowMatchesRunningPs(name, ollamaPs?.models);
    return {
      name,
      label,
      installed: !!installed,
      availableOnline: false,
      isRunning,
      size: installed?.size,
      parameterSize: installed?.details?.parameter_size || ''
    };
  });
  const modelRows = catalogModels.length > 0
    ? catalogModels.map((m: any) => ({
        name: String(m?.name || ''),
        label: String(m?.label || m?.name || ''),
        installed: !!m?.installed,
        /** Cloud / API models — not something you "install" locally like a pulled Ollama tag */
        availableOnline: !!m?.available_online,
        online: String(m?.chat_state || '') === 'online',
        chatState: String(m?.chat_state || 'unknown'),
        onlineReason: String(m?.online_reason || ''),
        isRunning: catalogRowMatchesRunningPs(String(m?.name || ''), ollamaPs?.models),
        size: m?.size,
        parameterSize: String(m?.parameter_size || '')
      }))
    : fallbackRows.map((m: any) => ({
        ...m,
        online: false,
        chatState: 'unknown',
        onlineReason: 'Not probed',
        availableOnline: false
      }));
  const rowIsOnlineCatalog = (m: { availableOnline?: boolean; online?: boolean }) =>
    !!(m.availableOnline || m.online);
  const filteredModelRows = modelRows.filter((m) => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.label.toLowerCase().includes(q);
  }).sort((a, b) => {
    const ao = rowIsOnlineCatalog(a);
    const bo = rowIsOnlineCatalog(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    if (a.isRunning !== b.isRunning) return a.isRunning ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  const resolvedEnabledSet = (() => {
    if (modelPrefs.mode === 'online') {
      return new Set(
        modelRows.filter((m: any) => m.online || m.availableOnline).map((m: any) => m.name)
      );
    }
    if (modelPrefs.mode === 'offline') {
      return new Set(modelRows.filter((m: any) => m.installed).map((m: any) => m.name));
    }
    if (modelPrefs.mode === 'hybrid') {
      return new Set(modelRows.map((m: any) => m.name));
    }
    return new Set(modelPrefs.enabledModels.filter(Boolean));
  })();

  const isModelRowChecked = (rowName: string) => {
    if (modelPrefs.mode === 'user') {
      return modelPrefs.enabledModels.some((en) => ollamaNamesCompatible(rowName, String(en)));
    }
    return resolvedEnabledSet.has(rowName);
  };

  const toggleModelEnabled = (name: string) => {
    const row = modelRows.find((x: any) => String(x?.name || '') === name);
    // Local/offline catalog entries require a pull before they can be enabled
    if (row && !row.availableOnline && !row.installed) return;
    setModelPrefs((prev) => {
      const curr = new Set(
        (prev.mode === 'user' ? prev.enabledModels : modelRows.map((m: any) => m.name)).filter(Boolean)
      );
      if (curr.has(name)) curr.delete(name);
      else curr.add(name);
      return {
        ...prev,
        mode: 'user',
        allowOnline: true,
        allowOffline: true,
        allowHybrid: false,
        enabledModels: Array.from(curr)
      };
    });
  };

  const applyOnlineOnly = () => {
    setModelPrefs({
      mode: 'online',
      allowOnline: true,
      allowOffline: false,
      allowHybrid: false,
      enabledModels: modelRows.filter((m: any) => m.online || m.availableOnline).map((m: any) => m.name)
    });
  };

  const applyOfflineOnly = () => {
    setModelPrefs({
      mode: 'offline',
      allowOnline: false,
      allowOffline: true,
      allowHybrid: false,
      enabledModels: modelRows.filter((m: any) => m.installed).map((m: any) => m.name)
    });
  };

  const applyHybrid = () => {
    setModelPrefs({
      mode: 'hybrid',
      allowOnline: true,
      allowOffline: true,
      allowHybrid: true,
      enabledModels: modelRows.map((m: any) => m.name)
    });
  };

  const applyUserSelection = () => {
    setModelPrefs((prev) => ({
      ...prev,
      mode: 'user',
      allowOnline: true,
      allowOffline: true,
      allowHybrid: false,
      enabledModels: prev.enabledModels.length ? prev.enabledModels : modelRows.map((m: any) => m.name)
    }));
  };

  const toggleAccessChannel = (which: 'online' | 'offline', value: boolean) => {
    setModelPrefs((prev) => {
      let allowOnline = which === 'online' ? value : prev.allowOnline;
      let allowOffline = which === 'offline' ? value : prev.allowOffline;
      if (!allowOnline && !allowOffline) {
        const r = reconcileModelAccessChannels(true, true);
        return {
          ...prev,
          ...r,
          enabledModels: enabledModelsForPresetMode('hybrid', modelRows)
        };
      }
      if (prev.mode === 'user') {
        return { ...prev, allowOnline, allowOffline };
      }
      const r = reconcileModelAccessChannels(allowOnline, allowOffline);
      return {
        ...prev,
        ...r,
        enabledModels: enabledModelsForPresetMode(r.mode, modelRows)
      };
    });
  };

  const routingModes = useMemo(
    () =>
      [
        {
          id: 'offline',
          name: t('engine.modeOffline'),
          icon: HardDrive,
          color: '#10b981',
          action: applyOfflineOnly,
          desc: t('engine.modeOfflineDesc'),
          disabled: installedModels.length === 0
        },
        {
          id: 'online',
          name: t('engine.modeOnline'),
          icon: Cloud,
          color: '#3b82f6',
          action: applyOnlineOnly,
          desc: t('engine.modeOnlineDesc'),
          disabled: false
        },
        {
          id: 'hybrid',
          name: t('engine.modeHybrid'),
          icon: Zap,
          color: '#f59e0b',
          action: applyHybrid,
          desc: t('engine.modeHybridDesc'),
          disabled: false
        },
        {
          id: 'user',
          name: t('engine.modeUser'),
          icon: CheckSquare,
          color: '#ef4444',
          action: applyUserSelection,
          desc: t('engine.modeUserDesc'),
          disabled: false
        }
      ] as const,
    [t, installedModels.length, applyOfflineOnly, applyOnlineOnly, applyHybrid, applyUserSelection]
  );

  return (
    <div className="engine-view">
      <header className="engine-header">
        <div className="engine-icon-wrapper">
          <Cpu size={28} color="hsl(var(--accent))" strokeWidth={2.5} />
        </div>
        <div className="engine-title">
          <h2>{t('engine.title')}</h2>
          <p>{t('engine.subtitle')}</p>
        </div>
      </header>

      <div className="routing-grid">
        {routingModes.map((m) => (
          <div
            key={m.id}
            onClick={() => !m.disabled && m.action()}
            className={`routing-card ${modelPrefs.mode === m.id ? 'active' : ''} ${m.disabled ? 'disabled' : ''}`}
            style={{ 
              '--card-color': m.color,
              '--card-accent-low': `${m.color}20`,
              '--card-glow': `${m.color}15`
            } as React.CSSProperties}
          >
            <div className="card-icon-box">
              <m.icon size={22} />
            </div>
            <div className="card-label">{m.name}</div>
            <div className="card-desc">{m.desc}</div>
            {m.disabled && (
              <div className="card-warning">
                <AlertCircle size={12} /> {t('engine.noLocalModels')}
              </div>
            )}
          </div>
        ))}
      </div>

      <main className="glass-panel" id="zone-a">
        <div className="section-title">
          <Download size={18} color="hsl(var(--text-secondary))" />
          <span>
            {t('engine.catalogTitle')
              .replace('{count}', String(installedModels.length))
              .replace('{plural}', installedModels.length === 1 ? '' : 's')}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={runOnlineProbe}
            disabled={probingOnline}
            className="btn-luxury btn-probe"
          >
            {probingOnline ? <RefreshCw size={14} className="fa7-refresh-spin" /> : <Activity size={14} />}
            {t('engine.probeCloud')}
          </button>
        </div>

        <div className="action-bar">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="premium-input search-input"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder={t('engine.searchModels')}
              aria-label={t('engine.searchModels')}
            />
          </div>
          <input
            type="text"
            className="premium-input"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            placeholder={t('engine.pullPlaceholder')}
            aria-label={t('engine.pullPlaceholder')}
            dir="ltr"
          />
          <button
            type="button"
            disabled={loading === 'pull' || !pullName.trim()}
            onClick={() => pullModelStream(pullName)}
            className="btn-luxury"
          >
            {loading === 'pull' ? <RefreshCw size={16} className="fa7-refresh-spin" /> : <Download size={16} />}
            {t('engine.install')}
          </button>
          <button
            type="button"
            disabled={diagnosing}
            onClick={runFullBodyScan}
            className="btn-luxury"
            style={{ minWidth: '180px', border: '1px solid hsl(var(--accent) / 0.4)' }}
          >
            {diagnosing ? <RefreshCw size={16} className="fa7-refresh-spin" /> : <Shield size={16} />}
            {t('engine.neuralDiagnostic')}
          </button>
          <button
            type="button"
            onClick={() => {
              fetchInstalledModels();
              fetchModelCatalog();
            }}
            title={t('engine.refreshModels')}
            aria-label={t('engine.refreshModels')}
            className="btn-icon"
          >
            <RefreshCw size={16} className={loading === 'pull' ? 'fa7-refresh-spin' : ''} />
          </button>
        </div>

        {loading === 'pull' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              type="button"
              className="btn-action btn-remove"
              onClick={() => pullAbortRef.current?.abort()}
            >
              {t('engine.cancelDownloadClean')}
            </button>
          </div>
        )}

        <div className="model-list">
          {filteredModelRows.map((m) => {
            const localNeedsPull = !m.availableOnline && !m.installed;
            return (
              <div key={m.name} className="model-item">
                <div className="model-info">
                  <div className="model-name-row">
                    <input
                      type="checkbox"
                      disabled={localNeedsPull}
                      checked={isModelRowChecked(m.name) && !localNeedsPull}
                      onChange={() => toggleModelEnabled(m.name)}
                      aria-label={`Enable ${m.label}`}
                    />
                    <span style={{ color: m.installed ? '#10b981' : m.availableOnline ? '#38bdf8' : '#f87171' }}>
                      {m.label}
                    </span>
                    {m.isRunning && (
                      <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        {t('engine.running')}
                      </span>
                    )}
                  </div>
                  <div className="model-meta-row" dir="ltr">
                    {m.name}
                    {m.size ? ` · ${formatSize(m.size)}` : ''}
                    {m.availableOnline && !m.installed ? ` · ☁️ ${t('engine.cloud')}` : ` · 💾 ${t('engine.local')}`}
                    {m.installed && !m.isRunning && ` · ${t('engine.idle')}`}
                  </div>
                </div>

                <div className="model-actions">
                  {!m.availableOnline || m.installed ? (
                    <>
                      <button
                        onClick={() => pullModelStream(m.name)}
                        disabled={loading === 'pull'}
                        className="btn-action btn-pull"
                      >
                        {m.installed ? t('engine.update') : t('engine.pull')}
                      </button>
                      {m.installed && (
                        <button
                          onClick={() => deleteModel(m.name)}
                          disabled={deletingModel === m.name}
                          className="btn-action btn-remove"
                          title={t('engine.removeModel')}
                          aria-label={`Remove ${m.label} model`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="status-badge status-online">{t('engine.apiPowered')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pullLog && <pre className="log-pre">{pullLog}</pre>}
      </main>

      <details className="advanced-details">
        <summary className="advanced-summary">
          <Settings size={18} color="#f59e0b" />
          <span>{t('engine.advancedEngine')}</span>
        </summary>
        <div className="advanced-content">
          <div className="routing-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 0 }}>
            <div className="sub-panel">
              <div className="sub-panel-header">
                <div className="sub-panel-title">
                  <Package size={16} /> {t('engine.centralApi')}
                </div>
                <button onClick={fetchOllamaMeta} className="btn-icon" style={{ width: '32px', height: '32px' }}><RefreshCw size={14} /></button>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', fontFamily: 'monospace' }}>
                endpoint: {ollamaCfg.activeBase || 'project-local:11434'}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button onClick={setLocal} className="btn-luxury" style={{ flex: 1, fontSize: '11px', height: '34px', background: '#333' }}>
                  {t('engine.locative')}
                </button>
                <button onClick={setCloud} className="btn-luxury" style={{ flex: 1, fontSize: '11px', height: '34px', background: '#1e3a5f' }}>
                  {t('engine.remote')}
                </button>
              </div>
              <input
                type="text"
                className="premium-input"
                value={ollamaCfg.ollamaBase}
                onChange={(e) => setOllamaCfg((p) => ({ ...p, ollamaBase: e.target.value }))}
                placeholder={t('engine.customEndpoint')}
              />
              <input
                type="password"
                className="premium-input"
                value={ollamaCfg.ollamaApiKey}
                onChange={(e) => setOllamaCfg((p) => ({ ...p, ollamaApiKey: e.target.value }))}
                placeholder={t('engine.apiToken')}
              />
              <button onClick={saveOllamaConfig} className="btn-luxury btn-full-width">
                {loading === 'ollama-config' ? t('engine.syncing') : t('engine.updateNeuralConfig')}
              </button>
            </div>

            <div className="sub-panel">
              <div className="sub-panel-header">
                <div className="sub-panel-title">
                  <Activity size={16} /> {t('engine.infraHealth')}
                </div>
                <div className="status-badge status-installed">{t('engine.live')}</div>
              </div>
              {interactiveInstall && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    borderRadius: '14px',
                    border: '1px solid hsl(var(--border) / 0.45)',
                    background: 'hsl(var(--bg-sidebar) / 0.35)'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>{t('engine.installInteractiveTitle')}</div>
                  <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginBottom: '10px' }}>
                    {t('engine.installInteractiveBody')}
                  </div>
                  <div
                    dir="ltr"
                    style={{
                      fontSize: '11px',
                      fontFamily: 'ui-monospace, monospace',
                      color: 'hsl(var(--text-secondary))',
                      wordBreak: 'break-all',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid hsl(var(--border) / 0.35)',
                      background: 'rgba(0,0,0,0.25)',
                      marginBottom: '10px'
                    }}
                  >
                    {interactiveInstall.command}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-action btn-pull"
                      onClick={async () => {
                        try {
                          await axios.post(`${API_BASE}/shell/open-external-terminal`, {});
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      {t('engine.openTerminal')}
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-pull"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(interactiveInstall.command);
                          window.alert(t('engine.commandCopied'));
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      {t('engine.copyCommand')}
                    </button>
                    <button type="button" className="btn-icon" onClick={() => setInteractiveInstall(null)} title="Close" aria-label="Close">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
              <div className="health-grid">
                {health.map(tool => (
                  <div key={tool.name} className="health-item">
                    <div className="health-info">
                      <span className="health-name" style={{ color: tool.status === 'missing' ? '#f87171' : '#10b981' }}>{tool.name}</span>
                      <span className="health-version">{tool.version || 'v?' }</span>
                    </div>
                    <div className="health-actions">
                      <button
                        onClick={() => installTool(tool.name)}
                        disabled={!!loading}
                        className="btn-action btn-pull"
                      >
                        {loading === tool.name ? '...' : tool.status === 'missing' ? t('engine.installBtn') : t('engine.reinstall')}
                      </button>
                      {tool.status === 'installed' && tool.can_uninstall && (
                        <button
                          onClick={() => uninstallTool(tool.name)}
                          disabled={!!loading}
                          className="btn-action btn-remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sub-panel">
              <div className="sub-panel-header">
                <div className="sub-panel-title">
                  <Settings size={16} /> {t('engine.projectDeps')}
                </div>
              </div>
              <input
                type="text"
                className="premium-input"
                value={manualInstallCmd}
                onChange={(e) => setManualInstallCmd(e.target.value)}
                placeholder={t('engine.manualInstallPlaceholder')}
                aria-label={t('engine.manualInstallPlaceholder')}
              />
              <button onClick={runManualInstallCommand} className="btn-luxury btn-full-width btn-primary-action">
                {t('engine.runGlobalInstall')}
              </button>
              <div className="custom-tool-form">
                <div className="sub-panel-title" style={{ marginBottom: '10px' }}>
                  <Package size={14} /> {t('engine.customSwarmTitle')}
                </div>
                <input
                  type="text"
                  className="premium-input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={t('engine.customNamePh')}
                  aria-label={t('engine.customNamePh')}
                />
                <input
                  type="text"
                  className="premium-input"
                  value={customCheck}
                  onChange={(e) => setCustomCheck(e.target.value)}
                  placeholder="Check command: bun --version"
                  aria-label="Custom tool check command"
                  dir="ltr"
                />
                <input
                  type="text"
                  className="premium-input"
                  value={customInstall}
                  onChange={(e) => setCustomInstall(e.target.value)}
                  placeholder="Install: curl -fsSL https://bun.sh/install | bash"
                  dir="ltr"
                />
                <input
                  type="text"
                  className="premium-input"
                  value={customUninstall}
                  onChange={(e) => setCustomUninstall(e.target.value)}
                  placeholder="Uninstall (optional)"
                  dir="ltr"
                />
                <button
                  onClick={addCustomTool}
                  disabled={loading === 'custom:add'}
                  className="btn-luxury btn-full-width btn-primary-action"
                >
                  {loading === 'custom:add' ? t('engine.integrating') : t('engine.registerCustomNode')}
                </button>

                {customTools.length > 0 && (
                  <div className="custom-tools-list">
                    {customTools.map((t: any) => (
                      <div key={t.name} className="custom-tool-item">
                        <span>{t.name}</span>
                        <button
                          onClick={() => removeCustomTool(t.name)}
                          disabled={loading === `custom:rm:${t.name}`}
                          className="btn-icon-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="runtime-box">
                <div className="sub-panel-title" style={{ marginBottom: '10px' }}>
                  <Info size={14} /> {t('engine.giraNeuralRuntime')}
                </div>
                <button onClick={downloadOllamaRuntime} className="btn-luxury btn-full-width btn-runtime">
                  {status?.isReady ? t('engine.nodeLocalized') : t('engine.downloadNeuralCore')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
      {/* Aivon Medic Protocol: Diagnostic Overlay */}
      {showDiagModal && (
        <div className="diag-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'
        }}>
          <div className="diag-card" style={{
            width: '100%', maxWidth: '800px', background: 'hsl(var(--card))', borderRadius: '24px',
            border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden', boxShadow: '0 32px 64px -16px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '24px 32px', background: 'hsl(var(--accent) / 0.1)', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Shield size={24} color="hsl(var(--accent))" strokeWidth={2.5} />
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>Neural Core Scan Summary</h2>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="btn-icon" title="Close" aria-label="Close diagnostic" style={{ padding: '8px' }}>
                <Trash2 size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
              {diagnosing ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <RefreshCw size={48} className="fa7-refresh-spin" style={{ opacity: 0.5, marginBottom: '24px' }} />
                  <p style={{ fontSize: '18px', color: 'hsl(var(--text-secondary))' }}>Calibrating sensors and probing subsystems...</p>
                </div>
              ) : diagnosticResult?.error ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
                  <AlertCircle size={48} style={{ marginBottom: '16px' }} />
                  <p>{diagnosticResult.error}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.3)' }}>
                    <div style={{ fontSize: '48px', fontWeight: 900, color: 'hsl(var(--accent))' }}>{diagnosticResult?.score}%</div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>System Integrity Score</div>
                      <div style={{ color: 'hsl(var(--text-secondary))' }}>Computed stability based on neural and infra telemetry</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="diag-section">
                      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, marginBottom: '16px' }}>Infrastructure Checks</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {diagnosticResult?.subsystems?.infrastructure?.slice(0, 8).map((t: any) => (
                          <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span>{t.name}</span>
                            <span style={{ color: t.status === 'installed' ? '#10b981' : '#f59e0b' }}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="diag-section">
                      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, marginBottom: '16px' }}>Workspace Intelligence</h3>
                      {diagnosticResult?.subsystems?.workspace?.length > 0 ? (
                        diagnosticResult.subsystems.workspace.map((w: any) => (
                          <div key={w.id} style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', marginBottom: '12px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#f59e0b', marginBottom: '4px' }}>{w.title}</div>
                            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>{w.solution}</div>
                            {w.can_self_heal && (
                              <button onClick={() => applyRepair(w.id)} border-radius="8px" className="btn-luxury" style={{ width: '100%', fontSize: '11px', padding: '6px' }}>
                                <Zap size={12} /> Apply Neural Fix
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '13px', opacity: 0.5 }}>Zero workspace friction detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EngineView;
