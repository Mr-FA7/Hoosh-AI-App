/**
 * secretStore — at-rest encryption for sensitive config values (API keys).
 *
 * Zero external dependencies. Uses AES-256-GCM with a machine-local 256-bit
 * key stored at ~/.aivon-os/.keystore (chmod 0600). If Electron's safeStorage
 * is available (when this module is loaded inside the Electron main process),
 * the key file is additionally wrapped with the OS keychain; otherwise the
 * 0600 key file is the protection boundary.
 *
 * This is a real improvement over plaintext: it protects against the common
 * leaks (config copied into a repo/backup, read by another user/app) without
 * requiring a native keychain dependency in the plain-Node companion process.
 *
 * Format of an encrypted value: "enc:v1:<ivB64>:<tagB64>:<cipherB64>"
 * Backward compatible: decrypt() returns plaintext unchanged if not encrypted.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const KEY_DIR = path.join(os.homedir(), '.aivon-os');
const KEY_PATH = path.join(KEY_DIR, '.keystore');
const PREFIX = 'enc:v1:';

let cachedKey = null;

function loadOrCreateKey() {
  if (cachedKey) return cachedKey;
  try {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  } catch { /* ignore */ }

  // Try Electron safeStorage wrap if present (best case, inside Electron).
  let safeStorage = null;
  try { safeStorage = require('electron').safeStorage; } catch { /* plain node */ }

  try {
    if (fs.existsSync(KEY_PATH)) {
      const raw = fs.readFileSync(KEY_PATH);
      if (safeStorage && safeStorage.isEncryptionAvailable() && raw.slice(0, 4).toString() === 'SAFE') {
        cachedKey = safeStorage.decryptString(raw.slice(4));
        cachedKey = Buffer.from(cachedKey, 'base64');
      } else {
        cachedKey = raw.length >= 32 ? raw.slice(0, 32) : null;
      }
      if (cachedKey && cachedKey.length === 32) return cachedKey;
    }
  } catch { /* regenerate below */ }

  cachedKey = crypto.randomBytes(32);
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const wrapped = Buffer.concat([
        Buffer.from('SAFE'),
        safeStorage.encryptString(cachedKey.toString('base64'))
      ]);
      fs.writeFileSync(KEY_PATH, wrapped, { mode: 0o600 });
    } else {
      fs.writeFileSync(KEY_PATH, cachedKey, { mode: 0o600 });
    }
    try { fs.chmodSync(KEY_PATH, 0o600); } catch { /* best effort */ }
  } catch { /* in-memory only fallback */ }
  return cachedKey;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  const str = String(plain);
  if (isEncrypted(str)) return str; // already encrypted
  try {
    const key = loadOrCreateKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
  } catch {
    return str; // never lose the value; fall back to plaintext
  }
}

function decryptSecret(value) {
  if (!isEncrypted(value)) return value; // plaintext / empty — return as-is
  try {
    const key = loadOrCreateKey();
    const [ivB64, tagB64, cipherB64] = value.slice(PREFIX.length).split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(cipherB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return ''; // cannot decrypt (wrong/rotated key) — treat as unset, never crash
  }
}

module.exports = { encryptSecret, decryptSecret, isEncrypted };
