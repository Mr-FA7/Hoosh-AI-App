#!/usr/bin/env node
/**
 * FA7 — تولید SVG آیکن ساده و اصیل برای پروژه (بدون وابستگی به کتابخانهٔ آیکن شخص ثالث).
 * خروجی: یک فایل SVG با viewBox ثابت؛ برای .ico / .icns بعداً با ابزار تبدیل رستری استفاده کنید.
 */
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const o = { out: 'assets/app-icon.svg', initial: '?', theme: 'slate' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      o.out = argv[++i];
    } else if (a === '--initial' && argv[i + 1]) {
      o.initial = String(argv[++i]).slice(0, 2);
    } else if (a === '--theme' && argv[i + 1]) {
      o.theme = argv[++i];
    }
  }
  return o;
}

const themes = {
  slate: { a: '#1e293b', b: '#334155', fg: '#f8fafc' },
  blue: { a: '#1d4ed8', b: '#2563eb', fg: '#ffffff' },
  green: { a: '#047857', b: '#059669', fg: '#ecfdf5' },
  violet: { a: '#5b21b6', b: '#7c3aed', fg: '#faf5ff' },
};

function buildSvg({ initial, theme }) {
  const t = themes[theme] || themes.slate;
  const letter = initial.trim() || '?';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Application icon">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${t.a}"/>
      <stop offset="100%" style="stop-color:${t.b}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <text x="256" y="310" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="220" font-weight="700" fill="${t.fg}">${escapeXml(letter)}</text>
</svg>
`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const opts = parseArgs(process.argv);
const svg = buildSvg(opts);
const outPath = path.resolve(process.cwd(), opts.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, svg, 'utf8');
console.log(`OK: wrote ${outPath}`);
console.log('Next: برای Windows .ico / macOS .icns از خروجی PNG چند سایز بسازید (مثلاً 16–1024) و با ابزار بسته‌بندی پروژه ادغام کنید.');
