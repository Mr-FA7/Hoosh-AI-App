/** In-process bus + SSE fan-out for agent pointer/keyboard/screen actions. */

const subscribers = new Set();
let lastAction = null;
const history = [];
const HISTORY_MAX = 120;

function normalizeAction(action = {}) {
  return {
    ts: Date.now(),
    ...action,
    type: String(action.type || 'status')
  };
}

function emitAgentVisualAction(action) {
  const payload = normalizeAction(action);
  lastAction = payload;
  history.push(payload);
  if (history.length > HISTORY_MAX) history.shift();

  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(line);
    } catch {
      subscribers.delete(res);
    }
  }
  return payload;
}

function subscribeAgentVisualActions(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  subscribers.add(res);
  res.write(': connected\n\n');
  if (lastAction) {
    res.write(`data: ${JSON.stringify(lastAction)}\n\n`);
  }
  reqOnClose(res, () => subscribers.delete(res));
}

function reqOnClose(res, fn) {
  res.on('close', fn);
  res.on('error', fn);
}

function getAgentVisualHistory(limit = 40) {
  const n = Math.max(1, Math.min(HISTORY_MAX, Number(limit) || 40));
  return history.slice(-n);
}

function clearAgentVisualHistory() {
  history.length = 0;
  lastAction = null;
}

module.exports = {
  emitAgentVisualAction,
  subscribeAgentVisualActions,
  getAgentVisualHistory,
  clearAgentVisualHistory
};
