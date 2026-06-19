/**
 * Tier routing OPUS/SONNET/HAIKU → local/cloud models (free-claude-code-inspired).
 */
const TIERS = {
  opus: { role: 'plan', label: 'OPUS — reasoning/architect' },
  sonnet: { role: 'code', label: 'SONNET — coding/agent' },
  haiku: { role: 'autocomplete', label: 'HAIKU — fast/light' }
};

function resolveTier(tier, gatewayConfig) {
  const key = String(tier || 'sonnet').toLowerCase();
  const t = TIERS[key] || TIERS.sonnet;
  const roleCfg = gatewayConfig?.roles?.[t.role] || gatewayConfig?.roles?.chat;
  return {
    tier: key,
    role: t.role,
    provider: roleCfg?.provider || 'ollama',
    model: roleCfg?.model || 'mistral',
    label: t.label
  };
}

function mapTaskToTier(taskType) {
  const t = String(taskType || '').toLowerCase();
  if (['plan', 'architect', 'reasoning', 'design'].some((k) => t.includes(k))) return 'opus';
  if (['autocomplete', 'complete', 'nes', 'fast'].some((k) => t.includes(k))) return 'haiku';
  return 'sonnet';
}

module.exports = { TIERS, resolveTier, mapTaskToTier };
