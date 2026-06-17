export type HooshAgentRole =
  | 'idle'
  | 'architect'
  | 'coder'
  | 'medic'
  | 'qa_engineer'
  | 'negah';

export type CognitiveLogStatus = 'active' | 'done' | 'error';

export interface CognitiveLogEntry {
  id: string;
  tag: string;
  message: string;
  status: CognitiveLogStatus;
  payload?: string;
}

/** Companion NDJSON chat envelope */
export interface ChatStreamEnvelope {
  message?: { content?: string } | string;
  agent_event?: AgentKernelEvent;
}

/** Legacy Ollama-style line */
export interface LegacyStreamLine {
  response?: string;
  done?: boolean;
}

export type AgentKernelEvent = {
  type: string;
  message?: string;
  done?: boolean;
  token?: string;
  section?: string;
  stepId?: number;
  [key: string]: unknown;
};

export interface MissionStreamOptions {
  goal: string;
  projectName?: string;
  signal: AbortSignal;
  onTextChunk: (text: string) => void;
  onAgentEvent?: (ev: AgentKernelEvent) => void;
  onDone?: () => void;
}
