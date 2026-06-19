const PAGE_SOURCE = 'hoosh-web';
const BRIDGE_SOURCE = 'hoosh-local-bridge';

function markReady() {
  document.documentElement.dataset.hooshBridge = 'extension';
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== PAGE_SOURCE || data.type !== 'hoosh-bridge-fetch') return;

  chrome.runtime.sendMessage(
    { type: 'hoosh-bridge-fetch', payload: data.payload },
    (response) => {
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          id: data.id,
          ok: response?.ok,
          result: response?.result,
          error: response?.error,
        },
        '*'
      );
    }
  );
});

markReady();
window.addEventListener('DOMContentLoaded', markReady);
