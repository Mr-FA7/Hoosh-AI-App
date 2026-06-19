/**
 * Parse published container ports into localhost preview URLs.
 */

function parsePortMappings(portsText) {
  const urls = [];
  const ports = new Set();
  const src = String(portsText || '');
  if (!src) return { urls: [], ports: [] };

  for (const chunk of src.split(',')) {
    const part = chunk.trim();
    if (!part) continue;

    const arrow = part.match(/(?:[\d.]+:)?(\d+)->(\d+)\/tcp/i);
    if (arrow) {
      const host = Number(arrow[1]);
      if (host > 0 && host < 65536) {
        ports.add(host);
        urls.push(`http://127.0.0.1:${host}`);
      }
      continue;
    }

    const hostOnly = part.match(/^(?:0\.0\.0\.0:|127\.0\.0\.1:)?(\d+)(?:\/tcp)?$/i);
    if (hostOnly) {
      const host = Number(hostOnly[1]);
      if (host > 0 && host < 65536) {
        ports.add(host);
        urls.push(`http://127.0.0.1:${host}`);
      }
    }
  }

  return { urls: [...new Set(urls)], ports: [...ports] };
}

function collectPreviewUrlsFromServices(services = [], profile = null) {
  const urls = new Set();
  const ports = new Set();

  for (const row of services) {
    const parsed = parsePortMappings(row.ports);
    parsed.urls.forEach((u) => urls.add(u));
    parsed.ports.forEach((p) => ports.add(p));
  }

  if (profile?.preview?.port) {
    const p = Number(profile.preview.port);
    if (p > 0 && p < 65536) {
      ports.add(p);
      const path = profile.preview.path && profile.preview.path !== '/' ? profile.preview.path : '';
      urls.add(`http://127.0.0.1:${p}${path}`);
    }
  }

  for (const p of profile?.ports || []) {
    if (p > 0 && p < 65536) {
      ports.add(p);
      urls.add(`http://127.0.0.1:${p}`);
    }
  }

  return { urls: [...urls], ports: [...ports] };
}

module.exports = {
  parsePortMappings,
  collectPreviewUrlsFromServices
};
