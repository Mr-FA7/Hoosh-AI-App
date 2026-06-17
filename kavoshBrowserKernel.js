function normalizeBlockPattern(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  const withoutScheme = s.replace(/^https?:\/\//, '');
  const hostPort = withoutScheme.split('/')[0] || '';
  const host = hostPort.split('@').pop().split(':')[0] || '';
  return host.trim().replace(/\.+$/, '');
}

function isValidBlockPattern(s) {
  return !!s && /^[a-z0-9.*-]+$/i.test(s);
}

function hostMatchesBlockPattern(host, pattern) {
  const h = normalizeBlockPattern(host);
  const p = normalizeBlockPattern(pattern);
  if (!h || !p) return false;
  if (p === '*') return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(2);
    return h === suffix || h.endsWith(`.${suffix}`);
  }
  return h === p;
}

function toSearchUrl(query) {
  return `https://www.google.com/search?gbv=1&q=${encodeURIComponent(query)}`;
}

function looksLikeHostOrUrl(input) {
  const s = String(input || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^localhost(?::\d+)?(\/|$)/i.test(s)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(s)) return true;
  return /[a-z0-9-]+\.[a-z]{2,}/i.test(s);
}

function resolveInputToUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'URL is empty.' };

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return { ok: true, url: u.toString(), mode: 'direct' };
    } catch {
      return { ok: false, error: 'Invalid URL.' };
    }
  }

  if (looksLikeHostOrUrl(raw)) {
    const candidate = `https://${raw}`;
    try {
      const u = new URL(candidate);
      return { ok: true, url: u.toString(), mode: 'host' };
    } catch {
      return { ok: false, error: 'Invalid host/URL.' };
    }
  }

  return { ok: true, url: toSearchUrl(raw), mode: 'search' };
}

class KavoshBrowserKernel {
  constructor(options = {}) {
    this.blockedDomains = Array.isArray(options.blockedDomains) ? options.blockedDomains : [];
    this.blockTrackers = options.blockTrackers !== false;
  }

  setBlockedDomains(domains) {
    this.blockedDomains = Array.isArray(domains) ? domains : [];
  }

  evaluateNavigation(urlOrInput) {
    const resolved = resolveInputToUrl(urlOrInput);
    if (!resolved.ok) return resolved;
    const u = new URL(resolved.url);
    const host = normalizeBlockPattern(u.hostname);
    for (const pattern of this.blockedDomains) {
      if (!isValidBlockPattern(pattern)) continue;
      if (hostMatchesBlockPattern(host, pattern)) {
        return { ok: false, blocked: true, error: `Blocked by policy: ${pattern}`, url: resolved.url };
      }
    }
    return { ok: true, url: resolved.url, mode: resolved.mode };
  }
}

module.exports = {
  KavoshBrowserKernel,
  resolveInputToUrl,
  normalizeBlockPattern,
  hostMatchesBlockPattern,
  isValidBlockPattern
};
