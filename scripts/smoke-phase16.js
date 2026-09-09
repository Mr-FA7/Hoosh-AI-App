#!/usr/bin/env node
/** Phase 16 smoke — hits Runtime health/capabilities; skips if companion down. */
const axios = require('axios');
const BASE = process.env.HOOSH_API || 'http://127.0.0.1:3001';

(async () => {
  const checks = [];
  const hit = async (name, fn) => {
    try {
      await fn();
      checks.push({ name, ok: true });
      console.log('✓', name);
    } catch (e) {
      checks.push({ name, ok: false, error: e.message });
      console.log('✗', name, e.message);
    }
  };

  try {
    await axios.get(`${BASE}/api/v3/runtime/health`, { timeout: 2000 });
  } catch {
    console.log('SKIP: companion not running at', BASE);
    process.exit(0);
  }

  await hit('health', () => axios.get(`${BASE}/api/v3/runtime/health`));
  await hit('capabilities', () => axios.get(`${BASE}/api/v3/runtime/capabilities`));
  await hit('doctor', () => axios.get(`${BASE}/api/v3/runtime/doctor`));
  await hit('tools-registry', () => axios.get(`${BASE}/api/v3/tools/registry`));
  await hit('devices', () => axios.get(`${BASE}/api/v3/runtime/devices`));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} ok`);
  process.exit(failed.length ? 1 : 0);
})();
