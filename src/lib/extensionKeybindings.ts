import axios from 'axios';
import { API_BASE } from '../apiBase';

let cachedBindings: Array<{ key: string; command: string }> = [];
let wired = false;

export async function loadExtensionKeybindings() {
  try {
    const r = await axios.get(`${API_BASE}/v3/extensions/keybindings`);
    cachedBindings = r.data?.keybindings || [];
  } catch {
    cachedBindings = [];
  }
  return cachedBindings;
}

function normalizeKey(ev: KeyboardEvent) {
  const parts: string[] = [];
  if (ev.metaKey) parts.push('cmd');
  if (ev.ctrlKey) parts.push('ctrl');
  if (ev.altKey) parts.push('alt');
  if (ev.shiftKey) parts.push('shift');
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (!['Meta', 'Control', 'Alt', 'Shift'].includes(ev.key)) parts.push(k);
  return parts.join('+');
}

export function wireExtensionKeybindings() {
  if (wired) return;
  wired = true;
  void loadExtensionKeybindings();
  window.addEventListener('keydown', (ev) => {
    const combo = normalizeKey(ev);
    const hit = cachedBindings.find((kb) => kb.key === combo);
    if (!hit) return;
    ev.preventDefault();
    void axios.post(`${API_BASE}/v3/extensions/keybindings/execute`, { key: combo });
  });
}
