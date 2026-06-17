/** Tabs in the main editor strip — files plus AI-docked tools (no sidebar view switch). */

export type WorkspaceTab =
  | { id: string; kind: 'file'; path: string }
  | {
      id: string;
      kind: 'browser';
      url: string;
      title: string;
      /** Shown under tabs — what the AI is doing with this surface */
      aiStatus?: string;
    }
  | {
      id: string;
      kind: 'terminal';
      label: string;
      aiStatus?: string;
    }
  | {
      id: string;
      kind: 'agent';
      label: string;
      aiStatus?: string;
    }
  | {
      id: string;
      kind: 'download';
      label: string;
      /** Default URL from AI (e.g. from browser) */
      initialUrl?: string;
      aiStatus?: string;
    }
  /** New file / import wizard (same UI as empty editor) */
  | { id: string; kind: 'home'; label?: string };

export function newWorkspaceTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Optional `tr` maps keys like `tab.browser` — see `src/i18n/messages.ts`. */
export function tabDisplayName(tab: WorkspaceTab, tr?: (key: string) => string): string {
  const lbl = (key: string, en: string) => (tr ? tr(key) : en);
  if (tab.kind === 'file') return tab.path.split(/[/\\]/).pop() || tab.path;
  if (tab.kind === 'browser') return tab.title || lbl('tab.browser', 'Browser');
  if (tab.kind === 'terminal') return tab.label || lbl('tab.terminal', 'Terminal');
  if (tab.kind === 'download') return tab.label || lbl('tab.gira', 'Gira');
  if (tab.kind === 'home') return tab.label || lbl('tab.newFile', 'New file');
  return tab.label || lbl('tab.agent', 'Agent');
}
