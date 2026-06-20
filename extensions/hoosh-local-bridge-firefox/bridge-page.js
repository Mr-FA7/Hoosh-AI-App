(function () {
  if (window.__HOOSH_BRIDGE_PAGE__) return;
  window.__HOOSH_BRIDGE_PAGE__ = true;

  const PAGE_SOURCE = 'hoosh-web';
  const BRIDGE_SOURCE = 'hoosh-local-bridge';

  function markReady() {
    if (document.documentElement) {
      document.documentElement.dataset.hooshBridge = 'extension';
    }
  }

  markReady();

  document.addEventListener('hoosh-bridge-response', (event) => {
    const detail = event.detail;
    if (!detail) return;
    window.postMessage(detail, '*');
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== PAGE_SOURCE || data.type !== 'hoosh-bridge-fetch') return;
    document.dispatchEvent(new CustomEvent('hoosh-bridge-fetch', { detail: data }));
  });

  window.postMessage({ source: BRIDGE_SOURCE, type: 'hoosh-bridge-ready' }, '*');
})();
