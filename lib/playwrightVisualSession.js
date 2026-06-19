const { spawn } = require('child_process');
const { SandboxRunner } = require('./sandboxRunner');

const VIEWPORT = { width: 1280, height: 720 };

function buildSessionScript(url, stepsJson) {
  return `
const { chromium } = require('playwright');
(async () => {
  const viewport = ${JSON.stringify(VIEWPORT)};
  const steps = ${stepsJson};
  const events = [];
  const push = (ev) => events.push({ ...ev, viewport, ts: Date.now() });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(${JSON.stringify(String(url || 'about:blank'))}, { waitUntil: 'domcontentloaded', timeout: 35000 });

  async function shot(label) {
    const image = (await page.screenshot({ type: 'png', fullPage: false })).toString('base64');
    push({ type: 'screenshot', image, label });
  }

  async function moveClick(selector) {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error('Element not found: ' + selector);
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    push({ type: 'move', x, y, selector, space: 'viewport' });
    await page.mouse.move(x, y, { steps: 14 });
    push({ type: 'click', x, y, selector, space: 'viewport' });
    await page.mouse.click(x, y);
  }

  async function typeInto(selector, text) {
    const box = await page.locator(selector).first().boundingBox();
    if (box) {
      const x = Math.round(box.x + Math.min(box.width * 0.2, 24));
      const y = Math.round(box.y + box.height / 2);
      push({ type: 'move', x, y, selector, space: 'viewport' });
      await page.mouse.move(x, y, { steps: 10 });
      push({ type: 'click', x, y, selector, space: 'viewport' });
      await page.mouse.click(x, y);
    }
    push({ type: 'type', text: String(text || ''), selector, space: 'viewport' });
    await page.fill(selector, String(text || ''));
  }

  await shot('initial');

  for (const step of steps) {
    const action = String(step.action || '').toLowerCase();
    if (action === 'navigate' && step.url) {
      push({ type: 'status', message: 'Navigate ' + step.url, space: 'viewport' });
      await page.goto(String(step.url), { waitUntil: 'domcontentloaded', timeout: 35000 });
      await shot('navigate');
      continue;
    }
    if (action === 'click' && step.selector) {
      await moveClick(String(step.selector));
      await shot('click');
      continue;
    }
    if (action === 'type' && step.selector) {
      await typeInto(String(step.selector), step.text || '');
      await shot('type');
      continue;
    }
    if (action === 'wait') {
      const ms = Math.max(0, Number(step.ms || 500));
      push({ type: 'status', message: 'Wait ' + ms + 'ms', space: 'viewport' });
      await page.waitForTimeout(ms);
      continue;
    }
    if (action === 'script' && step.script) {
      push({ type: 'status', message: 'Run script', space: 'viewport' });
      await page.evaluate((s) => new Function('return (' + s + ')')(), String(step.script));
      await shot('script');
      continue;
    }
  }

  const observe = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    text: document.body?.innerText?.slice(0, 4000) || ''
  }));
  await shot('final');
  await browser.close();
  console.log(JSON.stringify({ ok: true, observe, events }));
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
`;
}

async function runPlaywrightVisualSession(projectRoot, options = {}) {
  const url = String(options.url || 'about:blank');
  const steps = Array.isArray(options.steps) ? options.steps : [];
  const pwImage = options.playwrightImage;
  const nodeScript = buildSessionScript(url, JSON.stringify(steps));

  const sandbox = new SandboxRunner(projectRoot, {
    enabled: options.sandbox !== false,
    playwrightImage: pwImage
  });

  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
  const emitEvents = (events = []) => {
    if (!onEvent) return;
    for (const ev of events) onEvent(ev);
  };

  const parseStdout = (stdout) => {
    const line = String(stdout || '').trim().split('\n').pop();
    const parsed = line ? JSON.parse(line) : null;
    if (parsed?.events) emitEvents(parsed.events);
    return parsed;
  };

  if (sandbox.isEnabled()) {
    const boxed = await sandbox.run(`node -e ${JSON.stringify(nodeScript)}`, options.timeoutMs || 180000, pwImage);
    if (boxed) {
      try {
        const parsed = parseStdout(boxed.stdout);
        return { ok: boxed.ok && parsed?.ok !== false, ...parsed, stderr: boxed.stderr, sandbox: true };
      } catch {
        return { ok: false, error: boxed.stderr || 'visual session failed', sandbox: true };
      }
    }
  }

  return new Promise((resolve) => {
    const child = spawn('node', ['-e', nodeScript], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      try {
        const parsed = parseStdout(stdout);
        resolve({ ok: code === 0 && parsed?.ok !== false, ...parsed, stderr, sandbox: false });
      } catch {
        resolve({ ok: false, stderr: stderr || 'visual session failed', sandbox: false });
      }
    });
    child.on('error', (err) => resolve({ ok: false, error: err.message, sandbox: false }));
  });
}

async function observePage(projectRoot, url, options = {}) {
  return runPlaywrightVisualSession(projectRoot, {
    ...options,
    url,
    steps: [{ action: 'wait', ms: 200 }]
  });
}

module.exports = {
  VIEWPORT,
  runPlaywrightVisualSession,
  observePage
};
