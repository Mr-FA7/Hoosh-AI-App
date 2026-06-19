/** Bridge preview/browser tools → AIPanel chat & missions */

export type AgentInjectDetail = {
  text: string;
  autoSend?: boolean;
};

export type AgentMissionDetail = {
  goal: string;
};

export function injectAgentPrompt(text: string, opts?: { autoSend?: boolean }) {
  window.dispatchEvent(
    new CustomEvent<AgentInjectDetail>('hoosh:inject-prompt', { detail: { text, autoSend: !!opts?.autoSend } })
  );
}

export function startAgentTestMission(goal: string) {
  window.dispatchEvent(new CustomEvent<AgentMissionDetail>('hoosh:start-mission', { detail: { goal } }));
}

export const AGENT_INJECT_EVENT = 'hoosh:inject-prompt';
export const AGENT_MISSION_EVENT = 'hoosh:start-mission';
