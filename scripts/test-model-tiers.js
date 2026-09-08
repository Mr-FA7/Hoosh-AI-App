#!/usr/bin/env node
/**
 * Model-tier selection tests.
 *
 * Hoosh runs on many different machines with different installed models, so
 * tier selection must be DISCOVERY based — never hardcoded model names and
 * never tuned to one developer's RAM. These tests stub Ollama's /api/tags and
 * pin the reported RAM so the ranking is deterministic.
 */
const http = require('http');
const path = require('path');
const AgentKernel = require(path.join(__dirname, '..', 'kernel.js'));

const GB = 1024 * 1024 * 1024;
let pass = 0;
let fail = 0;
const check = (name, ok) => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};

function serveTags(models) {
  return new Promise((resolve) => {
    const s = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ models }));
    });
    s.listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}

async function tiersFor(models, ramMB, policy) {
  const { server, url } = await serveTags(models);
  try {
    const k = new AgentKernel(process.cwd(), url, null);
    k.resManager = { getHardwareStats: () => ({ hardware: { ram: { total: ramMB } } }) };
    if (policy) k.setModelPolicy(policy);
    return await k._pickLocalTiers();
  } finally {
    server.close();
  }
}

(async () => {
  console.log('\n🧩 Model tier selection\n');

  const mixed = [
    { name: 'qwen2.5:0.5b', size: 0.4 * GB },
    { name: 'llama3.2:3b', size: 2.0 * GB },
    { name: 'qwen2.5-coder:7b', size: 4.7 * GB },
    { name: 'deepseek-coder:33b', size: 19.5 * GB }
  ];

  const small = await tiersFor(mixed, 8192);
  check('8GB machine does not pick a 19.5GB model', small.heavy !== 'deepseek-coder:33b');
  check('8GB machine still picks something usable', !!small.heavy);

  const mid = await tiersFor(mixed, 24576);
  check('24GB machine prefers the mid-size coder', mid.heavy === 'qwen2.5-coder:7b');

  const big = await tiersFor(mixed, 65536);
  check('64GB machine can use the large coder', big.heavy === 'deepseek-coder:33b');

  check('light tier is the smallest installed model', small.light === 'qwen2.5:0.5b' && big.light === 'qwen2.5:0.5b');

  // Models this codebase has never heard of must still work.
  const exotic = [
    { name: 'phi4:14b', size: 9.1 * GB },
    { name: 'granite3:2b', size: 1.6 * GB }
  ];
  const unknown = await tiersFor(exotic, 65536);
  check('unknown model names are ranked by size', unknown.heavy === 'phi4:14b' && unknown.light === 'granite3:2b');

  // Offline/user policy must constrain both tiers.
  const restricted = await tiersFor(mixed, 24576, ['llama3.2:3b']);
  check('model policy restricts both tiers', restricted.heavy === 'llama3.2:3b' && restricted.light === 'llama3.2:3b');

  const none = await tiersFor([], 16384);
  check('no installed models yields no tiers (caller falls back)', none.light === null && none.heavy === null);

  console.log(`\nResults: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  process.exit(fail ? 1 : 0);
})();
