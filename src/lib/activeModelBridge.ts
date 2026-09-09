/**
 * Shared active-model signal between AIPanel (publisher) and shell chrome
 * (BottomBar). Avoids lifting all of AIPanel state into App.
 */
export type ActiveModelInfo = {
  name: string;
  /** Catalog source: local | lmstudio | cloud | gateway | … */
  source?: string;
  provider?: string;
};

export const ACTIVE_MODEL_KEY = 'hoosh_active_model_v1';
export const ACTIVE_MODEL_EVENT = 'hoosh-active-model';

export function publishActiveModel(info: ActiveModelInfo | null): void {
  try {
    if (!info?.name) {
      localStorage.removeItem(ACTIVE_MODEL_KEY);
    } else {
      localStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(info));
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVE_MODEL_EVENT, { detail: info }));
  }
}

export function readActiveModel(): ActiveModelInfo | null {
  try {
    const raw = localStorage.getItem(ACTIVE_MODEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = String(parsed?.name || '').trim();
    if (!name) return null;
    return {
      name,
      source: parsed?.source ? String(parsed.source) : undefined,
      provider: parsed?.provider ? String(parsed.provider) : undefined
    };
  } catch {
    return null;
  }
}

export function subscribeActiveModel(cb: (info: ActiveModelInfo | null) => void): () => void {
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    cb(detail && detail.name ? detail : readActiveModel());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVE_MODEL_KEY) cb(readActiveModel());
  };
  window.addEventListener(ACTIVE_MODEL_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ACTIVE_MODEL_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
