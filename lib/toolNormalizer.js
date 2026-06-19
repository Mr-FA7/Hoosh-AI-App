/**
 * Normalize agent output for weaker models (free-claude-code inspired).
 * Strips thinking blocks and repairs TOOL: JSON before parsing.
 */

const THINKING_BLOCK_RE = /<(think|thinking|thought)>[\s\S]*?<\/\1>/gi;
const FENCED_THINKING_RE = /```(?:think|thinking|thought)[\s\S]*?```/gi;

function stripThinkingBlocks(text) {
  return String(text || '')
    .replace(THINKING_BLOCK_RE, '')
    .replace(FENCED_THINKING_RE, '')
    .replace(/^\s*\[thinking\][^\n]*\n?/gim, '')
    .trim();
}

function extractBalancedJson(str, startIdx) {
  if (str[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return str.slice(startIdx, i + 1);
      }
    }
  }
  return null;
}

function normalizeToolCall(text) {
  const raw = stripThinkingBlocks(text);
  const idx = raw.search(/TOOL\s*:/i);
  if (idx < 0) return { text: raw, tool: null };

  let i = idx;
  while (i < raw.length && raw[i] !== '{') i++;
  if (raw[i] !== '{') return { text: raw, tool: null };

  const jsonStr = extractBalancedJson(raw, i);
  if (!jsonStr) return { text: raw, tool: null };

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.name) {
      return {
        text: raw,
        tool: { name: String(parsed.name), args: parsed.args || parsed.arguments || {} }
      };
    }
  } catch {
    const repaired = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/'/g, '"');
    try {
      const parsed = JSON.parse(repaired);
      if (parsed?.name) {
        return { text: raw, tool: { name: String(parsed.name), args: parsed.args || {} } };
      }
    } catch { /* ignore */ }
  }
  return { text: raw, tool: null };
}

function normalizeAgentResponse(text) {
  const { text: cleaned, tool } = normalizeToolCall(text);
  return { content: cleaned, tool };
}

module.exports = {
  stripThinkingBlocks,
  normalizeToolCall,
  normalizeAgentResponse,
  extractBalancedJson
};
