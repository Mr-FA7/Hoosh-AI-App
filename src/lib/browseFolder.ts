import axios from 'axios';
import { API_BASE } from '../apiBase';
import { isLocalCompanionWeb } from '../platform';
import { pickFolderFromBrowser } from './pickFolder';
import { importFolderFromFileList } from './webWorkspace';

export type BrowseFolderResult =
  | { ok: true; path: string }
  | { ok: false; canceled?: boolean; errorKey?: string; detail?: string };

declare global {
  interface Window {
    electronAPI?: { openFolder: () => Promise<{ canceled: boolean; path?: string }> };
  }
}

async function importFromBrowserPicker(): Promise<BrowseFolderResult> {
  const files = await pickFolderFromBrowser();
  if (!files) return { ok: false, canceled: true };
  try {
    const path = await importFolderFromFileList(files);
    return { ok: true, path };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, errorKey: 'project.folderImportFailed', detail };
  }
}

async function tryCompanionFolderPicker(): Promise<BrowseFolderResult | null> {
  try {
    const r = await axios.get(`${API_BASE}/dialog/open-folder`, { timeout: 8000 });
    if (r.data?.ok && !r.data.canceled && r.data.path) {
      return { ok: true, path: String(r.data.path) };
    }
    if (r.data?.canceled) return { ok: false, canceled: true };
    return null;
  } catch (err: unknown) {
    console.warn('[browseFolder] companion folder picker unavailable', err);
    return null;
  }
}

export async function browseFolderPath(): Promise<BrowseFolderResult> {
  if (window.electronAPI?.openFolder) {
    try {
      const result = await window.electronAPI.openFolder();
      if (result?.canceled) return { ok: false, canceled: true };
      const path = String(result?.path || '').trim();
      if (path) return { ok: true, path };
    } catch (err) {
      console.warn('[browseFolder] electronAPI.openFolder failed', err);
    }
  }

  if (isLocalCompanionWeb()) {
    const companion = await tryCompanionFolderPicker();
    if (companion) return companion;
  }

  const browser = await importFromBrowserPicker();
  if (browser.ok || browser.canceled) return browser;

  return {
    ok: false,
    errorKey: 'project.folderPickerFailed',
    detail: browser.detail,
  };
}
