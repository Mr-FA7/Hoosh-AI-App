#!/usr/bin/env node
/**
 * E2E test: Chrome extension + aihoosh.com + local companion.
 * Run: node scripts/test-bridge-e2e.mjs
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function checkCompanion() {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/v3/system/health', { signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const companion = await checkCompanion();
  console.log('1) Companion direct:', companion);

  const extCandidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Hoosh', 'extension'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Hoosh Bridge', 'extension'),
    path.join(root, 'extensions', 'hoosh-local-bridge'),
  ];
  const extPath = extCandidates.find((p) => fs.existsSync(path.join(p, 'manifest.json')));
  if (!extPath) {
    console.error('Extension folder not found');
    process.exit(1);
  }
  console.log('2) Extension path:', extPath);

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Install playwright: npm install -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const profile = path.join(process.env.LOCALAPPDATA || '', 'Hoosh', 'PlaywrightBridgeTest');
  fs.rmSync(profile, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const page = await context.newPage();
  const consoleLogs = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  console.log('3) Loading https://aihoosh.com ...');
  await page.goto('https://aihoosh.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(2000);

    const ext = document.documentElement?.dataset?.hooshBridge ?? null;
    const extPage = document.documentElement?.dataset?.hooshBridgePage ?? null;
    const extCompanion = document.documentElement?.dataset?.hooshBridgeCompanion ?? null;

    let bridge = { ok: false, error: null, status: null };
    try {
      const msg = await new Promise((resolve, reject) => {
        const id = `e2e-${Date.now()}`;
        const timer = setTimeout(() => reject(new Error('bridge timeout 12s')), 12000);
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.source !== 'hoosh-local-bridge' || data.id !== id) return;
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          resolve(data);
        };
        window.addEventListener('message', onMessage);
        window.postMessage(
          {
            source: 'hoosh-web',
            id,
            type: 'hoosh-bridge-fetch',
            payload: { path: '/api/v3/system/health', method: 'GET' },
          },
          '*',
        );
      });
      bridge.ok = Boolean(msg.ok && msg.result?.status === 200);
      bridge.status = msg.result?.status ?? null;
      bridge.error = msg.error || null;
    } catch (e) {
      bridge.error = e.message || String(e);
    }

    const bodyText = document.body?.innerText || '';
    const ledGreen = bodyText.includes('Connected') || bodyText.includes('متصل');
    const ledRed = bodyText.includes('Not connected') || bodyText.includes('قطع');
    const ledOrange = bodyText.includes('start companion') || bodyText.includes('companion');

    return {
      url: location.href,
      ext,
      extPage,
      extCompanion,
      bridge,
      ledGreen,
      ledRed,
      ledOrange,
      title: document.title,
    };
  });

  console.log('4) Page result:', JSON.stringify(result, null, 2));
  if (consoleLogs.length) {
    console.log('5) Browser console (last 15):');
    consoleLogs.slice(-15).forEach((l) => console.log('  ', l));
  }

  await page.screenshot({ path: path.join(root, 'bridge-e2e-screenshot.png'), fullPage: false });
  console.log('6) Screenshot:', path.join(root, 'bridge-e2e-screenshot.png'));

  await context.close();

  const pass = result.ext === 'extension' && result.bridge.ok;
  console.log('\n=== RESULT:', pass ? 'PASS' : 'FAIL', '===');
  if (!pass) {
    if (result.ext !== 'extension') console.log('FAIL: extension not detected on page (content script not running)');
    if (!result.bridge.ok) console.log('FAIL: bridge fetch:', result.bridge.error || result.bridge.status);
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
