/**
 * LiteLLM-style provider catalog and routing (Aider/FCC-inspired).
 */
const axios = require('axios');
const PROVIDER_CATALOG = require('./litellmCatalog.json');

function getCatalog() {
  return PROVIDER_CATALOG.map((p) => ({ ...p }));
}

function catalogEntry(id) {
  return PROVIDER_CATALOG.find((p) => p.id === id) || null;
}

function applyCatalogToProviders(config, providerId) {
  const entry = catalogEntry(providerId);
  if (!entry) return config;
  const providers = { ...(config.providers || {}) };
  if (!providers[providerId]) {
    providers[providerId] = {
      type: entry.type,
      baseUrl: entry.baseUrl,
      apiKey: '',
      enabled: false,
      model: entry.models[0] || 'default',
      label: entry.label
    };
  } else {
    providers[providerId] = {
      ...providers[providerId],
      type: entry.type,
      baseUrl: providers[providerId].baseUrl || entry.baseUrl,
      label: entry.label
    };
  }
  return { ...config, providers };
}

/**
 * Resolve model strings like "groq/llama-3.3-70b-versatile" or "gpt-4o-mini".
 */
function resolveLiteLlmModel(modelName, config = {}) {
  const m = String(modelName || '').trim();
  if (!m) return null;

  if (m.includes('/')) {
    const [prov, ...rest] = m.split('/');
    const inConfig = config.providers?.[prov];
    const inCatalog = catalogEntry(prov);
    if (inConfig || inCatalog) {
      return { providerId: prov, model: rest.join('/') };
    }
  }

  for (const entry of PROVIDER_CATALOG) {
    if (entry.models.includes(m)) {
      return { providerId: entry.id, model: m };
    }
  }

  return null;
}

async function testProvider(provider, getOllamaBase) {
  const type = provider.type || 'openai';
  const started = Date.now();
  try {
    if (type === 'ollama') {
      const base = provider.baseUrl || getOllamaBase?.() || 'http://127.0.0.1:11434';
      const r = await axios.get(`${base.replace(/\/$/, '')}/api/tags`, { timeout: 6000 });
      const count = r.data?.models?.length || 0;
      return { ok: true, latencyMs: Date.now() - started, detail: `${count} models`, models: count };
    }
    if (type === 'openai') {
      const base = String(provider.baseUrl || '').replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
      const r = await axios.get(`${base}/models`, { headers, timeout: 8000, validateStatus: () => true });
      const ok = r.status >= 200 && r.status < 300;
      const count = Array.isArray(r.data?.data) ? r.data.data.length : 0;
      return {
        ok,
        latencyMs: Date.now() - started,
        detail: ok ? `${count || 'ok'} models` : `HTTP ${r.status}`,
        models: count
      };
    }
    if (type === 'anthropic') {
      return { ok: !!provider.apiKey, latencyMs: Date.now() - started, detail: provider.apiKey ? 'key set' : 'no api key' };
    }
    return { ok: false, latencyMs: Date.now() - started, detail: 'unknown provider type' };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, detail: e.message || 'unreachable' };
  }
}

async function healthCheckAll(gateway, getOllamaBase) {
  const cfg = gateway.getConfig ? gateway.getConfig() : gateway;
  const rows = [];
  for (const [id, prov] of Object.entries(cfg.providers || {})) {
    const full = gateway.getProvider ? gateway.getProvider(id) : prov;
    const test = await testProvider(full, getOllamaBase);
    rows.push({
      id,
      label: prov.label || catalogEntry(id)?.label || id,
      enabled: prov.enabled !== false,
      type: prov.type || 'openai',
      ...test
    });
  }
  return rows;
}

module.exports = {
  PROVIDER_CATALOG,
  getCatalog,
  catalogEntry,
  applyCatalogToProviders,
  resolveLiteLlmModel,
  testProvider,
  healthCheckAll
};
