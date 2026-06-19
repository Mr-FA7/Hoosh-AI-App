#!/usr/bin/env node
/** Simulates user opening aihoosh.com in Chrome WITHOUT extension — should FAIL (red). */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  const { chromium } = await import('playwright');
  const profile = path.join(process.env.LOCALAPPDATA || '', 'Hoosh', 'PlaywrightUserLike');
  fs.rmSync(profile, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [], // NO extension — like normal Chrome
  });
  const page = await context.newPage();
  await page.goto('https://aihoosh.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const result = await page.evaluate(() => ({
    ext: document.documentElement?.dataset?.hooshBridge ?? null,
    red: (document.body?.innerText || '').includes('Not connected') || (document.body?.innerText || '').includes('قطع'),
    green: (document.body?.innerText || '').includes('Connected') || (document.body?.innerText || '').includes('متصل'),
  }));

  console.log('User-like (no extension):', result);
  await context.close();

  const expectFail = result.ext !== 'extension' && !result.green;
  console.log(expectFail ? 'OK: normal Chrome stays RED (expected)' : 'UNEXPECTED: should be red without extension');
  process.exit(expectFail ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
