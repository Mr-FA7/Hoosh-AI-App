import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { Monitor, Plus, X, Search, Bot, User } from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { appendTerminalBuffer, publishTerminalState } from '../lib/terminalContextSync';

type ShellMode = 'system' | 'isolated';
type PtyPurpose = 'ai' | 'user';

type TabDef = { id: string };

function newTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ShellInfo = { ptyWsUrl: string; defaultCwd: string };

const TerminalPane: React.FC<{
  active: boolean;
  mode: ShellMode;
  purpose: PtyPurpose;
  shellInfo: ShellInfo | null;
}> = ({ active, mode, purpose, shellInfo }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef('');
  const sessionNameRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState('');
  const [cwdHint, setCwdHint] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const connect = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !shellInfo) return;

    wsRef.current?.close();
    termRef.current?.dispose();
    termRef.current = null;
    fitRef.current = null;
    searchRef.current = null;
    wrap.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: 'transparent',
        foreground: '#93c5fd', // Soft neon blue
        cursor: '#f43f5e',     // Neon pink cursor
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#ffffff',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      }
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.open(wrap);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    const ws = new WebSocket(shellInfo.ptyWsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      const { cols, rows } = term;
      const agentSession = purpose === 'ai' ? localStorage.getItem('hoosh_agent_terminal_session') : null;
      const sessionName = agentSession ? `agent-${agentSession}` : undefined;
      sessionNameRef.current = sessionName;
      ws.send(
        JSON.stringify({
          type: 'init',
          mode,
          purpose,
          cwd: shellInfo.defaultCwd,
          cols,
          rows,
          sessionName
        })
      );
      setStatus('Connecting…');
    };

    const dec = new TextDecoder('utf-8', { fatal: false });

    const writeChunk = (chunk: string) => {
      term.write(chunk);
      bufferRef.current = appendTerminalBuffer(bufferRef.current, chunk);
      publishTerminalState({
        buffer: bufferRef.current,
        selection: term.getSelection() || '',
        purpose,
        sessionName: sessionNameRef.current
      });
    };

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        writeChunk(dec.decode(new Uint8Array(ev.data)));
        return;
      }
      try {
        const j = JSON.parse(String(ev.data));
        if (j.type === 'ready') {
          const pr = j.purpose === 'user' ? 'User' : 'AI';
          setStatus(
            (mode === 'isolated' ? 'Isolated shell' : 'System shell') + ` · ${pr}`
          );
          setCwdHint(j.cwd || '');
        } else if (j.type === 'exit') {
          term.writeln(`\r\n\x1b[33m[exit ${j.code ?? '?'}]\x1b[0m`);
        } else if (j.type === 'error') {
          term.writeln(`\r\n\x1b[31m${j.error}\x1b[0m`);
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setStatus('WebSocket error');
    ws.onclose = () => setStatus('Disconnected');

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onSelectionChange(() => {
      publishTerminalState({
        buffer: bufferRef.current,
        selection: term.getSelection() || '',
        purpose,
        sessionName: sessionNameRef.current
      });
    });
  }, [mode, purpose, shellInfo]);

  useEffect(() => {
    connect();
    const wrap = wrapRef.current;
    let ro: ResizeObserver | null = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        const t = termRef.current;
        const f = fitRef.current;
        const w = wsRef.current;
        if (!t || !f) return;
        f.fit();
        if (w?.readyState === WebSocket.OPEN) {
          w.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
        }
      });
      ro.observe(wrap);
    }
    return () => {
      ro?.disconnect();
      wsRef.current?.close();
      termRef.current?.dispose();
      wsRef.current = null;
      termRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    if (active && termRef.current && fitRef.current) {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
        const t = termRef.current;
        const w = wsRef.current;
        if (t && w?.readyState === WebSocket.OPEN) {
          w.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
        }
      });
    }
  }, [active]);

  const findNext = () => {
    const s = searchRef.current;
    if (!s || !searchQ.trim()) return;
    s.findNext(searchQ);
  };

  const findPrev = () => {
    const s = searchRef.current;
    if (!s || !searchQ.trim()) return;
    s.findPrevious(searchQ);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {active && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            borderBottom: '1px solid #2a2a2a',
            flexShrink: 0,
            flexWrap: 'wrap'
          }}
        >
          <Search size={14} color="#64748b" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') findNext();
            }}
            placeholder="Search output…"
            dir="ltr"
            style={{
              flex: 1,
              minWidth: '120px',
              maxWidth: '280px',
              background: '#1a1a1a',
              border: '1px solid #444',
              color: '#e4e4e7',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px'
            }}
          />
          <button
            type="button"
            onClick={findPrev}
            style={{
              background: '#333',
              border: '1px solid #555',
              color: '#ccc',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={findNext}
            style={{
              background: '#333',
              border: '1px solid #555',
              color: '#ccc',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            Next
          </button>
          <span style={{ fontSize: '10px', color: '#555' }}>{status}</span>
          {cwdHint ? (
            <span style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace' }} dir="ltr">
              {cwdHint}
            </span>
          ) : null}
        </div>
      )}
      <div
        ref={wrapRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '16px',
          overflow: 'hidden',
          display: active ? 'block' : 'none',
          background: 'linear-gradient(135deg, rgba(8, 15, 33, 0.95), rgba(0, 0, 0, 0.98))',
          boxShadow: 'inset 0 0 24px rgba(59, 130, 246, 0.15)',
          borderRadius: '12px',
          margin: '12px',
          border: '1px solid rgba(59, 130, 246, 0.25)'
        }}
      />
    </div>
  );
};

const TerminalView: React.FC = () => {
  const firstId = useRef(newTabId());
  const [tabs, setTabs] = useState<TabDef[]>([{ id: firstId.current }]);
  const [activeId, setActiveId] = useState(firstId.current);
  const [mode, setMode] = useState<ShellMode>('system');
  const [ptyPurpose, setPtyPurpose] = useState<PtyPurpose>('ai');
  const [shellInfo, setShellInfo] = useState<ShellInfo | null>(null);

  useEffect(() => {
    axios
      .get(`${API}/shell/info`)
      .then((res) => {
        setShellInfo({
          ptyWsUrl: res.data.ptyWsUrl,
          defaultCwd: res.data.defaultCwd
        });
      })
      .catch(() => setShellInfo(null));
  }, []);

  const addTab = () => {
    const id = newTabId();
    setTabs((t) => [...t, { id }]);
    setActiveId(id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = tabs;
    if (prev.length <= 1) return;
    const idx = prev.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const next = prev.filter((x) => x.id !== id);
    setTabs(next);
    if (activeId === id) {
      const fall = prev[idx > 0 ? idx - 1 : idx + 1];
      setActiveId(fall?.id ?? next[0]!.id);
    }
  };

  const openDesktopTerminal = async () => {
    try {
      const res = await axios.post(`${API}/shell/open-external-terminal`, {});
      if (!res.data?.ok) {
        window.alert(res.data?.error || 'Failed to open terminal');
      }
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'system' ? 'isolated' : 'system'));
  };

  return (
    <div
      className="terminal-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'hsl(var(--bg-main))',
        color: 'hsl(var(--text-primary))',
        minHeight: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          background: 'hsl(var(--bg-sidebar))',
          borderBottom: '1px solid hsl(var(--border) / 0.5)',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        <Monitor size={18} color="hsl(var(--accent))" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Terminal</span>
          <span style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', fontWeight: 500, opacity: 0.7 }}>
            Internal Environment · OS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px', flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: activeId === t.id ? 'hsl(var(--accent) / 0.1)' : 'transparent',
                border: '1px solid ' + (activeId === t.id ? 'hsl(var(--accent) / 0.3)' : 'hsl(var(--border) / 0.5)'),
                color: activeId === t.id ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: activeId === t.id ? 600 : 500,
                cursor: 'pointer',
                maxWidth: '160px',
                transition: 'all 0.2s'
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                dir="ltr"
              >
                {t.id.slice(0, 8)}
              </span>
              {tabs.length > 1 && (
                <span
                  role="presentation"
                  onClick={(e) => closeTab(t.id, e)}
                  style={{ opacity: 0.7, padding: '0 2px' }}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={addTab}
            title="New tab"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              background: '#1e3a5f',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Session label for backend (FA7_PTY_PURPOSE) — internal and system terminals can run in parallel"
          >
            <span style={{ fontSize: '10px', color: '#64748b' }}>Session:</span>
            {(['ai', 'user'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPtyPurpose(p)}
                style={{
                  background: ptyPurpose === p ? '#1e3a5f' : '#222',
                  border: `1px solid ${ptyPurpose === p ? '#3b82f6' : '#444'}`,
                  color: ptyPurpose === p ? '#93c5fd' : '#888',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {p === 'ai' ? 'AI' : 'User'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleMode}
            style={{
              background: '#222',
              border: '1px solid #444',
              color: '#e4e4e7',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Shell: {mode === 'system' ? 'System' : 'Isolated'}
          </button>
          <button
            type="button"
            onClick={openDesktopTerminal}
            title="Separate window for you; can be used together with internal terminal"
            style={{
              background: '#1e3a5f',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}
          >
            <User size={14} />
            System Terminal — User
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '10px 16px',
          borderBottom: '1px solid #252525',
          background: '#141414',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '420px' }}>
          <Bot size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
            <strong style={{ color: '#93c5fd' }}>Internal:</strong> output and commands here are intended for{' '}
            <strong style={{ color: '#e2e8f0' }}>AI / assistant usage</strong>.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '420px' }}>
          <User size={14} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45 }}>
            <strong style={{ color: '#6ee7b7' }}>System:</strong> this separate terminal window is for{' '}
            <strong style={{ color: '#e2e8f0' }}>you</strong>. You can use{' '}
            <strong style={{ color: '#e2e8f0' }}>both</strong> at the same time.
          </span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              inset: 0,
              display: t.id === activeId ? 'flex' : 'none',
              flexDirection: 'column'
            }}
          >
            <TerminalPane
              active={t.id === activeId}
              mode={mode}
              purpose={ptyPurpose}
              shellInfo={shellInfo}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalView;
