/**
 * Unified LLM gateway — Ollama + OpenAI-compatible providers.
 * Inspired by free-claude-code routing (conceptual, original implementation).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

const CONFIG_PATH = path.join(os.homedir(), '.aivon-os', 'providers.json');

const { resolveTier, mapTaskToTier } = require('./tierRouting');
const { resolveLiteLlmModel } = require('./litellmRouter');
const { encryptSecret, decryptSecret, isEncrypted } = require('./secretStore');

const DEFAULT_CONFIG = {
  defaultProvider: 'ollama',
  roles: {
    chat: { provider: 'ollama', model: 'qwen2.5:0.5b' },
    code: { provider: 'ollama', model: 'deepseek-coder:33b' },
    autocomplete: { provider: 'ollama', model: 'qwen2.5:0.5b' },
    plan: { provider: 'ollama', model: 'qwen2.5:0.5b' },
    embed: { provider: 'ollama', model: 'nomic-embed-text' },
    refactor: { provider: 'ollama', model: 'deepseek-coder:33b' },
    nes: { provider: 'ollama', model: 'qwen2.5:0.5b' }
  },
  providers: {
    ollama: { type: 'ollama', baseUrl: 'http://127.0.0.1:11434' },
    openai_compat: {
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      enabled: false,
      model: 'gpt-4o-mini'
    },
    openrouter: {
      type: 'openai',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      enabled: false,
      model: 'openai/gpt-4o-mini'
    },
    lmstudio: {
      type: 'openai',
      baseUrl: 'http://127.0.0.1:1234/v1',
      apiKey: 'lm-studio',
      enabled: false,
      model: 'local-model'
    },
    llamacpp: {
      type: 'openai',
      baseUrl: 'http://127.0.0.1:8080/v1',
      apiKey: 'llamacpp',
      enabled: false,
      model: 'local-model',
      label: 'llama.cpp server (OpenAI-compatible)'
    },
    anthropic: {
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      enabled: false,
      model: 'claude-sonnet-4-20250514'
    }
  }
};

class LlmGateway {
  constructor(getOllamaBase) {
    this.getOllamaBase = getOllamaBase || (() => 'http://127.0.0.1:11434');
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readJsonSync(CONFIG_PATH);
        this.config = { ...DEFAULT_CONFIG, ...data, providers: { ...DEFAULT_CONFIG.providers, ...(data.providers || {}) } };
        // Decrypt at-rest secrets into plaintext for in-memory use.
        let needsMigration = false;
        for (const p of Object.values(this.config.providers || {})) {
          if (p && p.apiKey) {
            if (!isEncrypted(p.apiKey)) needsMigration = true; // legacy plaintext key on disk
            p.apiKey = decryptSecret(p.apiKey);
          }
        }
        // One-time migration: re-encrypt any legacy plaintext keys at rest.
        if (needsMigration) {
          try { this.save(); } catch { /* non-fatal */ }
        }
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  save(partial = {}) {
    this.config = {
      ...this.config,
      ...partial,
      providers: { ...this.config.providers, ...(partial.providers || {}) }
    };
    fs.ensureDirSync(path.dirname(CONFIG_PATH));
    // Encrypt secrets at rest; keep in-memory config plaintext for callers.
    const onDisk = JSON.parse(JSON.stringify(this.config));
    for (const p of Object.values(onDisk.providers || {})) {
      if (p && p.apiKey) p.apiKey = encryptSecret(p.apiKey);
    }
    fs.writeJsonSync(CONFIG_PATH, onDisk, { spaces: 2 });
    return this.config;
  }

  getConfig() {
    const safe = JSON.parse(JSON.stringify(this.config));
    for (const p of Object.values(safe.providers || {})) {
      if (p.apiKey) p.apiKey = p.apiKey ? '••••' + String(p.apiKey).slice(-4) : '';
    }
    return safe;
  }

  resolveProvider(modelName, role) {
    const m = String(modelName || '').trim();
    if (m.startsWith('tier:')) {
      const tier = resolveTier(m.slice(5), this.config);
      return { providerId: tier.provider, model: tier.model, tier: tier.tier };
    }
    const litellm = resolveLiteLlmModel(m, this.config);
    if (litellm) return litellm;
    if (m.includes('/')) {
      const [prov, ...rest] = m.split('/');
      if (this.config.providers[prov]?.enabled !== false && this.config.providers[prov]) {
        return { providerId: prov, model: rest.join('/') };
      }
    }
    const roleCfg = this.config.roles?.[role] || this.config.roles?.[mapTaskToTier(role)] || this.config.roles?.chat;
    if (roleCfg && !m) {
      return { providerId: roleCfg.provider, model: roleCfg.model };
    }
    if (m && this.config.providers[m.split(':')[0]]) {
      const pid = m.split(':')[0];
      return { providerId: pid, model: m };
    }
    return { providerId: this.config.defaultProvider || 'ollama', model: m || roleCfg?.model || 'mistral' };
  }

  getProvider(id) {
    const p = this.config.providers[id];
    if (!p) return { ...this.config.providers.ollama, type: 'ollama' };
    if (p.type === 'ollama') {
      return { ...p, baseUrl: this.getOllamaBase() };
    }
    return p;
  }

  async listModels() {
    const out = [];
    const ollamaBase = this.getOllamaBase();
    try {
      const r = await axios.get(`${ollamaBase}/api/tags`, { timeout: 8000 });
      for (const m of r.data?.models || []) {
        out.push({ name: m.name, provider: 'ollama', label: m.name, source: 'local' });
      }
    } catch { /* ignore */ }

    for (const [id, prov] of Object.entries(this.config.providers || {})) {
      if (prov.type === 'openai' && !prov.enabled) continue;
      if (prov.type === 'anthropic' && !prov.enabled) continue;
      if (prov.type !== 'openai' && prov.type !== 'anthropic') continue;
      const model = prov.model || 'default';
      out.push({
        name: `${id}/${model}`,
        provider: id,
        label: `${id}: ${model}`,
        source: 'cloud'
      });
    }
    return out;
  }

  /** Stream chat — returns axios-like response with .data stream for Ollama, or synthetic for OpenAI */
  async chatStream(payload, options = {}) {
    const { model, messages, stream = true } = payload;
    const { role = 'chat' } = options;
    const { providerId, model: resolvedModel } = this.resolveProvider(model, role);
    const prov = this.getProvider(providerId);

    if (prov.type === 'ollama' || providerId === 'ollama') {
      const base = prov.baseUrl || this.getOllamaBase();
      return axios.post(`${base}/api/chat`, { ...payload, model: resolvedModel }, {
        responseType: 'stream',
        timeout: options.timeout || 120000
      });
    }

    if (prov.type === 'openai') {
      const base = String(prov.baseUrl || '').replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (prov.apiKey) headers.Authorization = `Bearer ${prov.apiKey}`;

      const oaiPayload = {
        model: resolvedModel.includes('/') ? resolvedModel.split('/').slice(1).join('/') : (prov.model || resolvedModel),
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        stream: true
      };

      const r = await axios.post(`${base}/chat/completions`, oaiPayload, {
        responseType: 'stream',
        headers,
        timeout: options.timeout || 120000
      });

      return {
        data: this._openAiStreamToOllama(r.data, resolvedModel)
      };
    }

    if (prov.type === 'anthropic') {
      const base = String(prov.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (prov.apiKey) headers['x-api-key'] = prov.apiKey;
      const modelName = resolvedModel.includes('/')
        ? resolvedModel.split('/').slice(1).join('/')
        : (prov.model || resolvedModel);
      const system = (messages || []).find((m) => m.role === 'system')?.content || '';
      const userMsgs = (messages || []).filter((m) => m.role !== 'system');
      const r = await axios.post(`${base}/v1/messages`, {
        model: modelName,
        max_tokens: 4096,
        system: system || undefined,
        messages: userMsgs.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        stream: true
      }, { responseType: 'stream', headers, timeout: options.timeout || 120000 });

      const { PassThrough } = require('stream');
      const out = new PassThrough();
      let buffer = '';
      r.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, '').trim();
          if (!trimmed || trimmed === '[DONE]') continue;
          try {
            const j = JSON.parse(trimmed);
            if (j.type === 'content_block_delta' && j.delta?.text) {
              out.write(JSON.stringify({ message: { content: j.delta.text }, done: false }) + '\n');
            }
            if (j.type === 'message_stop') {
              out.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
            }
          } catch { /* skip */ }
        }
      });
      r.data.on('end', () => {
        out.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
        out.end();
      });
      return { data: out };
    }

    throw new Error(`Unknown provider type: ${prov.type}`);
  }

  _openAiStreamToOllama(openAiStream, model) {
    const { Readable } = require('stream');
    let buffer = '';
    return new Readable({
      read() {},
      async construct(callback) {
        callback();
      }
    }).on('newListener', (ev) => {
      if (ev !== 'data') return;
      (async () => {
        for await (const chunk of openAiStream) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.replace(/^data:\s*/, '').trim();
            if (!trimmed || trimmed === '[DONE]') continue;
            try {
              const j = JSON.parse(trimmed);
              const delta = j.choices?.[0]?.delta?.content || '';
              if (delta) {
                openAiStream.emit?.('data', Buffer.from(JSON.stringify({ message: { content: delta }, done: false }) + '\n'));
              }
            } catch { /* skip */ }
          }
        }
        openAiStream.emit?.('data', Buffer.from(JSON.stringify({ message: { content: '' }, done: true }) + '\n'));
      })().catch(() => {});
    });
  }

  /** Simpler non-streaming generate for autocomplete / agents */
  async generate({ model, prompt, system, options = {}, role = 'autocomplete' }) {
    const { providerId, model: resolvedModel } = this.resolveProvider(model, role);
    const prov = this.getProvider(providerId);

    if (prov.type === 'ollama' || providerId === 'ollama') {
      const base = prov.baseUrl || this.getOllamaBase();
      const r = await axios.post(`${base}/api/generate`, {
        model: resolvedModel,
        prompt,
        system,
        stream: false,
        options
      }, { timeout: 60000 });
      return r.data?.response || '';
    }

    if (prov.type === 'openai') {
      const base = String(prov.baseUrl || '').replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (prov.apiKey) headers.Authorization = `Bearer ${prov.apiKey}`;
      const modelName = resolvedModel.includes('/')
        ? resolvedModel.split('/').slice(1).join('/')
        : (prov.model || resolvedModel);

      const r = await axios.post(`${base}/chat/completions`, {
        model: modelName,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        max_tokens: options.num_predict || 80,
        temperature: 0.2
      }, { headers, timeout: 60000 });
      return r.data?.choices?.[0]?.message?.content || '';
    }

    if (prov.type === 'anthropic') {
      const base = String(prov.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (prov.apiKey) headers['x-api-key'] = prov.apiKey;
      const modelName = resolvedModel.includes('/')
        ? resolvedModel.split('/').slice(1).join('/')
        : (prov.model || resolvedModel);
      const r = await axios.post(`${base}/v1/messages`, {
        model: modelName,
        max_tokens: options.num_predict || 1024,
        system: system || undefined,
        messages: [{ role: 'user', content: prompt }]
      }, { headers, timeout: 60000 });
      const blocks = r.data?.content || [];
      return blocks.map((b) => b.text || '').join('');
    }
    return '';
  }

  /**
   * Transform OpenAI SSE stream into Ollama NDJSON lines for companion.js pipe compatibility.
   */
  createOpenAiToOllamaTransform() {
    const { Transform } = require('stream');
    let buffer = '';
    return new Transform({
      transform(chunk, _enc, cb) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, '').trim();
          if (!trimmed || trimmed === '[DONE]') continue;
          try {
            const j = JSON.parse(trimmed);
            const delta = j.choices?.[0]?.delta?.content || '';
            if (delta) {
              this.push(JSON.stringify({ message: { content: delta }, done: false }) + '\n');
            }
            if (j.choices?.[0]?.finish_reason) {
              this.push(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
            }
          } catch { /* skip */ }
        }
        cb();
      },
      flush(cb) {
        this.push(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
        cb();
      }
    });
  }

  async chatStreamCompat(payload, options = {}) {
    const { model, messages } = payload;
    const { role = 'chat' } = options;
    const { providerId, model: resolvedModel } = this.resolveProvider(model, role);
    const prov = this.getProvider(providerId);

    if (prov.type === 'ollama' || providerId === 'ollama') {
      const base = prov.baseUrl || this.getOllamaBase();
      return axios.post(`${base}/api/chat`, { ...payload, model: resolvedModel }, {
        responseType: 'stream',
        timeout: options.timeout || 120000
      });
    }

    if (prov.type === 'openai') {
      const base = String(prov.baseUrl || '').replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (prov.apiKey) headers.Authorization = `Bearer ${prov.apiKey}`;
      const modelName = resolvedModel.includes('/')
        ? resolvedModel.split('/').slice(1).join('/')
        : (prov.model || resolvedModel);

      const r = await axios.post(`${base}/chat/completions`, {
        model: modelName,
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
        stream: true
      }, { responseType: 'stream', headers, timeout: options.timeout || 120000 });

      const { PassThrough } = require('stream');
      const out = new PassThrough();
      const transform = this.createOpenAiToOllamaTransform();
      r.data.pipe(transform).pipe(out);
      return { data: out };
    }

    if (prov.type === 'anthropic') {
      const base = String(prov.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (prov.apiKey) headers['x-api-key'] = prov.apiKey;
      const modelName = resolvedModel.includes('/')
        ? resolvedModel.split('/').slice(1).join('/')
        : (prov.model || resolvedModel);
      const system = (messages || []).find((m) => m.role === 'system')?.content || '';
      const userMsgs = (messages || []).filter((m) => m.role !== 'system');
      const r = await axios.post(`${base}/v1/messages`, {
        model: modelName,
        max_tokens: 4096,
        system: system || undefined,
        messages: userMsgs.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        stream: true
      }, { responseType: 'stream', headers, timeout: options.timeout || 120000 });

      const { PassThrough } = require('stream');
      const out = new PassThrough();
      let buffer = '';
      r.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, '').trim();
          if (!trimmed) continue;
          try {
            const j = JSON.parse(trimmed);
            if (j.type === 'content_block_delta' && j.delta?.text) {
              out.write(JSON.stringify({ message: { content: j.delta.text }, done: false }) + '\n');
            }
            if (j.type === 'message_stop') {
              out.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
            }
          } catch { /* skip */ }
        }
      });
      r.data.on('end', () => {
        out.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
        out.end();
      });
      return { data: out };
    }

    throw new Error(`Provider ${providerId} not available`);
  }
}

module.exports = { LlmGateway, CONFIG_PATH, DEFAULT_CONFIG };
