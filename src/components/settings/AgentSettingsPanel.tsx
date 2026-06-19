import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../apiBase';
import { useI18n } from '../../i18n/LocaleContext';

type Tab = 'providers' | 'mcp' | 'rules' | 'docs' | 'approval' | 'advanced';

interface AgentSettingsPanelProps {
  /** When true, rendered inside SettingsView — no duplicate page title/padding */
  embedded?: boolean;
}

const AgentSettingsPanel: React.FC<AgentSettingsPanelProps> = ({ embedded = false }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('providers');
  const [msg, setMsg] = useState('');

  const [providers, setProviders] = useState<any>(null);
  const [mcpConfig, setMcpConfig] = useState('');
  const [mcpPath, setMcpPath] = useState('');
  const [rules, setRules] = useState<any[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [ruleContent, setRuleContent] = useState('');
  const [approval, setApproval] = useState<any>(null);
  const [sandbox, setSandbox] = useState<any>({ enabled: false, image: 'node:20-bookworm-slim' });
  const [acpBackends, setAcpBackends] = useState<any[]>([]);
  const [acpActive, setAcpActive] = useState<string | null>(null);
  const [useAcpForChat, setUseAcpForChat] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionTitle, setSessionTitle] = useState('New session');
  const [automationJobs, setAutomationJobs] = useState<any[]>([]);
  const [newJobType, setNewJobType] = useState<'interval' | 'webhook'>('interval');
  const [newJobPrompt, setNewJobPrompt] = useState('');
  const [newJobIntervalMs, setNewJobIntervalMs] = useState(3600000);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowName, setWorkflowName] = useState('Workflow');
  const [workflowStepsJson, setWorkflowStepsJson] = useState('[\n  { \"label\": \"Plan\", \"type\": \"agent\", \"prompt\": \"Create plan\" },\n  { \"label\": \"Approve\", \"type\": \"human\", \"prompt\": \"Approve changes\" },\n  { \"label\": \"Implement\", \"type\": \"agent\", \"prompt\": \"Implement\" }\n]');
  const [indexing, setIndexing] = useState<any>({ vectorBackend: 'json', ftsBackend: 'json' });
  const [sqliteAvailable, setSqliteAvailable] = useState(false);
  const [agentConfig, setAgentConfig] = useState({ deferWrites: true, autoCommit: true });
  const [perToolList, setPerToolList] = useState<any[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<any[]>([]);
  const [engines, setEngines] = useState<any[]>([]);
  const [docSources, setDocSources] = useState<any[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<any[]>([]);
  const [providerHealth, setProviderHealth] = useState<any[]>([]);
  const [lspStatus, setLspStatus] = useState<any[]>([]);
  const [docPath, setDocPath] = useState('docs');
  const [docUrl, setDocUrl] = useState('');
  const [docTitle, setDocTitle] = useState('');

  const loadAll = async () => {
    try {
      const [p, m, r, a, sb, acp, sess, jobs, wf, indexingCfg, agentCfg, toolsRes, catalogRes, enginesRes, docsRes, provCatalog, provHealth, lspRes] = await Promise.all([
        axios.get(`${API_BASE}/v3/providers/config`),
        axios.get(`${API_BASE}/v3/mcp/config`),
        axios.get(`${API_BASE}/v3/rules/list`),
        axios.get(`${API_BASE}/v3/approval/config`),
        axios.get(`${API_BASE}/v3/sandbox/config`),
        axios.get(`${API_BASE}/v3/acp/backends`),
        axios.get(`${API_BASE}/v3/agent-sessions`),
        axios.get(`${API_BASE}/v3/automation`),
        axios.get(`${API_BASE}/v3/hitl/workflows`),
        axios.get(`${API_BASE}/v3/indexing/config`).catch(() => ({ data: { vectorBackend: 'json' } })),
        axios.get(`${API_BASE}/v3/agent/config`).catch(() => ({ data: { deferWrites: true, autoCommit: true } })),
        axios.get(`${API_BASE}/v3/approval/tools`).catch(() => ({ data: { tools: [] } })),
        axios.get(`${API_BASE}/v3/mcp/catalog`).catch(() => ({ data: { catalog: [] } })),
        axios.get(`${API_BASE}/v3/engines/matrix`).catch(() => ({ data: { engines: [] } })),
        axios.get(`${API_BASE}/v3/docs/list`).catch(() => ({ data: { sources: [] } })),
        axios.get(`${API_BASE}/v3/providers/catalog`).catch(() => ({ data: { catalog: [] } })),
        axios.get(`${API_BASE}/v3/providers/health`).catch(() => ({ data: { health: [] } })),
        axios.get(`${API_BASE}/v3/lsp/status`).catch(() => ({ data: { servers: [] } }))
      ]);
      setProviders(p.data?.config || p.data);
      setMcpPath(m.data?.path || '');
      setMcpConfig(JSON.stringify(m.data?.config || { mcpServers: {} }, null, 2));
      setRules(r.data?.rules || []);
      setApproval(a.data?.config || a.data);
      setSandbox(sb.data || { enabled: false, image: 'node:20-bookworm-slim' });
      setAcpBackends(acp.data?.backends || []);
      setAcpActive((acp.data?.backends || []).find((b: any) => b.active)?.id || null);
      setUseAcpForChat(!!acp.data?.useAcpForChat);
      setSessions(sess.data?.sessions || []);
      setAutomationJobs(jobs.data?.jobs || []);
      setWorkflows(wf.data?.workflows || []);
      setIndexing(indexingCfg.data || { vectorBackend: 'json', ftsBackend: 'json' });
      setSqliteAvailable(!!indexingCfg.data?.sqliteAvailable);
      setAgentConfig(agentCfg.data || { deferWrites: true, autoCommit: true });
      setPerToolList(toolsRes.data?.tools || []);
      setMcpCatalog(catalogRes.data?.catalog || []);
      setEngines(enginesRes.data?.engines || []);
      setDocSources(docsRes.data?.sources || []);
      setProviderCatalog(provCatalog.data?.catalog || []);
      setProviderHealth(provHealth.data?.health || []);
      setLspStatus(lspRes.data?.servers || []);
    } catch { /* ignore */ }
  };

  const applyCatalogProvider = async (providerId: string) => {
    await axios.post(`${API_BASE}/v3/providers/catalog/apply`, { providerId });
    setMsg(t('agentSettings.catalogApplied'));
    loadAll();
  };

  const testProvider = async (providerId: string) => {
    const r = await axios.post(`${API_BASE}/v3/providers/test`, { providerId });
    setMsg(`${providerId}: ${r.data?.ok ? '✓' : '✗'} ${r.data?.detail || ''}`);
    loadAll();
  };

  useEffect(() => { loadAll(); }, []);

  const saveProviders = async () => {
    await axios.post(`${API_BASE}/v3/providers/config`, providers);
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const saveMcp = async () => {
    const config = JSON.parse(mcpConfig);
    await axios.post(`${API_BASE}/v3/mcp/config`, { config });
    setMsg(t('agentSettings.mcpSaved'));
  };

  const saveRule = async () => {
    if (!ruleName.trim()) return;
    await axios.post(`${API_BASE}/v3/rules/save`, { name: ruleName, content: ruleContent });
    setRuleName('');
    setRuleContent('');
    setMsg(t('agentSettings.ruleSaved'));
    loadAll();
  };

  const addDocSource = async (type: 'folder' | 'url') => {
    if (type === 'folder') {
      await axios.post(`${API_BASE}/v3/docs/add`, { type: 'folder', path: docPath, title: docTitle || docPath });
    } else {
      await axios.post(`${API_BASE}/v3/docs/add`, { type: 'url', url: docUrl, title: docTitle || docUrl });
    }
    setDocTitle('');
    setMsg(t('agentSettings.docsSaved'));
    loadAll();
  };

  const saveApproval = async () => {
    await axios.post(`${API_BASE}/v3/approval/config`, approval);
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const togglePerTool = async (tool: string, autoApprove: boolean) => {
    await axios.post(`${API_BASE}/v3/approval/per-tool`, { tool, autoApprove });
    loadAll();
  };

  const addCatalogMcp = async (id: string) => {
    await axios.post(`${API_BASE}/v3/mcp/catalog/add`, { id });
    setMsg(t('agentSettings.mcpSaved'));
    loadAll();
  };

  const applyEngine = async (engineId: string) => {
    await axios.post(`${API_BASE}/v3/engines/apply`, { engineId });
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const saveSandbox = async () => {
    await axios.post(`${API_BASE}/v3/sandbox/config`, sandbox);
    setMsg(t('agentSettings.saved'));
  };

  const saveAcp = async () => {
    await axios.post(`${API_BASE}/v3/acp/config`, {
      backends: Object.fromEntries(acpBackends.map((b) => [b.id, b])),
      active: acpActive,
      useAcpForChat
    });
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const createSession = async () => {
    await axios.post(`${API_BASE}/v3/agent-sessions`, { title: sessionTitle });
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const deleteSession = async (id: string) => {
    await axios.delete(`${API_BASE}/v3/agent-sessions/${id}`);
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const createJob = async () => {
    await axios.post(`${API_BASE}/v3/automation`, {
      type: newJobType,
      prompt: newJobPrompt,
      intervalMs: newJobType === 'interval' ? Number(newJobIntervalMs) : 0
    });
    setMsg(t('agentSettings.saved'));
    setNewJobPrompt('');
    loadAll();
  };

  const deleteJob = async (id: string) => {
    await axios.delete(`${API_BASE}/v3/automation/${id}`);
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const createWorkflow = async () => {
    const steps = JSON.parse(workflowStepsJson);
    await axios.post(`${API_BASE}/v3/hitl/workflows`, { name: workflowName, steps });
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const approveWorkflow = async (id: string, approved: boolean) => {
    await axios.post(`${API_BASE}/v3/hitl/workflows/${id}/approve`, { approved });
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const runWorkflow = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/v3/hitl/workflows/${id}/approve`, { approved: true });
      await fetch(`${API_BASE}/v3/hitl/workflows/${id}/run`, { method: 'POST' });
      setMsg(t('agentSettings.workflowRunning'));
      loadAll();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const saveIndexing = async () => {
    await axios.post(`${API_BASE}/v3/indexing/config`, indexing);
    setMsg(t('agentSettings.saved'));
    loadAll();
  };

  const saveAgentConfig = async () => {
    await axios.post(`${API_BASE}/v3/agent/config`, agentConfig);
    setMsg(t('agentSettings.saved'));
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
        background: tab === id ? 'rgba(59,130,246,0.2)' : 'transparent',
        color: tab === id ? '#93c5fd' : '#888', fontSize: '13px', fontWeight: 600
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: embedded ? 0 : '20px', maxWidth: embedded ? '100%' : '900px', color: '#ddd' }}>
      {!embedded && <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>{t('agentSettings.title')}</h2>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 2, paddingBottom: '8px', background: embedded ? 'hsl(var(--bg-main))' : '#0a0a0a' }}>
        {tabBtn('providers', t('agentSettings.providers'))}
        {tabBtn('mcp', 'MCP')}
        {tabBtn('rules', t('agentSettings.rules'))}
        {tabBtn('docs', t('agentSettings.docs'))}
        {tabBtn('approval', t('agentSettings.approval'))}
        {tabBtn('advanced', t('agentSettings.advanced'))}
      </div>
      {msg && <p style={{ color: '#34d399', fontSize: '13px' }}>{msg}</p>}

      {tab === 'providers' && providers && (
        <div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.providersHint')}</p>
          {providerHealth.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '10px', background: '#141414', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{t('agentSettings.providerHealth')}</div>
              {providerHealth.map((h) => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: h.ok ? '#6ee7b7' : '#fca5a5' }}>{h.label || h.id}</span>
                  <span style={{ color: '#888' }}>{h.detail} {h.latencyMs != null ? `(${h.latencyMs}ms)` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {Object.entries(providers.providers || {}).map(([key, prov]: [string, any]) => (
            <div key={key} style={{ marginBottom: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600 }}>{key}</div>
                <button type="button" onClick={() => void testProvider(key)} style={{ ...primaryBtn, padding: '4px 10px', fontSize: '11px' }}>
                  {t('agentSettings.testProvider')}
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
                <input type="checkbox" checked={!!prov.enabled} onChange={(e) => {
                  setProviders({ ...providers, providers: { ...providers.providers, [key]: { ...prov, enabled: e.target.checked } } });
                }} />
                {t('agentSettings.enabled')}
              </label>
              {prov.baseUrl !== undefined && (
                <input value={prov.baseUrl || ''} onChange={(e) => {
                  setProviders({ ...providers, providers: { ...providers.providers, [key]: { ...prov, baseUrl: e.target.value } } });
                }} placeholder="baseUrl" style={inputStyle} />
              )}
              {prov.apiKey !== undefined && (
                <input value={prov.apiKey || ''} onChange={(e) => {
                  setProviders({ ...providers, providers: { ...providers.providers, [key]: { ...prov, apiKey: e.target.value } } });
                }} placeholder="apiKey" type="password" style={inputStyle} />
              )}
              {prov.model !== undefined && (
                <input value={prov.model || ''} onChange={(e) => {
                  setProviders({ ...providers, providers: { ...providers.providers, [key]: { ...prov, model: e.target.value } } });
                }} placeholder="model" style={inputStyle} />
              )}
            </div>
          ))}
          <h4 style={{ fontSize: '13px', margin: '22px 0 8px' }}>{t('agentSettings.litellmCatalog')}</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{t('agentSettings.litellmCatalogHint')}</p>
          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
          {providerCatalog.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#141414', borderRadius: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.label}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{c.models?.slice(0, 2).join(', ')}</div>
              </div>
              <button type="button" onClick={() => void applyCatalogProvider(c.id)} style={{ ...primaryBtn, padding: '6px 12px', fontSize: '12px' }}>
                {t('agentSettings.addProvider')}
              </button>
            </div>
          ))}
          </div>
          <h4 style={{ fontSize: '13px', margin: '22px 0 8px' }}>{t('agentSettings.roleModels')}</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{t('agentSettings.roleModelsHint')}</p>
          {Object.entries(providers.roles || {}).map(([role, cfg]: [string, any]) => (
            <div key={role} style={{ marginBottom: '10px', padding: '10px', background: '#141414', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', textTransform: 'capitalize' }}>{role}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={cfg.provider || 'ollama'}
                  onChange={(e) => {
                    setProviders({
                      ...providers,
                      roles: { ...providers.roles, [role]: { ...cfg, provider: e.target.value } }
                    });
                  }}
                  style={{ ...inputStyle, width: '140px', marginBottom: 0 }}
                >
                  {Object.keys(providers.providers || {}).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <input
                  value={cfg.model || ''}
                  onChange={(e) => {
                    setProviders({
                      ...providers,
                      roles: { ...providers.roles, [role]: { ...cfg, model: e.target.value } }
                    });
                  }}
                  placeholder="model"
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
              </div>
            </div>
          ))}
          <h4 style={{ fontSize: '13px', margin: '22px 0 8px' }}>{t('agentSettings.engineMatrix')}</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{t('agentSettings.engineMatrixHint')}</p>
          {engines.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#1a1a1a', borderRadius: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{e.name}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{e.description}</div>
              </div>
              <button type="button" onClick={() => void applyEngine(e.id)} style={{ ...primaryBtn, padding: '6px 12px', fontSize: '12px' }}>
                {t('agentSettings.applyEngine')}
              </button>
            </div>
          ))}
          <button type="button" onClick={saveProviders} style={{ ...primaryBtn, marginTop: '12px' }}>{t('agentSettings.save')}</button>
        </div>
      )}

      {tab === 'mcp' && (
        <div>
          <p style={{ fontSize: '12px', color: '#888' }}>{mcpPath}</p>
          <textarea value={mcpConfig} onChange={(e) => setMcpConfig(e.target.value)} rows={16}
            style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', minHeight: '280px' }} />
          <button type="button" onClick={saveMcp} style={{ ...primaryBtn, marginBottom: '20px' }}>{t('agentSettings.saveMcp')}</button>
          <h4 style={{ fontSize: '13px', margin: '0 0 8px' }}>{t('agentSettings.mcpCatalog')}</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{t('agentSettings.mcpCatalogHint')}</p>
          {mcpCatalog.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#1a1a1a', borderRadius: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{c.description}</div>
              </div>
              <button type="button" onClick={() => void addCatalogMcp(c.id)} style={{ ...primaryBtn, padding: '6px 12px', fontSize: '12px' }}>
                {t('agentSettings.addMcp')}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'rules' && (
        <div>
          {rules.map((r) => (
            <div key={r.path} style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '8px', fontSize: '13px' }}>
              <strong>{r.name}</strong>
              {(r.alwaysApply || r.globs?.length || r.description) && (
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                  {r.alwaysApply ? 'alwaysApply ' : ''}
                  {r.globs?.length ? `globs: ${r.globs.join(', ')} ` : ''}
                  {r.description ? `— ${r.description}` : ''}
                </div>
              )}
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: '#aaa', fontSize: '11px' }}>{r.content.slice(0, 300)}</pre>
            </div>
          ))}
          <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder={t('agentSettings.ruleName')} style={inputStyle} />
          <textarea value={ruleContent} onChange={(e) => setRuleContent(e.target.value)} rows={6} placeholder={'---\nalwaysApply: true\nglobs: ["src/**/*.ts"]\ndescription: TypeScript rules\n---\n\n' + t('agentSettings.ruleContent')}
            style={{ ...inputStyle, width: '100%', minHeight: '120px' }} />
          <button type="button" onClick={saveRule} style={primaryBtn}>{t('agentSettings.addRule')}</button>
        </div>
      )}

      {tab === 'docs' && (
        <div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.docsHint')}</p>
          {docSources.map((d) => (
            <div key={d.id} style={{ marginBottom: '8px', padding: '10px', background: '#1a1a1a', borderRadius: '8px', fontSize: '12px' }}>
              <strong>{d.title || d.id}</strong>
              <div style={{ color: '#666' }}>{d.type} — {d.path || d.url}</div>
            </div>
          ))}
          <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={t('agentSettings.docsTitle')} style={inputStyle} />
          <input value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder="docs" style={inputStyle} />
          <button type="button" onClick={() => void addDocSource('folder')} style={{ ...primaryBtn, marginRight: '8px' }}>{t('agentSettings.addDocsFolder')}</button>
          <input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          <button type="button" onClick={() => void addDocSource('url')} style={primaryBtn}>{t('agentSettings.addDocsUrl')}</button>
        </div>
      )}

      {tab === 'approval' && approval && (
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <input type="checkbox" checked={!!approval.yolo} onChange={(e) => setApproval({ ...approval, yolo: e.target.checked })} />
            <span>YOLO — {t('agentSettings.yoloDesc')}</span>
          </label>
          {(['read', 'write', 'terminal', 'browser', 'mcp'] as const).map((k) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px' }}>
              <input type="checkbox" checked={!!approval.autoApprove?.[k]}
                onChange={(e) => setApproval({
                  ...approval,
                  autoApprove: { ...approval.autoApprove, [k]: e.target.checked }
                })} />
              {t(`agentSettings.auto_${k}`)}
            </label>
          ))}
          <h4 style={{ fontSize: '13px', margin: '18px 0 8px', color: '#aaa' }}>{t('agentSettings.perTool')}</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{t('agentSettings.perToolHint')}</p>
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
            {perToolList.map((row) => (
              <label key={row.tool} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                <input type="checkbox" checked={!!row.autoApprove}
                  onChange={(e) => void togglePerTool(row.tool, e.target.checked)} />
                <code style={{ color: '#93c5fd' }}>{row.tool}</code>
                <span style={{ color: '#666' }}>({row.category})</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={saveApproval} style={primaryBtn}>{t('agentSettings.save')}</button>
        </div>
      )}

      {tab === 'advanced' && (
        <div>
          <h3 style={{ fontSize: '14px', margin: '0 0 10px' }}>{t('agentSettings.sandbox')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.sandboxHint')}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px' }}>
            <input type="checkbox" checked={!!sandbox?.enabled} onChange={(e) => setSandbox({ ...sandbox, enabled: e.target.checked })} />
            {t('agentSettings.enabled')}
          </label>
          <input value={sandbox?.image || ''} onChange={(e) => setSandbox({ ...sandbox, image: e.target.value })}
            placeholder="Docker image" style={inputStyle} />
          <input value={sandbox?.playwrightImage || ''} onChange={(e) => setSandbox({ ...sandbox, playwrightImage: e.target.value })}
            placeholder="Playwright Docker image" style={inputStyle} />
          <button type="button" onClick={saveSandbox} style={{ ...primaryBtn, marginBottom: '24px' }}>{t('agentSettings.save')}</button>

          <h3 style={{ fontSize: '14px', margin: '0 0 10px' }}>{t('agentSettings.lspServers')}</h3>
          {lspStatus.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>{t('agentSettings.lspServersEmpty')}</p>
          ) : (
            lspStatus.map((s) => (
              <div key={s.id} style={{ fontSize: '12px', marginBottom: '6px', color: '#aaa' }}>
                <span style={{ color: s.running ? '#6ee7b7' : '#888' }}>{s.id}</span>
                <span style={{ color: '#555' }}> — {s.extensions?.join(', ')}</span>
              </div>
            ))
          )}

          <h3 style={{ fontSize: '14px', margin: '0 0 10px' }}>{t('agentSettings.acp')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.acpHint')}</p>
          {acpBackends.map((b) => (
            <div key={b.id} style={{ marginBottom: '12px', padding: '12px', background: '#1a1a1a', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{b.label || b.id}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px' }}>
                <input type="checkbox" checked={!!b.enabled} onChange={(e) => {
                  setAcpBackends(acpBackends.map((x) => x.id === b.id ? { ...x, enabled: e.target.checked } : x));
                }} />
                {t('agentSettings.enabled')}
              </label>
              <input value={b.command || ''} onChange={(e) => {
                setAcpBackends(acpBackends.map((x) => x.id === b.id ? { ...x, command: e.target.value } : x));
              }} placeholder="CLI command" style={inputStyle} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input type="radio" name="acp-active" checked={acpActive === b.id} onChange={() => setAcpActive(b.id)} />
                {t('agentSettings.acpActive')}
              </label>
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
            <input type="checkbox" checked={useAcpForChat} onChange={(e) => setUseAcpForChat(e.target.checked)} />
            {t('agentSettings.useAcpForChat')}
          </label>
          <button type="button" onClick={saveAcp} style={primaryBtn}>{t('agentSettings.save')}</button>

          <h3 style={{ fontSize: '14px', margin: '26px 0 10px' }}>{t('agentSettings.indexing')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.indexingHint')}</p>
          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', marginBottom: '12px' }}>
            <span style={{ color: '#aaa', fontWeight: 600 }}>{t('agentSettings.vectorBackend')}</span>
            <select
              value={String(indexing?.vectorBackend || 'json')}
              onChange={(e) => setIndexing({ ...indexing, vectorBackend: e.target.value })}
              style={{ ...inputStyle, marginBottom: 0, width: '240px' }}
            >
              <option value="json">JSON (small/medium)</option>
              <option value="lancedb">LanceDB (large)</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', marginBottom: '12px' }}>
            <span style={{ color: '#aaa', fontWeight: 600 }}>{t('agentSettings.ftsBackend')}</span>
            <select
              value={String(indexing?.ftsBackend || 'json')}
              onChange={(e) => setIndexing({ ...indexing, ftsBackend: e.target.value })}
              style={{ ...inputStyle, marginBottom: 0, width: '240px' }}
            >
              <option value="json">JSON FTS</option>
              <option value="sqlite" disabled={!sqliteAvailable}>SQLite FTS5{sqliteAvailable ? '' : ' (Node 22+)'}</option>
            </select>
          </label>
          {!sqliteAvailable && (
            <p style={{ fontSize: '11px', color: '#888', margin: '-6px 0 12px' }}>{t('agentSettings.sqliteUnavailable')}</p>
          )}
          <button type="button" onClick={saveIndexing} style={{ ...primaryBtn, marginBottom: '24px' }}>{t('agentSettings.save')}</button>

          <h3 style={{ fontSize: '14px', margin: '0 0 10px' }}>{t('agentSettings.writeMode')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.writeModeHint')}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px' }}>
            <input type="checkbox" checked={!!agentConfig.deferWrites} onChange={(e) => setAgentConfig({ ...agentConfig, deferWrites: e.target.checked })} />
            {t('agentSettings.deferWrites')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
            <input type="checkbox" checked={!!agentConfig.autoCommit} onChange={(e) => setAgentConfig({ ...agentConfig, autoCommit: e.target.checked })} />
            {t('agentSettings.autoCommit')}
          </label>
          <button type="button" onClick={saveAgentConfig} style={{ ...primaryBtn, marginBottom: '24px' }}>{t('agentSettings.save')}</button>

          <h3 style={{ fontSize: '14px', margin: '26px 0 10px' }}>{t('agentSettings.sessions')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.sessionsHint')}</p>
          <input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder={t('agentSettings.sessionTitle')} style={inputStyle} />
          <button type="button" onClick={createSession} style={{ ...primaryBtn, marginBottom: '12px' }}>{t('agentSettings.createSession')}</button>
          {(sessions || []).map((s) => (
            <div key={s.id} style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || s.id}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{s.id}</div>
              </div>
              <button type="button" onClick={() => deleteSession(s.id)} style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                {t('agentSettings.delete')}
              </button>
            </div>
          ))}

          <h3 style={{ fontSize: '14px', margin: '26px 0 10px' }}>{t('agentSettings.automation')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.automationHint')}</p>
          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', marginBottom: '10px' }}>
            <span style={{ color: '#aaa', fontWeight: 600 }}>{t('agentSettings.type')}</span>
            <select value={newJobType} onChange={(e) => setNewJobType(e.target.value as any)} style={{ ...inputStyle, marginBottom: 0, width: '220px' }}>
              <option value="interval">{t('agentSettings.interval')}</option>
              <option value="webhook">{t('agentSettings.webhook')}</option>
            </select>
          </label>
          {newJobType === 'interval' && (
            <input value={String(newJobIntervalMs)} onChange={(e) => setNewJobIntervalMs(Number(e.target.value || 0))} placeholder="intervalMs" style={inputStyle} />
          )}
          <textarea value={newJobPrompt} onChange={(e) => setNewJobPrompt(e.target.value)} rows={4} placeholder={t('agentSettings.prompt')} style={{ ...inputStyle, width: '100%', minHeight: '120px' }} />
          <button type="button" onClick={createJob} style={{ ...primaryBtn, marginBottom: '12px' }}>{t('agentSettings.addJob')}</button>
          {(automationJobs || []).map((j) => (
            <div key={j.id} style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontWeight: 700 }}>{j.type} {j.enabled === false ? '(disabled)' : ''}</div>
                <button type="button" onClick={() => deleteJob(j.id)} style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                  {t('agentSettings.delete')}
                </button>
              </div>
              {j.type === 'webhook' && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                  {t('agentSettings.webhookSecret')}: <code style={{ color: '#93c5fd' }}>{j.webhookSecret}</code>
                </div>
              )}
              {j.intervalMs ? <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>intervalMs: {j.intervalMs}</div> : null}
              {j.prompt ? <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: '#aaa', fontSize: '11px' }}>{String(j.prompt).slice(0, 400)}</pre> : null}
            </div>
          ))}

          <h3 style={{ fontSize: '14px', margin: '26px 0 10px' }}>{t('agentSettings.hitl')}</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{t('agentSettings.hitlHint')}</p>
          <input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder={t('agentSettings.workflowName')} style={inputStyle} />
          <textarea value={workflowStepsJson} onChange={(e) => setWorkflowStepsJson(e.target.value)} rows={8} placeholder={t('agentSettings.workflowSteps')} style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', minHeight: '220px' }} />
          <button type="button" onClick={createWorkflow} style={{ ...primaryBtn, marginBottom: '12px' }}>{t('agentSettings.createWorkflow')}</button>
          {(workflows || []).map((wf) => (
            <div key={wf.id} style={{ marginBottom: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ fontWeight: 700 }}>{wf.name || wf.id}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>status: {wf.status} · step {wf.current}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => runWorkflow(wf.id)} style={{ ...primaryBtn, padding: '8px 12px' }}>
                  {t('agentSettings.runWorkflow')}
                </button>
                <button type="button" onClick={() => approveWorkflow(wf.id, true)} style={{ ...primaryBtn, padding: '8px 12px', background: '#10b981' }}>
                  {t('agentSettings.approve')}
                </button>
                <button type="button" onClick={() => approveWorkflow(wf.id, false)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  {t('agentSettings.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginBottom: '10px', padding: '10px',
  background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#eee', fontSize: '13px'
};

const primaryBtn: React.CSSProperties = {
  background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
};

export default AgentSettingsPanel;
