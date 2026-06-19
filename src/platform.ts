/** Runtime platform helpers for desktop vs hosted web vs mobile. */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);
}

export function isMobileWeb(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export function isHostedWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (isElectron()) return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

/** True when the UI is served from localhost and may talk to a local companion. */
export function isLocalCompanionWeb(): boolean {
  if (typeof window === 'undefined' || isElectron()) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function prefersBrowserFolderPicker(): boolean {
  return isHostedWebApp() || isMobileWeb() || !isLocalCompanionWeb();
}
