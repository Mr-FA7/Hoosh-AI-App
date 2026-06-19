import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Play, Plus, RefreshCw, Save, Trash2, History, Power } from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type FlowNode = {
  id: string;
  type: string;
  position?: { x: number; y: number };
  parameters?: Record<string, unknown>;
};

type Flow = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  nodes: FlowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string; input: number }>> }>;
  settings?: Record<string, unknown>;
};

const NODE_PALETTE = [
  'trigger.manual', 'trigger.webhook', 'trigger.schedule', 'trigger.poll',
  'action.agent', 'action.http', 'action.tool', 'action.media', 'action.set', 'action.flowCall',
  'action.stackUp', 'action.stackDown', 'action.skill', 'action.mcp',
  'logic.delay', 'logic.if', 'logic.switch', 'logic.merge', 'logic.splitBatch',
  'human.approval'
];

function flowToEdges(flow: Flow): Edge[] {
  const edges: Edge[] = [];
  for (const [src, conn] of Object.entries(flow.connections || {})) {
    for (const batch of conn.main || []) {
      for (const t of batch || []) {
        edges.push({ id: `${src}-${t.node}`, source: src, target: t.node, animated: true });
      }
    }
  }
  return edges;
}

function edgesToConnections(edges: Edge[]): Flow['connections'] {
  const connections: Flow['connections'] = {};
  for (const e of edges) {
    if (!connections[e.source]) connections[e.source] = { main: [[]] };
    connections[e.source].main![0].push({ node: e.target, input: 0 });
  }
  return connections;
}

function flowToRfNodes(flow: Flow): Node[] {
  return (flow.nodes || []).map((n) => ({
    id: n.id,
    position: n.position || { x: 80, y: 80 },
    data: { label: `${n.id}\n${n.type}` },
    style: {
      background: n.type.startsWith('trigger') ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
      border: '1px solid #444', borderRadius: 8, padding: 8, fontSize: 11, color: '#e5e5e5', minWidth: 120
    }
  }));
}

const WorkflowView: React.FC = () => {
  const { t } = useI18n();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Flow | null>(null);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const syncCanvas = useCallback((flow: Flow | null) => {
    if (!flow) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }
    setRfNodes(flowToRfNodes(flow));
    setRfEdges(flowToEdges(flow));
  }, []);

  const refresh = useCallback(async () => {
    setBusy('refresh');
    try {
      const [f, r] = await Promise.all([
        axios.get(`${API}/v3/flows`),
        axios.get(`${API}/v3/flows/runs`)
      ]);
      const list: Flow[] = f.data?.flows || [];
      setFlows(list);
      setRuns(r.data?.runs || []);
      const id = selectedId || list[0]?.id || '';
      if (id) {
        const one = await axios.get(`${API}/v3/flows/${id}`);
        setDraft(one.data?.flow || null);
        syncCanvas(one.data?.flow || null);
        if (!selectedId) setSelectedId(id);
      }
    } catch (e: unknown) {
      setMsg(String(e));
    } finally {
      setBusy('');
    }
  }, [selectedId, syncCanvas]);

  useEffect(() => { void refresh(); }, []);

  const selectFlow = async (id: string) => {
    setSelectedId(id);
    const r = await axios.get(`${API}/v3/flows/${id}`);
    setDraft(r.data?.flow || null);
    syncCanvas(r.data?.flow || null);
  };

  const persistDraft = useCallback((nextNodes: Node[], nextEdges: Edge[], patch: Partial<Flow> = {}) => {
    if (!draft) return;
    const nodes: FlowNode[] = nextNodes.map((n) => {
      const old = draft.nodes.find((x) => x.id === n.id);
      return {
        id: n.id,
        type: old?.type || 'action.agent',
        position: n.position,
        parameters: old?.parameters || {}
      };
    });
    const updated: Flow = {
      ...draft,
      ...patch,
      nodes,
      connections: edgesToConnections(nextEdges)
    };
    setDraft(updated);
    return updated;
  }, [draft]);

  const onConnect = useCallback((conn: Connection) => {
    setRfEdges((eds) => {
      const next = addEdge({ ...conn, animated: true }, eds);
      persistDraft(rfNodes, next);
      return next;
    });
  }, [rfNodes, persistDraft]);

  const onNodesChange = useCallback((changes: any) => {
    setRfNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      persistDraft(next, rfEdges);
      return next;
    });
  }, [rfEdges, persistDraft]);

  const save = async () => {
    if (!draft) return;
    setBusy('save');
    try {
      const r = await axios.post(`${API}/v3/flows`, draft);
      setDraft(r.data?.flow);
      syncCanvas(r.data?.flow);
      setMsg(t('workflows.saved'));
      await refresh();
    } catch (e: unknown) {
      setMsg(String(e));
    } finally {
      setBusy('');
    }
  };

  const run = async () => {
    if (!selectedId) return;
    setBusy('run');
    try {
      const r = await axios.post(`${API}/v3/flows/${selectedId}/run`, {});
      setMsg(r.data?.ok ? t('workflows.runOk') : (r.data?.run?.error || t('workflows.runFail')));
      const runsRes = await axios.get(`${API}/v3/flows/runs`, { params: { flowId: selectedId } });
      setRuns(runsRes.data?.runs || []);
    } finally {
      setBusy('');
    }
  };

  const toggleActive = async () => {
    if (!draft) return;
    const next = { ...draft, active: !draft.active };
    setDraft(next);
    await axios.post(`${API}/v3/flows`, next);
    setMsg(next.active ? t('workflows.activated') : t('workflows.deactivated'));
    await refresh();
  };

  const removeFlow = async () => {
    if (!selectedId) return;
    await axios.delete(`${API}/v3/flows/${selectedId}`);
    setSelectedId('');
    setDraft(null);
    syncCanvas(null);
    await refresh();
  };

  const initExample = async () => {
    await axios.post(`${API}/v3/flows/init-example`);
    setMsg(t('workflows.initOk'));
    await refresh();
  };

  const addNode = (type: string) => {
    const id = `n${Date.now()}`;
    const node: FlowNode = {
      id,
      type,
      position: { x: 100 + rfNodes.length * 40, y: 100 + rfNodes.length * 30 },
      parameters: type === 'action.agent' ? { prompt: 'Do task' } : {}
    };
    const nextFlow = draft ? { ...draft, nodes: [...draft.nodes, node] } : null;
    if (nextFlow) {
      setDraft(nextFlow);
      const nextRf = [...rfNodes, {
        id,
        position: node.position!,
        data: { label: `${id}\n${type}` },
        style: { background: type.startsWith('trigger') ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)', border: '1px solid #444', borderRadius: 8, padding: 8, fontSize: 11, color: '#e5e5e5' }
      }];
      setRfNodes(nextRf);
    }
  };

  const card: React.CSSProperties = {
    background: '#141414', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid #2a2a2a'
  };

  return (
    <div style={{ padding: '20px', color: '#ddd', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <GitBranch size={22} color="#a78bfa" />
        <h2 style={{ margin: 0, fontSize: '18px' }}>{t('workflows.title')}</h2>
        <button type="button" onClick={() => void refresh()} disabled={!!busy}
          style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#222', color: '#ccc', cursor: 'pointer' }}>
          <RefreshCw size={14} /> {t('workflows.refresh')}
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#888', marginTop: 0 }}>{t('workflows.hint')}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" onClick={() => void initExample()} style={btnStyle}><Plus size={14} /> {t('workflows.initExample')}</button>
        <button type="button" onClick={() => void save()} disabled={!draft} style={btnStylePrimary}><Save size={14} /> {t('workflows.save')}</button>
        <button type="button" onClick={() => void run()} disabled={!selectedId} style={btnStyleOk}><Play size={14} /> {t('workflows.run')}</button>
        <button type="button" onClick={() => void toggleActive()} disabled={!draft} style={btnStyle}><Power size={14} /> {draft?.active ? t('workflows.deactivate') : t('workflows.activate')}</button>
        <button type="button" onClick={() => void removeFlow()} disabled={!selectedId} style={btnStyleDanger}><Trash2 size={14} /> {t('workflows.delete')}</button>
      </div>

      {msg && <p style={{ fontSize: '12px', color: '#6ee7b7' }}>{msg}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '12px', minHeight: '480px' }}>
        <div style={card}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('workflows.list')}</div>
          {flows.map((f) => (
            <button key={f.id} type="button" onClick={() => void selectFlow(f.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: '6px', padding: '8px',
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: f.id === selectedId ? 'rgba(167,139,250,0.2)' : '#1a1a1a', color: '#ddd', fontSize: '12px'
              }}>
              {f.active ? '● ' : '○ '}{f.name}
            </button>
          ))}
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#666' }}>{t('workflows.addNode')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', maxHeight: '200px', overflow: 'auto' }}>
            {NODE_PALETTE.map((nt) => (
              <button key={nt} type="button" onClick={() => addNode(nt)} style={{ ...btnStyle, fontSize: '10px', padding: '4px 8px' }}>{nt}</button>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden', minHeight: '480px' }}>
          {draft && (
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={{ width: '100%', padding: '10px', border: 'none', borderBottom: '1px solid #333', background: '#0a0a0a', color: '#ddd' }} />
          )}
          <div style={{ height: '440px' }}>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={(ch) => {
                setRfEdges((eds) => {
                  const next = applyEdgeChanges(ch, eds);
                  persistDraft(rfNodes, next);
                  return next;
                });
              }}
              onConnect={onConnect}
              fitView
              style={{ background: '#0a0a0a' }}
            >
              <Background gap={16} color="#333" />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={14} /> {t('workflows.runs')}
        </div>
        {runs.slice(0, 12).map((run) => (
          <div key={run.id} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid #1f1f1f' }}>
            {run.flowName} · {run.status} · {run.startedAt}
          </div>
        ))}
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#222', color: '#ccc', cursor: 'pointer', fontSize: '12px' };
const btnStylePrimary: React.CSSProperties = { ...btnStyle, background: 'rgba(59,130,246,0.25)', color: '#93c5fd' };
const btnStyleOk: React.CSSProperties = { ...btnStyle, background: 'rgba(34,197,94,0.2)', color: '#6ee7b7' };
const btnStyleDanger: React.CSSProperties = { ...btnStyle, background: 'rgba(239,68,68,0.15)', color: '#fca5a5' };

export default WorkflowView;
