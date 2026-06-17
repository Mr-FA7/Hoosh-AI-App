/**
 * Safety policy: dangerous patterns and confirmation requirements.
 * Production systems extend with AST parsing, allowlists, and org policies.
 */

const DANGEROUS = [
  { id: 'rm.root', re: /\brm\s+(-[rfRF]*\s*)*\/\s*$/i, level: 'block' },
  { id: 'rm.rf.root', re: /\brm\s+(-[rfRF]+\s+)?\/\s*$/i, level: 'block' },
  { id: 'dd.disk', re: /\bdd\s+.*\bof=\/dev\/(disk|rdisk)/i, level: 'confirm' },
  { id: 'mkfs', re: /\bmkfs\.?\b/i, level: 'confirm' },
  { id: 'diskpart', re: /\bdiskpart\b/i, level: 'confirm' },
  { id: 'format', re: /\bformat\s+[c-z]:/i, level: 'confirm' },
  { id: 'shutdown', re: /\b(shutdown|reboot|halt|poweroff)\b/i, level: 'confirm' },
  { id: 'chmod.777.recursive', re: /\bchmod\s+-R\s+777\b/i, level: 'confirm' },
  { id: 'curl.pipe.sh', re: /\bcurl\s+[^|]*\|\s*(ba)?sh\b/i, level: 'confirm' },
  { id: 'wget.pipe.sh', re: /\bwget\s+[^|]*\|\s*(ba)?sh\b/i, level: 'confirm' }
];

/**
 * @param {string} command
 * @returns {{ safe: boolean, action: 'allow'|'confirm'|'block', rules: string[] }}
 */
export function evaluateCommand(command) {
  const rules = [];
  let worst = 'allow';

  for (const d of DANGEROUS) {
    if (d.re.test(command)) {
      rules.push(d.id);
      if (d.level === 'block') worst = 'block';
      else if (d.level === 'confirm' && worst !== 'block') worst = 'confirm';
    }
  }

  return {
    safe: worst === 'allow',
    action: worst,
    rules
  };
}

export function isSandboxMode(env = process.env) {
  return env.UAT_SANDBOX === '1' || env.UAT_SANDBOX === 'true';
}
