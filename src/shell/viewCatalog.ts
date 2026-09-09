/**
 * Single catalog for the human rail and the command palette.
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
  Monitor,
  Cable,
  Wrench,
  ListTodo,
  Users,
  FileBox,
  MonitorSmartphone,
  type LucideIcon
} from 'lucide-react';

export type ViewMode =
  | 'home' | 'editor' | 'engine' | 'terminal' | 'vmlab' | 'stacks' | 'workflows' | 'media'
  | 'browser' | 'preview' | 'marketplace' | 'uat' | 'settings' | 'git' | 'problems'
  | 'computers' | 'connections' | 'tools' | 'tasks' | 'rooms' | 'artifacts' | 'computerUse';

export type ViewGroup = 'primary' | 'build' | 'advanced' | 'settings';
export type ViewAudience = 'human' | 'agent';

export type ViewEntry = {
  id: ViewMode;
  labelKey: string;
  group: ViewGroup;
  audience: ViewAudience;
  Icon: LucideIcon;
  keywords: string;
};

export const VIEW_CATALOG: ViewEntry[] = [
  { id: 'home', labelKey: 'sidebar.home', group: 'primary', audience: 'human', Icon: MessageSquarePlus, keywords: 'chat new home composer' },
  { id: 'editor', labelKey: 'sidebar.workspace', group: 'primary', audience: 'human', Icon: Layout, keywords: 'code monaco file editor workspace' },
  { id: 'engine', labelKey: 'sidebar.models', group: 'primary', audience: 'human', Icon: Cpu, keywords: 'models ollama lmstudio providers hub' },
  { id: 'computers', labelKey: 'sidebar.computers', group: 'primary', audience: 'human', Icon: Monitor, keywords: 'runtime device pairing doctor' },
  { id: 'terminal', labelKey: 'sidebar.terminal', group: 'primary', audience: 'human', Icon: Terminal, keywords: 'shell pty fard' },
  { id: 'git', labelKey: 'sidebar.git', group: 'primary', audience: 'human', Icon: GitBranch, keywords: 'source control commit push pull' },
  { id: 'problems', labelKey: 'sidebar.problems', group: 'primary', audience: 'human', Icon: AlertTriangle, keywords: 'diagnostics lint errors' },
  { id: 'preview', labelKey: 'sidebar.activePreview', group: 'primary', audience: 'human', Icon: PlayCircle, keywords: 'dev server localhost' },

  { id: 'connections', labelKey: 'sidebar.connections', group: 'build', audience: 'human', Icon: Cable, keywords: 'integrations mcp docker models connections' },
  { id: 'tools', labelKey: 'sidebar.tools', group: 'build', audience: 'human', Icon: Wrench, keywords: 'native mcp skills extensions registry' },
  { id: 'tasks', labelKey: 'sidebar.tasks', group: 'build', audience: 'human', Icon: ListTodo, keywords: 'tasks subagents' },
  { id: 'rooms', labelKey: 'sidebar.rooms', group: 'build', audience: 'human', Icon: Users, keywords: 'agent rooms team orchestration' },
  { id: 'artifacts', labelKey: 'sidebar.artifacts', group: 'build', audience: 'human', Icon: FileBox, keywords: 'artifacts outputs' },
  { id: 'marketplace', labelKey: 'sidebar.giraMarketplace', group: 'build', audience: 'human', Icon: Package, keywords: 'skills extensions themes' },
  { id: 'stacks', labelKey: 'sidebar.stacks', group: 'build', audience: 'human', Icon: Layers, keywords: 'docker podman compose' },
  { id: 'workflows', labelKey: 'sidebar.workflows', group: 'build', audience: 'human', Icon: GitBranch, keywords: 'flow automation debugger' },
  { id: 'media', labelKey: 'sidebar.mediaStudio', group: 'build', audience: 'human', Icon: Sparkles, keywords: 'speech vision ocr' },
  { id: 'browser', labelKey: 'sidebar.worldView', group: 'build', audience: 'human', Icon: Globe, keywords: 'kavosh web browser agent' },

  { id: 'computerUse', labelKey: 'sidebar.computerUse', group: 'advanced', audience: 'agent', Icon: MonitorSmartphone, keywords: 'negah computer use screen' },
  { id: 'vmlab', labelKey: 'sidebar.vmMatrix', group: 'advanced', audience: 'agent', Icon: MonitorPlay, keywords: 'qemu virtualbox sandbox vm' },
  { id: 'uat', labelKey: 'sidebar.uatFeedback', group: 'advanced', audience: 'agent', Icon: Activity, keywords: 'test run feedback' },

  { id: 'settings', labelKey: 'sidebar.neuralConfig', group: 'settings', audience: 'human', Icon: Settings, keywords: 'config account theme' }
];

export const PRIMARY_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'primary' && v.id !== 'home');
export const BUILD_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'build');
export const ADVANCED_VIEWS = VIEW_CATALOG.filter((v) => v.group === 'advanced');
export const SETTINGS_VIEW = VIEW_CATALOG.find((v) => v.id === 'settings')!;
export const HOME_VIEW = VIEW_CATALOG.find((v) => v.id === 'home')!;

export function isWorkspaceView(mode: ViewMode): boolean {
  return mode === 'home' || mode === 'editor';
}

export const SECONDARY_IDS = new Set<ViewMode>(
  VIEW_CATALOG.filter((v) => v.group === 'build' || v.group === 'advanced').map((v) => v.id)
);

export function isViewMode(value: string): value is ViewMode {
  return VIEW_CATALOG.some((v) => v.id === value);
}
