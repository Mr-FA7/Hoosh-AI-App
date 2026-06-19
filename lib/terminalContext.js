const MAX_BUFFER = 100000;

function stripAnsi(text) {
  return String(text || '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\r/g, '');
}

function appendScrollback(existing, chunk) {
  const next = `${existing || ''}${stripAnsi(chunk)}`;
  if (next.length <= MAX_BUFFER) return next;
  return next.slice(next.length - MAX_BUFFER);
}

function formatTerminalContext({ buffer, selection, purpose, cwd, sessionName, lastCommand, lastExitCode, commandOutput }) {
  const parts = ['## Terminal context'];
  if (sessionName) parts.push(`Session: ${sessionName}`);
  if (purpose) parts.push(`Purpose: ${purpose}`);
  if (cwd) parts.push(`CWD: ${cwd}`);
  if (lastCommand) parts.push(`Last command: \`${lastCommand}\``);
  if (lastExitCode != null && lastExitCode !== '') parts.push(`Exit code: ${lastExitCode}`);
  if (selection && selection.trim()) {
    parts.push('\n### Selected output\n```\n' + selection.trim().slice(0, 12000) + '\n```');
  }
  if (commandOutput && commandOutput.trim()) {
    parts.push('\n### Last command output\n```\n' + commandOutput.trim().slice(0, 12000) + '\n```');
  }
  const buf = (buffer || '').trim();
  if (buf) {
    parts.push('\n### Recent terminal output (last lines)\n```\n' + buf.slice(-16000) + '\n```');
  }
  if (!selection?.trim() && !buf && !commandOutput?.trim()) {
    parts.push('\n(no terminal output captured yet — run a command in the AI or User terminal)');
  }
  return parts.join('\n');
}

module.exports = {
  MAX_BUFFER,
  stripAnsi,
  appendScrollback,
  formatTerminalContext
};
