/**
 * Minimal 5-field cron matcher (minute hour dom month dow) — no external deps.
 */
function parseField(field, min, max) {
  const f = String(field || '').trim();
  if (f === '*') return () => true;
  if (f.startsWith('*/')) {
    const step = Number(f.slice(2));
    if (!step) return () => false;
    return (v) => v % step === 0;
  }
  if (f.includes(',')) {
    const set = new Set(f.split(',').map((x) => Number(x.trim())));
    return (v) => set.has(v);
  }
  if (f.includes('-')) {
    const [a, b] = f.split('-').map((x) => Number(x.trim()));
    return (v) => v >= a && v <= b;
  }
  const n = Number(f);
  return (v) => v === n;
}

function cronMatches(expr, date = new Date()) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length < 5) return false;
  const checks = [
    parseField(parts[0], 0, 59)(date.getMinutes()),
    parseField(parts[1], 0, 23)(date.getHours()),
    parseField(parts[2], 1, 31)(date.getDate()),
    parseField(parts[3], 1, 12)(date.getMonth() + 1),
    parseField(parts[4], 0, 6)(date.getDay())
  ];
  return checks.every(Boolean);
}

function scheduleCron(expr, onTick) {
  let lastMinute = '';
  const timer = setInterval(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (key === lastMinute) return;
    if (cronMatches(expr, now)) {
      lastMinute = key;
      onTick(now);
    }
  }, 15000);
  return () => clearInterval(timer);
}

module.exports = { cronMatches, scheduleCron };
