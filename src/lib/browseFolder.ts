import axios from 'axios';
import { API_BASE } from '../apiBase';
import { companionGet } from './companionHttp';
import { getRuntimeEnv } from './companionProbe';
import { isHostedWebApp } from '../runtimeEnv';
import { pickFolderFromBrowser } from './pickFolder';
import { importFolderFromFileList } from './webWorkspace';

export type BrowseFolderPurpose = 'open-project' | 'pick-destination';

export type BrowseFolderResult =
  | { ok: true; path: string }
  | { ok: false; canceled?: boolean; errorKey?: string; detail?: string };

declare global {
  interface Window {
    electronAPI?: { openFolder: () => Promise<{ canceled: boolean; path?: string }> };
  }
}

export type BrowseFolderOptions = {
  purpose?: BrowseFolderPurpose;
};

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
    const r = isHostedWebApp()
      ? await companionGet('/api/dialog/open-folder')
      : await axios.get(`${API_BASE}/dialog/open-folder`, { timeout: 8000 });
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

async function tryNativeFolderPicker(): Promise<BrowseFolderResult | null> {
  if (window.electronAPI?.openFolder) {
    try {
      const result = await window.electronAPI.openFolder();
      if (result?.canceled) return { ok: false, canceled: true };
      const picked = String(result?.path || '').trim();
      if (picked) return { ok: true, path: picked };
    } catch (err) {
      console.warn('[browseFolder] electronAPI.openFolder failed', err);
    }
  }

  const companion = await tryCompanionFolderPicker();
  if (companion) return companion;
  return null;
}

/** Pick a folder on disk (companion/Electron). Never imports into browser memory. */
export async function browseDestinationFolder(): Promise<BrowseFolderResult> {
  const env = await getRuntimeEnv();
  if (!env.usesCompanionApi) {
    return { ok: false, errorKey: 'project.createRequiresCompanion' };
  }

  const native = await tryNativeFolderPicker();
  if (native) return native;

  return { ok: false, errorKey: 'project.createRequiresCompanion' };
}

/** Open/import a project folder — web import only when opening, not for create destination. */
export async function browseFolderPath(options: BrowseFolderOptions = {}): Promise<BrowseFolderResult> {
  const purpose = options.purpose ?? 'open-project';

  if (purpose === 'pick-destination') {
    return browseDestinationFolder();
  }

  const env = await getRuntimeEnv();
  const native = await tryNativeFolderPicker();
  if (native) return native;

  if (env.usesWebWorkspace) {
    const browser = await importFromBrowserPicker();
    if (browser.ok || browser.canceled) return browser;
    return {
      ok: false,
      errorKey: 'project.folderPickerFailed',
      detail: browser.detail,
    };
  }

  const browser = await importFromBrowserPicker();
  if (browser.ok || browser.canceled) return browser;

  return {
    ok: false,
    errorKey: 'project.folderPickerFailed',
    detail: browser.detail,
  };
}
