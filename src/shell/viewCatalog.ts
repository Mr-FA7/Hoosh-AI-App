/**
 * Single catalog for the human rail and the command palette.
 *
 * Surfaces the human uses every day stay in `primary`. Build tools sit behind
 * More. Agent-infrastructure views (engine, VM lab, UAT) stay hidden until
 * someone inspects them — the agent already drives those backends.
 */
import {
  Layout,
  Cpu,
  Terminal,
  Globe,
  PlayCircle,
  Activity,
  Settings,
  Package,
  MonitorPlay,
  GitBranch,
  AlertTriangle,
  Layers,
  Sparkles,
  MessageSquarePlus,
  type LucideIcon
} from 'lucide-react';

export type ViewMode =
  | 'home' | 'editor' | 'engine' | 'terminal' | 'vmlab' | 'stacks' | 'workflows' | 'media'
  | 'browser' | 'preview' | 'marketplace' | 'uat' | 'settings' | 'git' | 'problems';

export type ViewGroup = 'primary' | 'build' | 'advanced' | 'settings';
export type ViewAudience = 'human' | 'agent';

export type ViewEntry = {
  id: ViewMode;
  labelKey: string;
  group: ViewGroup;
  audience: ViewAudience;
  Icon: LucideIcon;
  /** Extra latin tokens for palette search (not shown). */
  keywords: string;
};

export const VIEW_CATALOG: ViewEntry[] = [
  { id: 'home', labelKey: 'sidebar.home', group: 'primary', audience: 'human', Icon: MessageSquarePlus, keywords: 'chat new home' },
  { id: 'editor', labelKey: 'sidebar.neuralEditor', group: 'primary', audience: 'human', Icon: Layout, keywords: 'code monaco file' },
  { id: 'terminal', labelKey: 'sidebar.terminal', group: 'primary', audience: 'human', Icon: Terminal, keywords: 'shell pty fard' },
  { id: 'git', labelKey: 'sidebar.git', group: 'primary', audience: 'human', Icon: GitBranch, keywords: 'source control commit' },
  { id: 'problems', labelKey: 'sidebar.problems', group: 'primary', audience: 'human', Icon: AlertTriangle, keywords: 'diagnostics lint errors' },
  { id: 'preview', labelKey: 'sidebar.activePreview', group: 'primary', audience: 'human', Icon: PlayCircle, keywords: 'dev server localhost' },

  { id: 'marketplace', labelKey: 'sidebar.giraMarketplace', group: 'build', audience: 'human', Icon: Package, keywords: 'skills extensions themes' },
  { id: 'stacks', labelKey: 'sidebar.stacks', group: 'build', audience: 'human', Icon: Layers, keywords: 'docker podman compose' },
  { id: 'workflows', labelKey: 'sidebar.workflows', group: 'build', audience: 'human', Icon: GitBranch, keywords: 'flow automation' },
  { id: 'media', labelKey: 'sidebar.mediaStudio', group: 'build', audience: 'human', Icon: Sparkles, keywords: 'speech vision ocr' },
  { id: 'browser', labelKey: 'sidebar.worldView', group: 'build', audience: 'human', Icon: Globe, keywords: 'kavosh web' },

  { id: 'engine', labelKey: 'sidebar.giraEngineering', group: 'advanced', audience: 'agent', Icon: Cpu, keywords: 'models ollama lmstudio providers vault' },
  { id: 'vmlab', labelKey: 'sidebar.vmMatrix', group: 'advanced', audience: 'agent', Icon: MonitorPlay, keywords: 'qemu virtualbox sandbox vm' },
  { id: 'uat', labelKey: 'sidebar.uatFeedback', group: 'advanced', audience: 'agent', Icon: Activity, keywords: 'test run feedback' },

  { id: 'settings', labelKey: 'sidebar.neuralConfig', group: 'settings', audience: 'human', Icon: Settings, keywords: 'config account theme' }
];

export const PRIMARY_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'primary');
export const BUILD_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'build');
export const ADVANCED_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'advanced');
export const SETTINGS_VIEW = VIEW_CATALOG.find((v) => v.id === 'settings')!;

export const SECONDARY_IDS = new Set<ViewMode>(
  VIEW_CATALOG.filter((v) => v.group === 'build' || v.group === 'advanced').map((v) => v.id)
);

export function isViewMode(value: string): value is ViewMode {
  return VIEW_CATALOG.some((v) => v.id === value);
}
