/**
 * Integration credentials for workflows (HTTP nodes) — encrypted at rest.
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { encryptSecret, decryptSecret } = require('./secretStore');

const STORE_PATH = path.join(os.homedir(), '.aivon-os', 'integration-credentials.json');

async function loadStore() {
  try {
    if (await fs.pathExists(STORE_PATH)) return await fs.readJson(STORE_PATH);
  } catch { /* ignore */ }
  return { credentials: [] };
}

async function saveStore(data) {
  await fs.ensureDir(path.dirname(STORE_PATH));
  await fs.writeJson(STORE_PATH, data, { spaces: 2 });
}

async function listCredentials() {
  const data = await loadStore();
  return (data.credentials || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    createdAt: c.createdAt
  }));
}

async function saveCredential({ id, name, type, data }) {
  const store = await loadStore();
  const entry = {
    id: id || randomUUID(),
    name: String(name || 'credential'),
    type: String(type || 'generic'),
    data: encryptSecret(JSON.stringify(data || {})),
    createdAt: new Date().toISOString()
  };
  const idx = store.credentials.findIndex((c) => c.id === entry.id);
  if (idx >= 0) store.credentials[idx] = { ...store.credentials[idx], ...entry };
  else store.credentials.push(entry);
  await saveStore(store);
  return { id: entry.id, name: entry.name, type: entry.type };
}

async function getCredential(id) {
  const store = await loadStore();
  const row = store.credentials.find((c) => c.id === id || c.name === id);
  if (!row) return null;
  try {
    return { ...row, data: JSON.parse(decryptSecret(row.data)) };
  } catch {
    return null;
  }
}

async function deleteCredential(id) {
  const store = await loadStore();
  store.credentials = store.credentials.filter((c) => c.id !== id && c.name !== id);
  await saveStore(store);
  return { ok: true };
}

function applyCredentialToHeaders(credential, headers = {}) {
  if (!credential?.data) return headers;
  const d = credential.data;
  const out = { ...headers };
  if (d.type === 'bearer' && d.token) out.Authorization = `Bearer ${d.token}`;
  if (d.type === 'basic' && d.username) {
    const b = Buffer.from(`${d.username}:${d.password || ''}`).toString('base64');
    out.Authorization = `Basic ${b}`;
  }
  if (d.type === 'apiKey' && d.header && d.value) out[d.header] = d.value;
  return out;
}

module.exports = {
  listCredentials,
  saveCredential,
  getCredential,
  deleteCredential,
  applyCredentialToHeaders
};
