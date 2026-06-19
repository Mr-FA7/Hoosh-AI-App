/** Live agent pointer/keyboard/screen events → Active Preview overlay */

import { API_BASE } from '../apiBase';

export type AgentVisualAction = {
  ts?: number;
  type: 'move' | 'click' | 'type' | 'screenshot' | 'status';
  x?: number;
  y?: number;
  text?: string;
  selector?: string;
  button?: string;
  image?: string;
  message?: string;
  label?: string;
  space?: 'viewport' | 'screen';
  source?: string;
  viewport?: { width: number; height: number };
};

export const AGENT_VISUAL_EVENT = 'hoosh:agent-visual';

export function dispatchAgentVisualAction(action: AgentVisualAction) {
  window.dispatchEvent(new CustomEvent<AgentVisualAction>(AGENT_VISUAL_EVENT, { detail: action }));
}

export function subscribeAgentVisualStream(onAction: (action: AgentVisualAction) => void) {
  const onWindow = (event: Event) => {
    const detail = (event as CustomEvent<AgentVisualAction>).detail;
    if (detail?.type) onAction(detail);
  };
  window.addEventListener(AGENT_VISUAL_EVENT, onWindow);

  let es: EventSource | null = null;
  try {
    es = new EventSource(`${API_BASE}/v3/agent/actions/stream`);
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as AgentVisualAction;
        if (parsed?.type) {
          dispatchAgentVisualAction(parsed);
          onAction(parsed);
        }
      } catch { /* ignore */ }
    };
  } catch { /* ignore */ }

  return () => {
    window.removeEventListener(AGENT_VISUAL_EVENT, onWindow);
    es?.close();
  };
}

export function mapUiAgentEvent(ev: Record<string, unknown>): AgentVisualAction | null {
  const kind = String(ev.type || '');
  if (['move', 'click', 'type', 'screenshot', 'status'].includes(kind)) {
    return ev as AgentVisualAction;
  }
  if (kind === 'ui_action' && ev.action && typeof ev.action === 'object') {
    return ev.action as AgentVisualAction;
  }
  return null;
}
