function setCompanion(ok) {
  const dot = document.getElementById('dot');
  const label = document.getElementById('companion');
  dot.className = 'dot ' + (ok ? 'ok' : 'bad');
  label.textContent = ok ? 'Companion connected' : 'Companion not running — run installer';
}

function checkCompanion() {
  chrome.runtime.sendMessage({ type: 'hoosh-bridge-ping' }, (response) => {
    if (chrome.runtime.lastError) { setCompanion(false); return; }
    setCompanion(Boolean(response?.ok));
  });
}

checkCompanion();
setInterval(checkCompanion, 5000);

document.getElementById('openSite').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://aihoosh.com/' });
});

document.getElementById('recheck').addEventListener('click', checkCompanion);
