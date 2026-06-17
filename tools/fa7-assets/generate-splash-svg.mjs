#!/usr/bin/env node
/**
 * FA7 — پس‌زمینهٔ اسپلش/لانچ به صورت SVG (گرادیان + عنوان). برای اپ یا نصب‌کننده.
 */
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const o = { out: 'assets/splash.svg', title: 'Application', theme: 'dark' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) o.out = argv[++i];
    else if (a === '--title' && argv[i + 1]) o.title = argv[++i];
    else if (a === '--theme' && argv[i + 1]) o.theme = argv[++i];
  }
  return o;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const palettes = {
  dark: { a: '#0f172a', b: '#1e293b', fg: '#e2e8f0', sub: '#94a3b8' },
  light: { a: '#f8fafc', b: '#e2e8f0', fg: '#0f172a', sub: '#475569' },
};

function buildSplash({ title, theme }) {
  const p = palettes[theme] || palettes.dark;
  const t = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <linearGradient id="s" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.a}"/>
      <stop offset="100%" style="stop-color:${p.b}"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#s)"/>
  <text x="960" y="520" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="600" fill="${p.fg}">${t}</text>
  <text x="960" y="600" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="${p.sub}">FA7 asset (replace title in build)</text>
</svg>
`;
}

const opts = parseArgs(process.argv);
const outPath = path.resolve(process.cwd(), opts.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buildSplash(opts), 'utf8');
console.log(`OK: wrote ${outPath}`);
