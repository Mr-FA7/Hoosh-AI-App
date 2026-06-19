/**
 * Unified runtime detection: Electron desktop, local companion (terminal), or web workspace.
 */

export type RuntimeSurface = 'electron' | 'companion' | 'web';

export interface RuntimeEnv {
  surface: RuntimeSurface;
  isMobile: boolean;
  hostname: string;
  /** Companion HTTP API (Ollama, terminal, native folder picker). */
  usesCompanionApi: boolean;
  /** In-browser imported folder workspace (`web://…`). */
  usesWebWorkspace: boolean;
  labelKey: 'runtime.modeElectron' | 'runtime.modeCompanion' | 'runtime.modeWeb';
  browseHintKey: 'runtime.browseElectron' | 'runtime.browseCompanion' | 'runtime.browseWeb';
}

function hostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);
}

export function isMobileWeb(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

export function isHostedWebApp(): boolean {
  if (typeof window === 'undefined' || isElectron()) return false;
  const host = hostname();
  return host !== 'localhost' && host !== '127.0.0.1';
}

export function isLocalDevWeb(): boolean {
  if (typeof window === 'undefined' || isElectron()) return false;
  const host = hostname();
  return host === 'localhost' || host === '127.0.0.1';
}

/** @deprecated Use getRuntimeEnvSync().usesWebWorkspace */
export function prefersBrowserFolderPicker(): boolean {
  const env = getRuntimeEnvSync();
  return env.usesWebWorkspace || env.isMobile;
}

/** @deprecated Use isLocalDevWeb() */
export function isLocalCompanionWeb(): boolean {
  return isLocalDevWeb();
}

export function getRuntimeEnvSync(companionReachable = isLocalDevWeb() && !isHostedWebApp()): RuntimeEnv {
  const host = hostname();
  const mobile = isMobileWeb();

  if (isElectron()) {
    return {
      surface: 'electron',
      isMobile: mobile,
      hostname: host,
      usesCompanionApi: true,
      usesWebWorkspace: false,
      labelKey: 'runtime.modeElectron',
      browseHintKey: 'runtime.browseElectron',
    };
  }

  if (isHostedWebApp()) {
    return {
      surface: 'web',
      isMobile: mobile,
      hostname: host,
      usesCompanionApi: false,
      usesWebWorkspace: true,
      labelKey: 'runtime.modeWeb',
      browseHintKey: 'runtime.browseWeb',
    };
  }

  if (companionReachable) {
    return {
      surface: 'companion',
      isMobile: mobile,
      hostname: host,
      usesCompanionApi: true,
      usesWebWorkspace: false,
      labelKey: 'runtime.modeCompanion',
      browseHintKey: 'runtime.browseCompanion',
    };
  }

  return {
    surface: 'web',
    isMobile: mobile,
    hostname: host,
    usesCompanionApi: false,
    usesWebWorkspace: true,
    labelKey: 'runtime.modeWeb',
    browseHintKey: 'runtime.browseWeb',
  };
}
