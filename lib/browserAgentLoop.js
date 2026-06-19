/**
 * Autonomous browser agent loop — emits visual pointer/keyboard events for Active Preview.
 */
const { runPlaywrightVisualSession, observePage } = require('./playwrightVisualSession');
const { resolveInputToUrl } = require('../kavoshBrowserKernel');

const DEFAULT_STEPS = 5;

function parseAction(text) {
  const raw = String(text || '').trim();
  try {
    const j = JSON.parse(raw);
    if (j.action) return j;
  } catch { /* continue */ }
  const actionMatch = raw.match(/action["\s:]+([a-z_]+)/i);
  const urlMatch = raw.match(/url["\s:]+(["'])(.+?)\1/i) || raw.match(/https?:\/\/\S+/i);
  const selectorMatch = raw.match(/selector["\s:]+(["'])(.+?)\1/i);
  const textMatch = raw.match(/text["\s:]+(["'])([\s\S]*?)\1/i);
  const scriptMatch = raw.match(/script["\s:]+(["'])([\s\S]+?)\1/i);
  return {
    action: actionMatch?.[1]?.toLowerCase() || 'observe',
    url: urlMatch?.[2] || urlMatch?.[0],
    selector: selectorMatch?.[2],
    text: textMatch?.[2],
    script: scriptMatch?.[2]
  };
}

function decisionToStep(decision) {
  const action = String(decision?.action || '').toLowerCase();
  if (action === 'navigate' && decision.url) return { action: 'navigate', url: decision.url };
  if (action === 'click' && decision.selector) return { action: 'click', selector: decision.selector };
  if ((action === 'type' || action === 'fill') && decision.selector) {
    return { action: 'type', selector: decision.selector, text: decision.text || '' };
  }
  if (decision.script) return { action: 'script', script: decision.script };
  if (action === 'wait') return { action: 'wait', ms: Number(decision.ms || 800) };
  return null;
}

async function runBrowserAgent(projectRoot, options = {}) {
  const goal = String(options.goal || '').trim();
  if (!goal) return { ok: false, error: 'goal is required' };

  const maxSteps = Math.min(12, Math.max(1, Number(options.maxSteps) || DEFAULT_STEPS));
  const kavosh = options.kavosh;
  const llmGenerate = options.llmGenerate;
  const sandbox = options.sandbox !== false;
  const onVisualAction = typeof options.onVisualAction === 'function' ? options.onVisualAction : null;
  const emit = (action) => {
    if (onVisualAction) onVisualAction(action);
  };
  const steps = [];
  let currentUrl = options.url || '';

  if (!currentUrl) {
    const guess = resolveInputToUrl(goal);
    if (guess.ok) currentUrl = guess.url;
  }

  if (currentUrl && kavosh?.evaluateNavigation) {
    const nav = kavosh.evaluateNavigation(currentUrl);
    if (!nav.ok) return { ok: false, error: nav.error, blocked: !!nav.blocked, steps };
    currentUrl = nav.url;
  }

  emit({ type: 'status', message: `Browser agent started: ${goal}`, space: 'viewport' });

  for (let i = 0; i < maxSteps; i++) {
    const observe = await observePage(projectRoot, currentUrl || 'about:blank', {
      sandbox,
      playwrightImage: options.playwrightImage,
      onEvent: emit
    });

    if (!observe.ok) {
      steps.push({ step: i + 1, type: 'error', detail: observe.error || observe.stderr || 'playwright failed' });
      emit({ type: 'status', message: observe.error || 'Browser observe failed', space: 'viewport' });
      return { ok: false, steps, error: observe.error || observe.stderr || 'browser observe failed' };
    }

    const page = observe.observe || {};
    if (page.url) currentUrl = page.url;
    steps.push({ step: i + 1, type: 'observe', url: page.url, title: page.title });

    if (!llmGenerate) {
      emit({ type: 'status', message: 'Observation complete (no LLM)', space: 'viewport' });
      return { ok: true, steps, done: true, note: 'No LLM — observation only' };
    }

    const prompt = [
      `Browser agent goal: ${goal}`,
      `Current URL: ${page.url || currentUrl}`,
      `Page title: ${page.title || ''}`,
      `Visible text excerpt:\n${(page.text || '').slice(0, 2500)}`,
      'Reply with JSON only. Examples:',
      '{"action":"click","selector":"button[type=submit]"}',
      '{"action":"type","selector":"input[name=email]","text":"test@example.com"}',
      '{"action":"navigate","url":"http://127.0.0.1:5174/login"}',
      '{"action":"done"}',
      `Step ${i + 1}/${maxSteps}`
    ].join('\n\n');

    const decisionRaw = await llmGenerate({ prompt, role: 'chat', options: { num_predict: 300 } });
    const decision = parseAction(decisionRaw);
    steps.push({ step: i + 1, type: 'decide', decision });
    emit({ type: 'status', message: `Decision: ${decision.action}${decision.selector ? ' → ' + decision.selector : ''}`, space: 'viewport' });

    if (decision.action === 'done') {
      emit({ type: 'status', message: 'Browser agent finished', space: 'viewport' });
      return { ok: true, steps, done: true, summary: String(decisionRaw).slice(0, 500) };
    }

    const visualStep = decisionToStep(decision);
    if (!visualStep) {
      steps.push({ step: i + 1, type: 'skip', decision });
      continue;
    }

    if (visualStep.action === 'navigate' && visualStep.url) {
      if (kavosh?.evaluateNavigation) {
        const nav = kavosh.evaluateNavigation(visualStep.url);
        if (!nav.ok) {
          steps.push({ step: i + 1, type: 'blocked', url: visualStep.url, error: nav.error });
          continue;
        }
        visualStep.url = nav.url;
        currentUrl = nav.url;
      } else {
        currentUrl = visualStep.url;
      }
    }

    const act = await runPlaywrightVisualSession(projectRoot, {
      url: currentUrl || page.url,
      steps: [visualStep],
      sandbox,
      playwrightImage: options.playwrightImage,
      onEvent: emit
    });

    steps.push({ step: i + 1, type: 'act', ok: act.ok, result: act.observe });
    if (act.observe?.url) currentUrl = act.observe.url;
    if (!act.ok) {
      emit({ type: 'status', message: act.error || 'Action failed', space: 'viewport' });
    }
  }

  emit({ type: 'status', message: 'Max steps reached', space: 'viewport' });
  return { ok: true, steps, done: false, note: 'max steps reached' };
}

module.exports = { runBrowserAgent, parseAction, decisionToStep };
