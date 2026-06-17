/**
 * Command Intelligence Layer — NL → shell command via Ollama or OpenAI.
 */

import { getOSProfile, pickShell } from '../core/os-detector.js';

function normalizeOllamaHttpBase(raw) {
  const s = String(raw || '').trim() || 'http://127.0.0.1:11434';
  if (s.startsWith('http://') || s.startsWith('https://')) return s.replace(/\/$/, '');
  return `http://${s}`.replace(/\/$/, '');
}

/** هماهنگ با main: موتور داخلی فرد مقدار FARD_OLLAMA_API_BASE را ست می‌کند. */
function ollamaApiBase() {
  return normalizeOllamaHttpBase(
    process.env.FARD_OLLAMA_API_BASE || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  );
}

function buildSystemPrompt() {
  const p = getOSProfile();
  const shell = pickShell(p);
  return `You are a strict command translator for ${p.osName} (${p.platform}, ${p.arch}).
Respond with ONE line only: the exact shell command to run, no markdown, no explanation.
Default shell: ${shell.id} at ${shell.path}.
Use only safe, standard commands appropriate for this OS.`;
}

/**
 * @param {string} naturalLanguage
 * @param {{ provider?: 'ollama'|'openai', model?: string }} [opts]
 * @returns {Promise<{ command: string, raw?: unknown }>}
 */
export async function naturalLanguageToCommand(naturalLanguage, opts = {}) {
  const provider = opts.provider || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama');
  const model = opts.model || process.env.UAT_MODEL || 'llama3.2';

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return openAiTranslate(naturalLanguage, model);
  }

  return ollamaTranslate(naturalLanguage, model);
}

async function ollamaTranslate(text, model) {
  const res = await fetch(`${ollamaApiBase()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: text }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.message?.content?.trim() || '';
  const line = content.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return { command: line.replace(/^[`]+|[`]+$/g, ''), raw: data };
}

async function openAiTranslate(text, model) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model.startsWith('gpt') ? model : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: text }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const line = content.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return { command: line.replace(/^[`]+|[`]+$/g, ''), raw: data };
}
