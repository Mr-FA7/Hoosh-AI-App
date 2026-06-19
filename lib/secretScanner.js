/**
 * secretScanner — detect & redact high-confidence secrets before sending data
 * to third-party network services (e.g. web search, external doc fetch).
 *
 * Deliberately conservative: only patterns that are very likely real secrets,
 * to avoid false positives. NOTE: this is intended for external/non-model
 * network sends. It is intentionally NOT applied to LLM prompt payloads, since
 * those legitimately carry the user's own code (which may contain key-like
 * strings the user wants sent to their own configured model). Redacting model
 * payloads would corrupt the agent's input.
 */

const PATTERNS = [
  { name: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'openai_proj_key', re: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'private_key_block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9._-]{24,}\b/g }
];

/** Returns array of { name } for any secret-like matches found. */
function scanForSecrets(text) {
  if (!text || typeof text !== 'string') return [];
  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) hits.push({ name: p.name });
  }
  return hits;
}

/** Replaces any secret-like substrings with [REDACTED]. */
function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.re, '[REDACTED]');
  }
  return out;
}

module.exports = { scanForSecrets, redactSecrets };
