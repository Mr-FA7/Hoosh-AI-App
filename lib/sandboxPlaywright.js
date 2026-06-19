/**
 * Playwright sandbox runner (OpenHands-inspired, Docker Playwright image).
 */
const { SandboxRunner } = require('./sandboxRunner');

const DEFAULT_PW_IMAGE = 'mcr.microsoft.com/playwright:v1.49.0-jammy';

async function runPlaywrightInSandbox(projectRoot, options = {}) {
  const url = String(options.url || 'about:blank');
  const script = String(options.script || 'document.title');
  const pwImage = options.playwrightImage || DEFAULT_PW_IMAGE;

  const nodeScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const result = await page.evaluate((s) => {
    return new Function('return (' + s + ')')();
  }, ${JSON.stringify(script)});
  await browser.close();
  console.log(JSON.stringify({ ok: true, result }));
})().catch((e) => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
`;

  const sandbox = new SandboxRunner(projectRoot, {
    enabled: options.sandbox !== false,
    playwrightImage: pwImage
  });

  if (sandbox.isEnabled()) {
    const boxed = await sandbox.run(`node -e ${JSON.stringify(nodeScript)}`, options.timeoutMs || 120000, pwImage);
    if (boxed) {
      let parsed = null;
      try {
        const line = String(boxed.stdout || '').trim().split('\n').pop();
        parsed = line ? JSON.parse(line) : null;
      } catch { /* ignore */ }
      return {
        ok: boxed.ok && parsed?.ok !== false,
        stdout: boxed.stdout,
        stderr: boxed.stderr,
        result: parsed?.result,
        sandbox: true,
        image: pwImage
      };
    }
  }

  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const child = spawn('node', ['-e', nodeScript], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      let parsed = null;
      try {
        const line = stdout.trim().split('\n').pop();
        parsed = line ? JSON.parse(line) : null;
      } catch { /* ignore */ }
      resolve({
        ok: code === 0 && parsed?.ok !== false,
        stdout,
        stderr,
        result: parsed?.result,
        sandbox: false
      });
    });
    child.on('error', (err) => resolve({ ok: false, stderr: err.message, sandbox: false }));
  });
}

async function captureBrowserPage(projectRoot, options = {}) {
  const url = String(options.url || 'about:blank');
  const pwImage = options.playwrightImage || DEFAULT_PW_IMAGE;
  const nodeScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 35000 });
  const title = await page.title();
  const href = page.url();
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 8000) || '');
  const selector = await page.evaluate(() => {
    const el = document.querySelector('main, [role=main], #root, #app, body');
    if (!el) return 'body';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + String(el.className).trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    return (tag + id + cls).slice(0, 120) || 'body';
  });
  const screenshot = await page.screenshot({ type: 'png', fullPage: false }).then((b) => b.toString('base64'));
  await browser.close();
  console.log(JSON.stringify({ ok: true, title, url: href, text, selector, screenshot }));
})().catch((e) => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
`;
  const sandbox = new SandboxRunner(projectRoot, {
    enabled: options.sandbox !== false,
    playwrightImage: pwImage
  });
  const runLocal = () =>
    new Promise((resolve) => {
      const { spawn } = require('child_process');
      const child = spawn('node', ['-e', nodeScript], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        try {
          const line = stdout.trim().split('\n').pop();
          const parsed = line ? JSON.parse(line) : null;
          resolve({ ok: code === 0 && parsed?.ok, ...parsed, stderr, sandbox: false });
        } catch {
          resolve({ ok: false, error: stderr || 'capture parse failed', sandbox: false });
        }
      });
      child.on('error', (err) => resolve({ ok: false, error: err.message, sandbox: false }));
    });

  if (sandbox.isEnabled()) {
    const boxed = await sandbox.run(`node -e ${JSON.stringify(nodeScript)}`, options.timeoutMs || 120000, pwImage);
    if (boxed) {
      try {
        const line = String(boxed.stdout || '').trim().split('\n').pop();
        const parsed = line ? JSON.parse(line) : null;
        return { ok: boxed.ok && parsed?.ok !== false, ...parsed, stderr: boxed.stderr, sandbox: true };
      } catch {
        return { ok: false, error: boxed.stderr || 'capture failed', sandbox: true };
      }
    }
  }
  return runLocal();
}

module.exports = { runPlaywrightInSandbox, captureBrowserPage, DEFAULT_PW_IMAGE };
