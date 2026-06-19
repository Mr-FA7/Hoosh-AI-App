const PAGE_SOURCE = 'hoosh-web';
const BRIDGE_SOURCE = 'hoosh-local-bridge';

function markReady() {
  if (!document.documentElement) return;
  document.documentElement.dataset.hooshBridge = 'extension';
}

function sendBridgeResponse(id, payload) {
  window.postMessage({ source: BRIDGE_SOURCE, id, ...payload }, window.location.origin);
}

function forwardToBackground(id, payload) {
  const deliver = (response) => {
    if (chrome.runtime.lastError) {
      sendBridgeResponse(id, {
        ok: false,
        error: chrome.runtime.lastError.message || 'Extension bridge unavailable — refresh this page',
      });
      return;
    }
    sendBridgeResponse(id, {
      ok: Boolean(response?.ok),
      result: response?.result,
      error: response?.error,
    });
  };

  try {
    chrome.runtime.sendMessage({ type: 'hoosh-bridge-fetch', payload }, deliver);
  } catch (err) {
    sendBridgeResponse(id, { ok: false, error: err?.message || String(err) });
  }
}

function pingCompanion() {
  try {
    chrome.runtime.sendMessage({ type: 'hoosh-bridge-ping' }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        delete document.documentElement.dataset.hooshBridgeCompanion;
        return;
      }
      document.documentElement.dataset.hooshBridgeCompanion = 'ok';
    });
  } catch {
    delete document.documentElement.dataset.hooshBridgeCompanion;
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== PAGE_SOURCE || data.type !== 'hoosh-bridge-fetch') return;
  forwardToBackground(data.id, data.payload);
});

markReady();
pingCompanion();
window.setInterval(pingCompanion, 10000);

window.addEventListener('DOMContentLoaded', () => {
  markReady();
  pingCompanion();
});

window.postMessage({ source: BRIDGE_SOURCE, type: 'hoosh-bridge-ready' }, window.location.origin);
