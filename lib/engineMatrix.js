/**
 * Local LLM engine matrix for settings UI (awesome-local-llm inspired).
 */
const ENGINES = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Default local runtime — easy model pull & chat',
    provider: 'ollama',
    defaultUrl: 'http://127.0.0.1:11434',
    roles: ['chat', 'code', 'plan', 'embed', 'nes', 'autocomplete'],
    status: 'built-in'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Local models via LM Studio — OpenAI-compatible API on port 1234',
    provider: 'lmstudio',
    defaultUrl: 'http://127.0.0.1:1234/v1',
    roles: ['chat', 'code', 'plan', 'autocomplete', 'nes'],
    status: 'supported'
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp (OpenAI-compat)',
    description: 'llama-server on /v1 — fast CPU/GPU inference',
    provider: 'llamacpp',
    defaultUrl: 'http://127.0.0.1:8080/v1',
    roles: ['chat', 'code', 'plan'],
    status: 'supported'
  },
  {
    id: 'openai',
    name: 'OpenAI-compatible',
    description: 'vLLM, OpenRouter, custom /v1 endpoints',
    provider: 'openai_compat',
    defaultUrl: 'https://api.openai.com/v1',
    roles: ['chat', 'code', 'plan', 'embed'],
    status: 'supported'
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    description: 'Claude models via API key',
    provider: 'anthropic',
    defaultUrl: 'https://api.anthropic.com',
    roles: ['chat', 'code', 'plan'],
    status: 'supported'
  },
  {
    id: 'vllm',
    name: 'vLLM',
    description: 'High-throughput OpenAI-compatible server',
    provider: 'openai_compat',
    defaultUrl: 'http://127.0.0.1:8000/v1',
    roles: ['chat', 'code'],
    status: 'external'
  },
  {
    id: 'mlx',
    name: 'MLX (Apple Silicon)',
    description: 'mlx-lm server — best on M-series Macs',
    provider: 'openai_compat',
    defaultUrl: 'http://127.0.0.1:8080/v1',
    roles: ['chat', 'code'],
    status: 'external'
  }
];

function getEngineMatrix(currentConfig = {}) {
  const providers = currentConfig.providers || {};
  return ENGINES.map((e) => ({
    ...e,
    configured: !!providers[e.provider] || e.status === 'built-in',
    activeUrl: providers[e.provider]?.baseUrl || e.defaultUrl
  }));
}

function suggestRoleRouting(engineId) {
  const e = ENGINES.find((x) => x.id === engineId);
  if (!e) return null;
  const routing = {};
  for (const role of e.roles) routing[role] = { provider: e.provider };
  return routing;
}

module.exports = { ENGINES, getEngineMatrix, suggestRoleRouting };
