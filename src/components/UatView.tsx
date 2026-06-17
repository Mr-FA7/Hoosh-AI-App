import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Shield, Play, Sparkles } from 'lucide-react';
import { API_BASE as API } from '../apiBase';

const UatView: React.FC = () => {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [nl, setNl] = useState('');
  const [command, setCommand] = useState('');
  const [evalResult, setEvalResult] = useState<Record<string, unknown> | null>(null);
  const [execOut, setExecOut] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<{ name: string; version: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, pl] = await Promise.all([
          axios.get(`${API}/uat/profile`),
          axios.get(`${API}/uat/plugins`)
        ]);
        setProfile(p.data);
        if (pl.data?.plugins) setPlugins(pl.data.plugins);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const toCommand = async () => {
    setBusy('nl');
    setEvalResult(null);
    setExecOut('');
    try {
      const r = await axios.post(`${API}/uat/nl-to-command`, { text: nl, options: {} });
      if (r.data?.command) setCommand(r.data.command);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error';
      setExecOut(msg);
    } finally {
      setBusy(null);
    }
  };

  const evaluate = async () => {
    setBusy('eval');
    try {
      const r = await axios.post(`${API}/uat/evaluate`, { command });
      setEvalResult(r.data);
    } catch (e: unknown) {
      setEvalResult({ error: String(e) });
    } finally {
      setBusy(null);
    }
  };

  const execute = async () => {
    if (!window.confirm('Run this command on your machine? (UAT policy will be enforced)')) return;
    setBusy('exec');
    setExecOut('');
    try {
      const r = await axios.post(`${API}/uat/execute`, { command, execOpts: {} });
      if (r.data?.ok) {
        const res = r.data.result;
        setExecOut(
          JSON.stringify(
            {
              exitCode: res?.exitCode,
              stdout: res?.stdout,
              stderr: res?.stderr
            },
            null,
            2
          )
        );
      } else {
        setExecOut(JSON.stringify(r.data, null, 2));
      }
    } catch (e: unknown) {
      setExecOut(String(e));
    } finally {
      setBusy(null);
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <div style={{ padding: '10px', background: 'hsl(var(--accent) / 0.1)', borderRadius: '12px' }}>
             <Terminal size={24} color="hsl(var(--accent))" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>UAT</h2>
          <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0 }}>Natural language to authenticated shell orchestration</p>
        </div>
      </div>

      {profile && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid #333',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace'
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>Profile</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      )}

      {plugins.length > 0 && (
        <div style={{ marginBottom: '16px', fontSize: '11px', color: '#666' }}>
          <Shield size={12} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          UAT plugins: {plugins.map((p) => `${p.name}@${p.version}`).join(', ')}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Sparkles size={14} color="#a78bfa" />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Natural language</span>
        </div>
        <textarea
          value={nl}
          onChange={(e) => setNl(e.target.value)}
          placeholder="e.g., 'List all files in the current directory and sort by size'"
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'hsl(var(--bg-sidebar))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--text-primary))',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            resize: 'vertical',
            outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={toCommand}
          disabled={!!busy || !nl.trim()}
          style={{
            marginTop: '12px',
            background: 'hsl(var(--accent))',
            border: 'none',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px hsl(var(--accent) / 0.3)'
          }}
        >
          {busy === 'nl' ? 'Processing...' : 'Translate to Command'}
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>Command</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          dir="ltr"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            marginTop: '8px',
            background: '#1a1a1a',
            border: '1px solid #444',
            color: '#e4e4e7',
            borderRadius: '6px',
            padding: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '12px'
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={evaluate}
            disabled={!!busy || !command.trim()}
            style={{
              background: '#374151',
              border: '1px solid #555',
              color: '#e4e4e7',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Evaluate policy
          </button>
          <button
            type="button"
            onClick={execute}
            disabled={!!busy || !command.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#7f1d1d',
              border: '1px solid #b91c1c',
              color: '#fecaca',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <Play size={14} />
            Execute
          </button>
        </div>
      </div>

      {evalResult && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid #333',
            fontSize: '11px'
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>Evaluation result</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(evalResult, null, 2)}</pre>
        </div>
      )}

      {execOut && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: '#0a0a0a',
            borderRadius: '8px',
            border: '1px solid #333',
            fontSize: '11px',
            maxHeight: '240px',
            overflow: 'auto'
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>Output</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{execOut}</pre>
        </div>
      )}
    </div>
  );
};

export default UatView;
