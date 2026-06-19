import type { AgentKernelEvent, ChatStreamEnvelope, LegacyStreamLine } from './types';
import { API_BASE } from '../apiBase';

const decoder = new TextDecoder();

/** Append decoded bytes to buffer, return complete lines (without trailing incomplete line). */
export function appendChunkToLines(buffer: string, chunk: Uint8Array): { buffer: string; lines: string[] } {
  buffer += decoder.decode(chunk, { stream: true });
  const parts = buffer.split('\n');
  const complete = parts.slice(0, -1);
  const rest = parts[parts.length - 1] ?? '';
  return { buffer: rest, lines: complete };
}

export function flushDecoderBuffer(buffer: string): string {
  if (!buffer) return '';
  try {
    return buffer + decoder.decode();
  } catch {
    return buffer;
  }
}

/** Bracket-count JSON extraction after `TOOL:` (not regex-based). */
export function extractToolJsonAfterPrefix(full: string, fromIndex: number): { json: string; end: number } | null {
  const head = full.indexOf('TOOL:', fromIndex);
  if (head === -1) return null;
  let i = head + 5;
  while (i < full.length && /\s/.test(full[i]!)) i++;
  if (full[i] !== '{') return null;
  const start = i;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = start; j < full.length; j++) {
    const ch = full[j]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return { json: full.slice(start, j + 1), end: j + 1 };
        }
      }
    }
  }
  return null;
}

function parseJsonLine(line: string): unknown {
  const t = line.trim();
  if (!t) return null;
  return JSON.parse(t) as unknown;
}

function normalizeLine(obj: unknown): {
  text: string;
  done: boolean;
  agentEvent: AgentKernelEvent | null;
} {
  if (!obj || typeof obj !== 'object') {
    return { text: '', done: false, agentEvent: null };
  }

  const legacy = obj as LegacyStreamLine;
  if (typeof legacy.response === 'string') {
    return { text: legacy.response, done: !!legacy.done, agentEvent: null };
  }

  const env = obj as ChatStreamEnvelope;
  let text = '';
  if (env.message !== undefined) {
    if (typeof env.message === 'string') text = env.message;
    else if (env.message && typeof env.message.content === 'string') text = env.message.content;
  }

  const ev = env.agent_event;
  let agentEvent: AgentKernelEvent | null = null;
  if (ev && typeof ev === 'object') {
    agentEvent = ev as AgentKernelEvent;
    if (agentEvent.type === 'token' && typeof agentEvent.token === 'string') {
      text = agentEvent.token;
    } else if (typeof agentEvent.message === 'string' && agentEvent.message && !text) {
      text = `\n[thinking] ${agentEvent.message}\n`;
    }
  }

  const done =
    !!legacy.done ||
    !!(agentEvent && (agentEvent.done === true || agentEvent.type === 'finish' || agentEvent.type === 'done'));

  return { text, done, agentEvent };
}

/**
 * Reads NDJSON from a fetch Response body (newline-delimited JSON).
 * Handles split lines across chunks; stops when `done` is signaled in payload or stream ends.
 */
export async function consumeNdjsonStream(
  response: Response,
  opts: {
    signal: AbortSignal;
    onLine: (payload: { text: string; done: boolean; agentEvent: AgentKernelEvent | null; raw: unknown }) => void;
  }
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error('No response body');

  let buf = '';
  const reader = body.getReader();

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const { buffer, lines } = appendChunkToLines(buf, value);
        buf = buffer;
        for (const line of lines) {
          let parsed: unknown;
          try {
            parsed = parseJsonLine(line);
          } catch {
            continue;
          }
          if (parsed == null) continue;
          const n = normalizeLine(parsed);
          opts.onLine({ text: n.text, done: n.done, agentEvent: n.agentEvent, raw: parsed });
          if (n.done) return;
        }
      }
      if (opts.signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return;
      }
    }
    if (buf.trim()) {
      try {
        const parsed = parseJsonLine(buf);
        if (parsed != null) {
          const n = normalizeLine(parsed);
          opts.onLine({ text: n.text, done: n.done, agentEvent: n.agentEvent, raw: parsed });
        }
      } catch {
        /* incomplete */
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

export async function startMissionStream(
  goal: string,
  opts: {
    projectName?: string;
    signal: AbortSignal;
    onTextChunk: (text: string) => void;
    onAgentEvent?: (ev: AgentKernelEvent | null) => void;
    onComplete?: () => void;
    onStreamId?: (id: string) => void;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/v3/mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, projectName: opts.projectName }),
    signal: opts.signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Mission failed: ${res.status}`);
  }

  const streamId = res.headers.get('x-stream-id') || res.headers.get('X-Stream-Id');
  if (streamId) opts.onStreamId?.(streamId);

  await consumeNdjsonStream(res, {
    signal: opts.signal,
    onLine: ({ text, done, agentEvent }) => {
      if (agentEvent) opts.onAgentEvent?.(agentEvent);
      if (text) opts.onTextChunk(text);
      if (done) opts.onComplete?.();
    }
  });
}

export interface ChatStreamRequestBody {
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  model: string;
  mode: string;
  allowedModels: string[];
  sessionId?: string;
  useAcp?: boolean;
  acpBackend?: string;
}

/**
 * POST /api/ai/chat — NDJSON stream (same envelope as mission). Invokes onLine per complete JSON row.
 */
export async function runChatStream(
  body: ChatStreamRequestBody,
  opts: {
    signal: AbortSignal;
    onLine: (payload: {
      text: string;
      done: boolean;
      agentEvent: AgentKernelEvent | null;
      raw: unknown;
    }) => void;
    onStreamId?: (id: string) => void;
  }
): Promise<void> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
    signal: opts.signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Chat request failed: ${res.status}`);
  }

  const streamId = res.headers.get('x-stream-id') || res.headers.get('X-Stream-Id');
  if (streamId) opts.onStreamId?.(streamId);

  await consumeNdjsonStream(res, {
    signal: opts.signal,
    onLine: opts.onLine
  });
}
