const PAGE_SOURCE = 'hoosh-web';
const BRIDGE_SOURCE = 'hoosh-local-bridge';

function markReady() {
  if (!document.documentElement) return;
  document.documentElement.dataset.hooshBridge = 'extension';
}

function sendBridgeResponse(id, payload) {
  document.dispatchEvent(
    new CustomEvent('hoosh-bridge-response', {
      detail: { source: BRIDGE_SOURCE, id, ...payload },
    })
  );
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

function injectPageBridge() {
  if (document.documentElement?.dataset?.hooshBridgePage === '1') return;
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge-page.js');
  script.onload = () => {
    script.remove();
    if (document.documentElement) document.documentElement.dataset.hooshBridgePage = '1';
    markReady();
  };
  script.onerror = () => markReady();
  (document.head || document.documentElement).appendChild(script);
}

document.addEventListener('hoosh-bridge-fetch', (event) => {
  const data = event.detail;
  if (!data || data.source !== PAGE_SOURCE || data.type !== 'hoosh-bridge-fetch') return;
  forwardToBackground(data.id, data.payload);
});

injectPageBridge();
markReady();
pingCompanion();
window.setInterval(pingCompanion, 10000);

window.addEventListener('DOMContentLoaded', () => {
  injectPageBridge();
  markReady();
  pingCompanion();
});

document.dispatchEvent(new CustomEvent('hoosh-bridge-response', {
  detail: { source: BRIDGE_SOURCE, type: 'hoosh-bridge-ready' },
}));
