/**
 * Architecture v2 — core product contracts (Phase 0.5).
 * Shared TypeScript types for Control Plane + Runtime clients.
 * Runtime JS modules mirror these shapes; do not put execution here.
 */

/** Closed approval outcomes — fail closed unless allowed-once. */
export type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';

export type ApprovalPolicy = 'ask' | 'never';

export type PrivacyMode = 'local-only' | 'hybrid' | 'cloud' | 'strict-private';

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

/** UX bundles sandbox + approval (DeepSeek-style presets; Hoosh-owned). */
export type PermissionPresetId = 'safe' | 'full' | 'custom';

export type ModelSourceKind = 'local' | 'cloud' | 'custom';

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting-approval'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type RoomMode =
  | 'sequential'
  | 'parallel'
  | 'debate'
  | 'review'
  | 'supervisor'
  | 'swarm';

export type ConnectionKind =
  | 'model-provider'
  | 'device'
  | 'browser'
  | 'mcp'
  | 'docker'
  | 'git-host'
  | 'database'
  | 'api'
  | 'other';

export interface ModelCapabilities {
  text?: boolean;
  vision?: boolean;
  tools?: boolean;
  embed?: boolean;
  longContext?: boolean;
}

export interface ModelProviderRef {
  id: string;
  kind: ModelSourceKind;
  /** ollama | lmstudio | openai_compat | anthropic_compat | openrouter | … */
  adapter: string;
  displayName: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ModelRef {
  providerId: string;
  name: string;
  capabilities?: ModelCapabilities;
  contextLength?: number;
  local: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  os?: string;
  runtimeVersion: string;
  online: boolean;
  capabilities: DeviceCapabilities;
  pairedAt?: string;
  lastSeenAt?: string;
}

export interface DeviceCapabilities {
  filesystem: boolean;
  terminal: boolean;
  git: boolean;
  docker: boolean;
  browser: boolean;
  computerUse: boolean;
  mcp: boolean;
  skills: boolean;
  localModels: boolean;
  apiVersion: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  instructions?: string;
  model?: ModelRef;
  toolAllowlist?: string[];
  skillIds?: string[];
  permissionPreset?: PermissionPresetId;
  deviceId?: string;
}

export interface AgentRun {
  id: string;
  agentId?: string;
  threadId?: string;
  roomId?: string;
  deviceId?: string;
  status: AgentRunStatus;
  goal?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  error?: string;
}

export interface TaskRecord {
  id: string;
  runId?: string;
  roomId?: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  assigneeAgentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  /** native | mcp | skill-script | extension */
  origin: 'native' | 'mcp' | 'skill' | 'extension';
  category?: string;
}

export interface ToolExecution {
  id: string;
  runId?: string;
  toolName: string;
  argsSummary?: string;
  status: 'pending' | 'approved' | 'denied' | 'running' | 'succeeded' | 'failed';
  startedAt: string;
  endedAt?: string;
  error?: string;
}

export interface PermissionPolicyState {
  preset: PermissionPresetId;
  sandbox: SandboxMode;
  approval: ApprovalPolicy;
  privacy: PrivacyMode;
  yolo?: boolean;
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  callId?: string;
  reason?: string;
  createdAt: string;
  outcome?: ApprovalOutcome;
}

export interface HooshEvent {
  id: string;
  type: string;
  at: string;
  runId?: string;
  deviceId?: string;
  payload?: Record<string, unknown>;
}

export interface ArtifactRef {
  id: string;
  kind: string;
  title: string;
  path?: string;
  runId?: string;
  createdAt: string;
}

export interface RoomDefinition {
  id: string;
  name: string;
  mode: RoomMode;
  agentIds: string[];
  objective?: string;
  deviceId?: string;
}

export type RoomMessageKind =
  | 'task-request'
  | 'task-result'
  | 'status'
  | 'artifact'
  | 'question'
  | 'approval-request'
  | 'failure'
  | 'user';

export interface RoomMessage {
  id: string;
  roomId: string;
  kind: RoomMessageKind;
  fromAgentId?: string;
  toAgentId?: string;
  body: string;
  at: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  version: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: AgentRunStatus;
  startedAt: string;
  endedAt?: string;
}

export interface ConnectionRecord {
  id: string;
  kind: ConnectionKind;
  name: string;
  status: 'connected' | 'degraded' | 'offline' | 'unknown';
  lastUsedAt?: string;
  revokeable: boolean;
}

export interface RuntimeBootstrap {
  deviceId: string;
  runtimeVersion: string;
  apiVersion: number;
  /** Short-lived or long-lived device session token for local Control Plane. */
  deviceToken: string;
  bindHost: string;
  bindPort: number;
  authRequired: boolean;
  capabilities: DeviceCapabilities;
}

/** Current Runtime HTTP API surface (Architecture v2). Paths are under /api. */
export const RUNTIME_API_SURFACE = {
  health: 'GET /api/v3/runtime/health',
  bootstrap: 'GET /api/v3/runtime/bootstrap',
  doctor: 'GET /api/v3/runtime/doctor',
  capabilities: 'GET /api/v3/runtime/capabilities',
  pairStart: 'POST /api/v3/runtime/pair/start',
  pairStatus: 'GET /api/v3/runtime/pair/status',
  pairConfirm: 'POST /api/v3/runtime/pair/confirm',
  sessions: 'GET /api/v3/runtime/sessions',
  sessionsRevoke: 'POST /api/v3/runtime/sessions/revoke',
  revoke: 'POST /api/v3/runtime/revoke',
  devices: 'GET /api/v3/runtime/devices',
  devicePatch: 'PATCH /api/v3/runtime/device',
  permissionPresetGet: 'GET /api/v3/permission/preset',
  permissionPresetSet: 'POST /api/v3/permission/preset',
  approvalPending: 'GET /api/v3/approval/pending',
  approvalRespond: 'POST /api/v3/approval/respond',
  modelsCatalog: 'GET /api/ai/models/catalog',
  chat: 'POST /api/ai/chat'
} as const;
