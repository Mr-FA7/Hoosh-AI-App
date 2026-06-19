#!/usr/bin/env node
/** Print Chrome extension ID from manifest.json "key" field (base64 SPKI). */
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extensions', 'hoosh-local-bridge', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.key) {
  console.error('manifest.json has no "key" field');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest();
let id = '';
for (let i = 0; i < 16; i++) {
  id += String.fromCharCode(97 + (hash[i] >> 4));
  id += String.fromCharCode(97 + (hash[i] & 0xf));
}
console.log(id);
