/**
 * hoosh.dev.yaml — lightweight dev stack profile (inspired by devcontainer concept, original schema).
 */
const fs = require('fs-extra');
const path = require('path');

const PROFILE_NAMES = ['hoosh.dev.yaml', 'hoosh.dev.yml', 'hoosh.dev.json'];

function parseSimpleYaml(text) {
  const out = {};
  let rootKey = null;
  let inList = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const rootMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (rootMatch && !line.startsWith(' ')) {
      rootKey = rootMatch[1];
      const val = rootMatch[2].trim();
      inList = val === '';
      if (inList) {
        out[rootKey] = [];
        continue;
      }
      if (val === 'true') out[rootKey] = true;
      else if (val === 'false') out[rootKey] = false;
      else if (/^\d+$/.test(val)) out[rootKey] = Number(val);
      else out[rootKey] = val.replace(/^["']|["']$/g, '');
      inList = false;
      continue;
    }

    const listItem = trimmed.match(/^-\s+(.+)$/);
    if (listItem && rootKey && Array.isArray(out[rootKey])) {
      out[rootKey].push(listItem[1].replace(/^["']|["']$/g, ''));
      continue;
    }

    const nested = line.match(/^  ([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (nested && rootKey) {
      if (!out[rootKey] || typeof out[rootKey] !== 'object' || Array.isArray(out[rootKey])) {
        out[rootKey] = {};
      }
      const v = nested[2].trim();
      out[rootKey][nested[1]] = /^\d+$/.test(v) ? Number(v) : v.replace(/^["']|["']$/g, '');
      inList = false;
    }
  }
  return out;
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    name: String(raw.name || raw.stack || 'project').trim(),
    compose: String(raw.compose || raw.composeFile || '').trim() || null,
    autoUp: !!raw.autoUp || !!raw.autostart,
    waitHealthy: raw.waitHealthy !== false,
    preview: {
      port: Number(raw.preview?.port || raw.port || 0) || null,
      path: String(raw.preview?.path || raw.path || '/')
    },
    ports: Array.isArray(raw.ports)
      ? raw.ports.map((p) => Number(p)).filter((p) => p > 0 && p < 65536)
      : [],
    services: Array.isArray(raw.services) ? raw.services.map(String) : [],
    sandbox: {
      image: String(raw.sandbox?.image || raw.image || '').trim() || null,
      memory: String(raw.sandbox?.memory || raw.memory || '').trim() || null,
      cpus: String(raw.sandbox?.cpus || raw.cpus || '').trim() || null
    }
  };
}

async function readDevProfile(projectRoot) {
  const root = path.resolve(projectRoot);
  for (const name of PROFILE_NAMES) {
    const abs = path.join(root, name);
    if (!(await fs.pathExists(abs))) continue;
    try {
      if (name.endsWith('.json')) {
        return { file: name, profile: normalizeProfile(await fs.readJson(abs)) };
      }
      const text = await fs.readFile(abs, 'utf8');
      return { file: name, profile: normalizeProfile(parseSimpleYaml(text)) };
    } catch {
      return { file: name, profile: null, error: 'Failed to parse profile' };
    }
  }
  return { file: null, profile: null };
}

const EXAMPLE_COMPOSE = `services:
  app:
    image: node:20-bookworm-slim
    working_dir: /workspace
    volumes:
      - .:/workspace
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run dev"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hoosh
      POSTGRES_PASSWORD: hoosh
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hoosh -d app"]
      interval: 5s
      timeout: 5s
      retries: 5
`;

const EXAMPLE_PROFILE = `name: my-project
compose: compose.yaml
autoUp: false
waitHealthy: true
preview:
  port: 3000
  path: /
ports:
  - 3000
  - 5432
services:
  - app
  - db
sandbox:
  image: node:20-bookworm-slim
  memory: 2g
  cpus: "2"
`;

async function initStackExample(projectRoot, { force = false } = {}) {
  const root = path.resolve(projectRoot);
  const composePath = path.join(root, 'compose.yaml');
  const profilePath = path.join(root, 'hoosh.dev.yaml');
  const created = [];
  const skipped = [];

  if (!(await fs.pathExists(composePath))) {
    await fs.writeFile(composePath, EXAMPLE_COMPOSE, 'utf8');
    created.push('compose.yaml');
  } else if (!force) {
    skipped.push('compose.yaml');
  }

  if (!(await fs.pathExists(profilePath))) {
    await fs.writeFile(profilePath, EXAMPLE_PROFILE, 'utf8');
    created.push('hoosh.dev.yaml');
  } else if (!force) {
    skipped.push('hoosh.dev.yaml');
  }

  return { ok: true, created, skipped };
}

module.exports = {
  PROFILE_NAMES,
  readDevProfile,
  normalizeProfile,
  initStackExample,
  EXAMPLE_COMPOSE,
  EXAMPLE_PROFILE
};
