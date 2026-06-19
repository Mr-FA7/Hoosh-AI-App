import axios from 'axios';
import { API_BASE } from '../apiBase';

export type Fa7TerminalState = {
  buffer: string;
  selection: string;
  purpose: 'ai' | 'user';
  sessionName?: string;
  updatedAt: number;
};

declare global {
  interface Window {
    __fa7TerminalSelection?: string;
    __fa7TerminalBuffer?: string;
    __fa7TerminalState?: Fa7TerminalState;
    __fa7Problems?: unknown[];
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function publishTerminalState(state: Partial<Fa7TerminalState>) {
  const prev = window.__fa7TerminalState;
  const next: Fa7TerminalState = {
    buffer: state.buffer ?? prev?.buffer ?? '',
    selection: state.selection ?? prev?.selection ?? '',
    purpose: state.purpose ?? prev?.purpose ?? 'ai',
    sessionName: state.sessionName ?? prev?.sessionName,
    updatedAt: Date.now()
  };
  window.__fa7TerminalState = next;
  window.__fa7TerminalBuffer = next.buffer;
  window.__fa7TerminalSelection = next.selection;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void axios.post(`${API_BASE}/v3/context/terminal/sync`, {
      buffer: next.buffer,
      selection: next.selection,
      purpose: next.purpose,
      sessionName: next.sessionName
    }).catch(() => { /* non-fatal */ });
  }, 400);
}

export function stripAnsi(text: string): string {
  return String(text || '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\r/g, '');
}

export function appendTerminalBuffer(existing: string, chunk: string, max = 100000): string {
  const next = `${existing}${stripAnsi(chunk)}`;
  if (next.length <= max) return next;
  return next.slice(next.length - max);
}
