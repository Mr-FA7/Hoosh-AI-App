/**
 * Fast-path responses without LLM (free-claude-code-inspired).
 */
const GREETING_RE = /^(hi|hello|hey|سلام|درود|صبح|عصر|شب|خوبی|چطوری|چطوره)\b/i;

const SIMPLE_COMMANDS = [
  { re: /^\/help\b/i, en: 'Hoosh AI commands: /help, /status, /git, /compact. Modes: agent, ask, plan.', fa: 'دستورات: /help، /status، /git، /compact. حالت‌ها: agent، ask، plan.' },
  { re: /^\/status\b/i, handler: 'status' },
  { re: /^\/git\s*status\b/i, handler: 'git_status' }
];

function detectLang(text) {
  return /[\u0600-\u06FF]/.test(text) ? 'fa' : 'en';
}

function tryFastPath(message, ctx = {}) {
  const msg = String(message || '').trim();
  if (!msg) return null;

  if (GREETING_RE.test(msg) && msg.length < 40) {
    const fa = detectLang(msg) === 'fa';
    return {
      content: fa
        ? 'سلام 👋 من Hoosh هستم. بگو دقیقاً چه کاری انجام بدم.'
        : 'Hi 👋 I am Hoosh. Tell me exactly what you want done.',
      type: 'greeting'
    };
  }

  for (const cmd of SIMPLE_COMMANDS) {
    if (!cmd.re.test(msg)) continue;
    if (cmd.handler === 'status') {
      const fa = detectLang(msg) === 'fa';
      const models = (ctx.models || []).slice(0, 5).map((m) => m.name || m).join(', ');
      return {
        content: fa
          ? `وضعیت: پروژه ${ctx.projectRoot || '—'} | مدل‌ها: ${models || 'Ollama'}`
          : `Status: project ${ctx.projectRoot || '—'} | models: ${models || 'Ollama'}`,
        type: 'status'
      };
    }
    if (typeof cmd.en === 'string') {
      const fa = detectLang(msg) === 'fa';
      return { content: fa ? cmd.fa : cmd.en, type: 'command' };
    }
  }

  return null;
}

module.exports = { tryFastPath, detectLang, GREETING_RE };
