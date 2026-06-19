import axios from 'axios';
import { API_BASE } from '../apiBase';
import { prefersBrowserFolderPicker } from '../platform';
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

  if (prefersBrowserFolderPicker()) {
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

  try {
    const r = await axios.get(`${API_BASE}/dialog/open-folder`);
    if (r.data?.ok && !r.data.canceled && r.data.path) {
      return { ok: true, path: String(r.data.path) };
    }
    return { ok: false, canceled: true };
  } catch (err: unknown) {
    const detail =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : err instanceof Error
          ? err.message
          : undefined;
    return { ok: false, errorKey: 'project.folderPickerFailed', detail };
  }
}
