import { create } from 'zustand';
import type { AgentKernelEvent, CognitiveLogEntry, HooshAgentRole } from './types';
import { extractToolJsonAfterPrefix, startMissionStream, consumeNdjsonStream } from './agentService';
import { API_BASE } from '../apiBase';
import { isDirectCompanionReachable, getCompanionDirectUrl } from '../lib/companionProbe';
import axios from 'axios';

function resolveApiUrl(path: string): string {
  if (isDirectCompanionReachable()) return `${getCompanionDirectUrl()}${path}`;
  const rel = path.replace(/^\/api/, '');
  return `${API_BASE}${rel}`;
}

const TAG_RE = /\[(reading|thinking|planning|searching|executing|terminal|writing|rewriting|ask|done|error)\]/gi;

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function mapTagToAgent(tag: string): HooshAgentRole | null {
  const t = tag.toLowerCase();
  if (t === 'planning') return 'architect';
  if (t === 'thinking' || t === 'searching' || t === 'reading') return 'architect';
  if (t === 'executing' || t === 'terminal') return 'coder';
  if (t === 'writing') return 'coder';
  if (t === 'rewriting') return 'medic';
  if (t === 'error') return 'qa_engineer';
  return null;
}

function markLastActiveDone(logs: CognitiveLogEntry[]): CognitiveLogEntry[] {
  if (logs.length === 0) return logs;
  const next = [...logs];
  const i = next.map((l, idx) => ({ l, idx })).reverse().find((x) => x.l.status === 'active')?.idx;
  if (i === undefined) return next;
  next[i] = { ...next[i]!, status: 'done' };
  return next;
}

function appendToLastActive(logs: CognitiveLogEntry[], fragment: string): CognitiveLogEntry[] {
  if (!fragment) return logs;
  if (logs.length === 0) {
    return [
      {
        id: newId(),
        tag: 'thinking',
        message: fragment,
        status: 'active'
      }
    ];
  }
  const next = [...logs];
  const i = next.map((l, idx) => ({ l, idx })).reverse().find((x) => x.l.status === 'active')?.idx;
  if (i === undefined) {
    return next.concat({
      id: newId(),
      tag: 'thinking',
      message: fragment,
      status: 'active'
    });
  }
  next[i] = { ...next[i]!, message: next[i]!.message + fragment };
  return next;
}

function applyToolPayload(logs: CognitiveLogEntry[], json: string): CognitiveLogEntry[] {
  if (logs.length === 0) return logs;
  const next = [...logs];
  const i = next.map((l, idx) => ({ l, idx })).reverse().find((x) => x.l.status === 'active')?.idx;
  if (i === undefined) return next;
  next[i] = { ...next[i]!, payload: json };
  return next;
}

/** Strip complete TOOL:{...} blocks; incomplete tail stays in `rest`. */
function stripCompleteTools(
  input: string
): { cleaned: string; incompleteTail: string; payloads: string[] } {
  const payloads: string[] = [];
  let s = input;
  let guard = 0;
  while (guard++ < 2000) {
    const idx = s.indexOf('TOOL:');
    if (idx === -1) return { cleaned: s, incompleteTail: '', payloads };
    const ext = extractToolJsonAfterPrefix(s, idx);
    if (!ext) {
      return { cleaned: s.slice(0, idx), incompleteTail: s.slice(idx), payloads };
    }
    payloads.push(ext.json);
    s = s.slice(0, idx) + s.slice(ext.end);
  }
  return { cleaned: s, incompleteTail: '', payloads };
}

export interface HooshState {
  isStreaming: boolean;
  chatStreaming: boolean;
  isPaused: boolean;
  activeAgent: HooshAgentRole;
  abortController: AbortController | null;
  askQuestion: string | null;
  cognitiveLogs: CognitiveLogEntry[];
  streamScratch: string;

  setChatStreaming: (v: boolean) => void;
  resetMissionLogs: () => void;
  startMission: (goal: string, projectName?: string) => Promise<void>;
  processStreamText: (text: string) => void;
  ingestAgentEvent: (ev: AgentKernelEvent | null) => void;
  abortMission: () => void;
  resolveAsk: (userInput: string) => Promise<void>;
}

export const useHooshStore = create<HooshState>((set, get) => ({
  isStreaming: false,
  chatStreaming: false,
  isPaused: false,
  activeAgent: 'idle',
  abortController: null,
  askQuestion: null,
  cognitiveLogs: [],
  streamScratch: '',

  setChatStreaming: (v) => set({ chatStreaming: v }),

  resetMissionLogs: () =>
    set({
      cognitiveLogs: [],
      streamScratch: '',
      isPaused: false,
      askQuestion: null,
      activeAgent: 'idle'
    }),

  startMission: async (goal, projectName) => {
    try {
      get().abortController?.abort();
    } catch {
      /* ignore */
    }
    const ac = new AbortController();
    set({
      cognitiveLogs: [],
      streamScratch: '',
      isStreaming: true,
      isPaused: false,
      askQuestion: null,
      abortController: ac,
      activeAgent: 'architect'
    });

    try {
      await startMissionStream(goal, {
        projectName,
        signal: ac.signal,
        onStreamId: (id) => {
          (globalThis as unknown as { __fa7LastStreamId?: string }).__fa7LastStreamId = id;
        },
        onTextChunk: (chunk) => get().processStreamText(chunk),
        onAgentEvent: (ev) => get().ingestAgentEvent(ev),
        onComplete: () => set({ isStreaming: false, abortController: null })
      });
      set({ isStreaming: false, abortController: null });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        set({ isStreaming: false, abortController: null });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      set((s) => ({
        isStreaming: false,
        abortController: null,
        cognitiveLogs: markLastActiveDone(s.cognitiveLogs).concat({
          id: newId(),
          tag: 'error',
          message: msg,
          status: 'error'
        })
      }));
    }
  },

  ingestAgentEvent: (ev) => {
    if (!ev || typeof ev !== 'object') return;
    const t = String(ev.type || '');
    if (t === 'token' && typeof ev.token === 'string') {
      get().processStreamText(ev.token);
      return;
    }
    if (t === 'status' && typeof ev.message === 'string') {
      get().processStreamText(`\n[thinking] ${ev.message}\n`);
      return;
    }
    if (t === 'step_start') {
      const task = (ev as Record<string, unknown>).task;
      if (typeof task === 'string') {
        get().processStreamText(`\n[executing] ${task}\n`);
      }
      return;
    }
    if (t === 'ask') {
      const q = String((ev as Record<string, unknown>).question || (ev as Record<string, unknown>).message || '');
      if (q) {
        set({ isPaused: true, askQuestion: q });
        get().processStreamText(`\n[ask] ${q}\n`);
      }
      return;
    }
    if (t === 'error' && typeof ev.message === 'string') {
      get().processStreamText(`\n[error] ${ev.message}\n`);
    }
  },

  processStreamText: (text) => {
    if (!text) return;
    set((state) => {
      if (state.isPaused) return state;

      let blob = state.streamScratch + text;
      let logs = state.cognitiveLogs;
      let activeAgent = state.activeAgent;
      let nextPaused: boolean = state.isPaused;
      let askQuestion = state.askQuestion;

      const toolRound = stripCompleteTools(blob);
      blob = toolRound.cleaned + toolRound.incompleteTail;
      for (const p of toolRound.payloads) {
        logs = applyToolPayload(logs, p);
        activeAgent = 'coder';
      }

      const tags: { tag: string; index: number; full: string }[] = [];
      TAG_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TAG_RE.exec(blob)) !== null) {
        tags.push({ tag: (m[1] || '').toLowerCase(), index: m.index, full: m[0] || '' });
      }

      if (tags.length === 0) {
        logs = appendToLastActive(logs, blob);
        blob = '';
      } else {
        let cursor = 0;
        for (let ti = 0; ti < tags.length; ti++) {
          const tg = tags[ti]!;
          const before = blob.slice(cursor, tg.index);
          if (before) logs = appendToLastActive(logs, before);

          const nextTagPos = ti + 1 < tags.length ? tags[ti + 1]!.index : blob.length;
          const content = blob.slice(tg.index + tg.full.length, nextTagPos);

          logs = markLastActiveDone(logs);
          const mapped = mapTagToAgent(tg.tag);
          if (mapped) activeAgent = mapped;
          if (tg.tag === 'executing' || tg.tag === 'terminal') activeAgent = 'coder';

          if (tg.tag === 'ask') {
            nextPaused = true;
            askQuestion = content.trim() || askQuestion;
            logs = logs.concat({
              id: newId(),
              tag: 'ask',
              message: content.trim() || '(needs your input)',
              status: 'active'
            });
            cursor = nextTagPos;
            break;
          }

          logs = logs.concat({
            id: newId(),
            tag: tg.tag,
            message: content.trim(),
            status: 'active'
          });

          if (tg.tag === 'done' || tg.tag === 'error') {
            logs = markLastActiveDone(logs);
          }

          cursor = nextTagPos;
        }
        blob = blob.slice(cursor);
      }

      return {
        ...state,
        cognitiveLogs: logs,
        streamScratch: blob,
        activeAgent,
        isPaused: nextPaused,
        askQuestion
      };
    });
  },

  abortMission: () => {
    const s = get();
    const ac = s.abortController;
    const missionActive = s.isStreaming;
    const streamId = (globalThis as unknown as { __fa7LastStreamId?: string }).__fa7LastStreamId;
    try {
      ac?.abort();
    } catch {
      /* ignore */
    }
    if (missionActive) {
      axios.post(`${API_BASE}/ai/chat/abort`, streamId ? { streamId } : {}).catch(() => {});
    }
    if (!missionActive) {
      set({ isStreaming: false, abortController: null });
      return;
    }
    set((st) => {
      const logs = markLastActiveDone(st.cognitiveLogs);
      return {
        isStreaming: false,
        abortController: null,
        cognitiveLogs: logs.concat({
          id: newId(),
          tag: 'error',
          message: 'Mission aborted',
          status: 'error'
        })
      };
    });
  },

  resolveAsk: async (userInput) => {
    set({ isPaused: false, askQuestion: null, isStreaming: true });
    const ac = new AbortController();
    set({ abortController: ac });
    try {
      const res = await fetch(resolveApiUrl('/api/v3/mission/continue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: userInput }),
        signal: ac.signal
      });
      if (!res.ok) throw new Error(`Resume failed: ${res.status}`);
      await consumeNdjsonStream(res, {
        signal: ac.signal,
        onLine: ({ text, agentEvent }) => {
          if (agentEvent) get().ingestAgentEvent(agentEvent);
          if (text) get().processStreamText(text);
        }
      });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        const msg = e instanceof Error ? e.message : String(e);
        get().processStreamText(`\n[error] ${msg}\n`);
      }
    } finally {
      set({ isStreaming: false, abortController: null });
    }
  }
}));
