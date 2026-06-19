import axios from 'axios';
import { API_BASE } from '../apiBase';

export type Fa7ProblemMarker = {
  resource: string;
  message: string;
  severity: number;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source?: string;
};

const markersByPath = new Map<string, Fa7ProblemMarker[]>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function flushWorkspace() {
  const files = [...markersByPath.entries()].map(([path, markers]) => ({ path, markers }));
  void axios.post(`${API_BASE}/v3/context/problems/sync`, { files }).then(() => {
    window.dispatchEvent(new CustomEvent('fa7-problems-updated'));
  }).catch(() => { /* non-fatal */ });
}

/** Publish markers for one open tab; syncs all registered tabs to backend. */
export function publishProblems(markers: Fa7ProblemMarker[], activeFile = '') {
  const file = activeFile.replace(/^\.\//, '');
  if (file) markersByPath.set(file, markers);
  window.__fa7Problems = markers;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(flushWorkspace, 400);
}

export function unregisterProblemsFile(filePath: string) {
  const file = filePath.replace(/^\.\//, '');
  if (!file) return;
  markersByPath.delete(file);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(flushWorkspace, 400);
}

export function getWorkspaceProblemFiles(): string[] {
  return [...markersByPath.keys()];
}
