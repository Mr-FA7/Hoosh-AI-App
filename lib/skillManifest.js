/**
 * skillManifest — validation + normalization for Skill manifests (skill.json).
 *
 * Part of S1 (Skill core). Pure & dependency-free so it is unit-testable.
 * Implements the schema proposed in docs/hoosh-audit.md §12.1.
 *
 * Deny-by-default: a manifest with no `permissions` block gets NOTHING.
 */

const CATEGORIES = [
  'coding', 'cloud-devops', 'ai', 'research', 'business',
  'marketing', 'design', 'security', 'legal-assist', 'personal'
];

const MEMORY_SCOPES = ['project', 'user', 'task'];
const PRICING_MODELS = ['free', 'one-time', 'subscription'];
const FS_SCOPES = ['none', 'workspace-only']; // 'path:<glob>' also allowed (prefix check)

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i; // e.g. fa7.python-expert

/** Canonical, deny-by-default permission block. */
function normalizePermissions(p = {}) {
  const perms = p && typeof p === 'object' ? p : {};
  const fs = perms.filesystem;
  let filesystem = 'none';
  if (fs === 'workspace-only' || (typeof fs === 'string' && fs.startsWith('path:'))) filesystem = fs;
  const shell = perms.shell && Array.isArray(perms.shell.allowlist)
    ? { allowlist: perms.shell.allowlist.map(String).filter(Boolean) }
    : { allowlist: [] };
  const network = Array.isArray(perms.network) ? perms.network.map(String).filter(Boolean) : [];
  const mcp = Array.isArray(perms.mcp) ? perms.mcp.map(String).filter(Boolean) : [];
  const secrets = Array.isArray(perms.secrets) ? perms.secrets.map(String).filter(Boolean) : [];
  return { filesystem, shell, network, mcp, secrets };
}

/** Returns a one-line, human-readable summary of requested capabilities. */
function summarizePermissions(perms) {
  const p = normalizePermissions(perms);
  const parts = [];
  parts.push(`filesystem: ${p.filesystem}`);
  parts.push(`shell: ${p.shell.allowlist.length ? p.shell.allowlist.join(', ') : 'none'}`);
  parts.push(`network: ${p.network.length ? p.network.join(', ') : 'none'}`);
  parts.push(`mcp: ${p.mcp.length ? p.mcp.join(', ') : 'none'}`);
  parts.push(`secrets: ${p.secrets.length ? p.secrets.join(', ') : 'none'}`);
  return parts.join(' · ');
}

/** Is the manifest "elevated" (needs security review before third-party publish)? */
function isElevated(perms) {
  const p = normalizePermissions(perms);
  if (p.filesystem !== 'none' && p.filesystem !== 'workspace-only') return true; // arbitrary path
  if (p.secrets.length) return true;
  // broad network (wildcard host) or broad shell are elevated
  if (p.network.some((h) => h === '*' || h.includes('*'))) return true;
  return false;
}

/**
 * Validate + normalize a manifest object.
 * @returns { ok, errors: string[], warnings: string[], manifest }
 */
function validateManifest(obj) {
  const errors = [];
  const warnings = [];
  const m = obj && typeof obj === 'object' ? obj : {};

  if (m.manifestVersion !== 1) errors.push('manifestVersion must be 1');
  if (!m.id || !ID_RE.test(String(m.id))) errors.push('id must be a namespaced slug (e.g. fa7.python-expert)');
  if (!m.name || !String(m.name).trim()) errors.push('name is required');
  if (!m.version || !SEMVER_RE.test(String(m.version))) errors.push('version must be semver (e.g. 1.0.0)');
  if (m.category && !CATEGORIES.includes(m.category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  if (m.memoryScope && !MEMORY_SCOPES.includes(m.memoryScope)) errors.push(`memoryScope must be one of: ${MEMORY_SCOPES.join(', ')}`);
  if (m.pricing && m.pricing.model && !PRICING_MODELS.includes(m.pricing.model)) {
    errors.push(`pricing.model must be one of: ${PRICING_MODELS.join(', ')}`);
  }

  const permissions = normalizePermissions(m.permissions);

  // knowledge-base hosts must be covered by the declared network allowlist
  const kb = Array.isArray(m.knowledgeBase) ? m.knowledgeBase : [];
  for (const k of kb) {
    const src = String(k?.source || '');
    const httpMatch = src.match(/^https?:\/\/([^/]+)/i);
    if (httpMatch) {
      const host = httpMatch[1].toLowerCase();
      const allowed = permissions.network.some((h) => host === h.toLowerCase() || host.endsWith('.' + h.toLowerCase()));
      if (!allowed) {
        errors.push(`knowledgeBase host "${host}" is not in permissions.network`);
      }
    }
  }

  if (!Array.isArray(m.eval?.tests) && !m.eval?.tests) {
    warnings.push('no eval.tests — Skill cannot be marked "verified"');
  }

  const manifest = {
    manifestVersion: 1,
    id: String(m.id || ''),
    name: String(m.name || ''),
    version: String(m.version || ''),
    author: m.author && typeof m.author === 'object' ? { name: String(m.author.name || ''), verified: !!m.author.verified } : { name: '', verified: false },
    category: m.category || 'personal',
    summary: String(m.summary || ''),
    description: String(m.description || ''),
    systemPrompt: m.systemPrompt || null,
    capability: m.capability || null,
    examples: m.examples || null,
    recommendedModels: Array.isArray(m.recommendedModels) ? m.recommendedModels : [],
    knowledgeBase: kb,
    mcpTools: Array.isArray(m.mcpTools) ? m.mcpTools : [],
    subAgents: Array.isArray(m.subAgents) ? m.subAgents : [],
    workflows: m.workflows || null,
    memoryScope: m.memoryScope || 'project',
    eval: m.eval && typeof m.eval === 'object' ? m.eval : null,
    permissions,
    pricing: m.pricing && typeof m.pricing === 'object' ? m.pricing : { model: 'free' },
    elevated: isElevated(m.permissions)
  };

  return { ok: errors.length === 0, errors, warnings, manifest };
}

module.exports = {
  CATEGORIES, MEMORY_SCOPES, PRICING_MODELS, FS_SCOPES,
  validateManifest, normalizePermissions, summarizePermissions, isElevated
};
