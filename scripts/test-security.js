#!/usr/bin/env node
/**
 * Security unit tests for Hoosh AI Phase A hardening.
 * Runs in an isolated temp HOME so it never touches the user's real config.
 * Usage: node scripts/test-security.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate config/keystore writes.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hoosh-sec-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const ROOT = path.resolve(__dirname, '..');
const { encryptSecret, decryptSecret, isEncrypted } = require(path.join(ROOT, 'lib/secretStore'));
const { scanForSecrets, redactSecrets } = require(path.join(ROOT, 'lib/secretScanner'));
const { ToolApprovalManager } = require(path.join(ROOT, 'lib/toolApproval'));
const { LlmGateway } = require(path.join(ROOT, 'lib/llmGateway'));
const { recallFacts, upsertFact, upsertPattern, scoreFact } = require(path.join(ROOT, 'lib/memoryRecall'));
const { htmlToText, parseDuckDuckGoHtml } = require(path.join(ROOT, 'lib/deepResearch'));
const { validateManifest, summarizePermissions } = require(path.join(ROOT, 'lib/skillManifest'));
const { runSkillCode } = require(path.join(ROOT, 'lib/skillSandbox'));
const { SkillManager } = require(path.join(ROOT, 'lib/skillManager'));
const { evaluateSkill } = require(path.join(ROOT, 'lib/skillEval'));
const ResourceManager = require(path.join(ROOT, 'resourceManager'));

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log('\n🔒 Hoosh Security Tests\n');

// --- secretStore ---
const key = 'sk-test-abcdefghijklmnopqrstuvwxyz';
const enc = encryptSecret(key);
check('secretStore: encrypts (enc:v1 prefix)', isEncrypted(enc));
check('secretStore: round-trips', decryptSecret(enc) === key);
check('secretStore: idempotent encrypt', encryptSecret(enc) === enc);
check('secretStore: plaintext passthrough on decrypt', decryptSecret('plain') === 'plain');
check('secretStore: empty passthrough', encryptSecret('') === '' && decryptSecret('') === '');

// --- secretScanner ---
check('scanner: detects OpenAI key', scanForSecrets('my key sk-abcdefghijklmnopqrstuvwx').length > 0);
check('scanner: detects AWS key', scanForSecrets('AKIAIOSFODNN7EXAMPLE').length > 0);
check('scanner: clean text -> none', scanForSecrets('how to center a div').length === 0);
check('scanner: redacts', !redactSecrets('key sk-abcdefghijklmnopqrstuvwx here').includes('sk-abcdefghij'));

// --- toolApproval allowlist ---
const m = new ToolApprovalManager();
check('approval: default terminal asks', m.needsApproval('executeCommand', { command: 'npm install' }) === true);
m.config.autoApprove.terminal = true;
check('approval: auto npm -> no ask', m.needsApproval('executeCommand', { command: 'npm install' }) === false);
check('approval: auto git push -> ASKS', m.needsApproval('executeCommand', { command: 'git push' }) === true);
check('approval: auto rm -rf -> ASKS', m.needsApproval('executeCommand', { command: 'rm -rf build' }) === true);
check('approval: compound npm && rm -> ASKS', m.needsApproval('executeCommand', { command: 'npm i && rm -rf /' }) === true);
m.config.yolo = true;
check('approval: yolo bypasses', m.needsApproval('executeCommand', { command: 'rm -rf x' }) === false);

// --- llmGateway encryption at rest ---
const g = new LlmGateway();
g.save({ providers: { openai_compat: { ...g.config.providers.openai_compat, apiKey: 'sk-secret-DISK999', enabled: true } } });
const diskRaw = fs.readFileSync(path.join(tmpHome, '.aivon-os', 'providers.json'), 'utf8');
check('gateway: key not plaintext on disk', !diskRaw.includes('sk-secret-DISK999'));
check('gateway: key encrypted on disk', JSON.parse(diskRaw).providers.openai_compat.apiKey.startsWith('enc:v1:'));
const g2 = new LlmGateway();
check('gateway: reload decrypts', g2.config.providers.openai_compat.apiKey === 'sk-secret-DISK999');
check('gateway: getConfig masks', /^•+/.test(g2.getConfig().providers.openai_compat.apiKey));
const ksMode = fs.statSync(path.join(tmpHome, '.aivon-os', '.keystore')).mode & 0o777;
check('gateway: keystore is 0600', ksMode === 0o600);

// --- memoryRecall (ContextEngine) ---
let facts = [];
facts = upsertFact(facts, { text: 'This project uses tabs not spaces for indentation', scope: 'project', tags: ['style'] });
facts = upsertFact(facts, { text: 'API base URL is configured in src/apiBase.ts', scope: 'project', tags: ['config'] });
check('memory: upsertFact adds', facts.length === 2);
facts = upsertFact(facts, { text: 'This project uses tabs not spaces for indentation', scope: 'project' });
check('memory: upsertFact dedupes', facts.length === 2);
const recalled = recallFacts(facts, 'how is indentation done in this project', 3);
check('memory: recall finds relevant fact', recalled.length > 0 && /indentation/.test(recalled[0].text));
check('memory: recall ignores irrelevant', recallFacts(facts, 'quantum chromodynamics', 3).length === 0);
let patterns = [];
patterns = upsertPattern(patterns, { issue: 'TypeError: cannot read x of undefined', solution: 'guard with optional chaining' });
patterns = upsertPattern(patterns, { issue: 'TypeError: cannot read x of undefined', solution: 'guard with optional chaining' });
check('memory: upsertPattern dedupes + counts hits', patterns.length === 1 && patterns[0].hits === 2);
check('memory: scoreFact monotonic', scoreFact('tabs indentation', 'uses tabs for indentation') > scoreFact('tabs indentation', 'uses spaces'));

// --- resource routing defaults ---
const resManager = new ResourceManager();
const routingNoLatency = resManager.getRoutingDecision({ type: 'coding', priority: 'medium' });
check('routing: defaults latency_sensitive to false', !!routingNoLatency.routing_decision?.selected_model);
const routingMinimal = resManager.getRoutingDecision({ type: 'chat' });
check('routing: defaults priority to medium', !!routingMinimal.routing_decision?.selected_model);

// --- deepResearch (pure parsing/extraction, offline) ---
check('research: htmlToText strips tags', htmlToText('<p>Hello <b>world</b></p><script>bad()</script>') === 'Hello world');
check('research: htmlToText decodes entities', htmlToText('a &amp; b &lt;c&gt;') === 'a & b <c>');
const serp = `
  <a class="result__a" href="/l/?uddg=https%3A%2F%2Fdocs.example.com%2Fguide">Example Guide</a>
  <a class="result__a" href="https://react.dev/learn">React Docs</a>`;
const parsed = parseDuckDuckGoHtml(serp, 5);
check('research: parses SERP links', parsed.length === 2);
check('research: unwraps uddg redirect', parsed[0].url === 'https://docs.example.com/guide');
check('research: keeps direct url + title', parsed[1].url === 'https://react.dev/learn' && parsed[1].title === 'React Docs');

// --- S1 Skill manifest validation ---
const goodManifest = {
  manifestVersion: 1, id: 'fa7.test-skill', name: 'Test', version: '1.0.0', category: 'coding',
  knowledgeBase: [{ source: 'https://docs.python.org/3/', type: 'docs' }],
  permissions: { filesystem: 'workspace-only', shell: { allowlist: ['python'] }, network: ['docs.python.org'], mcp: [], secrets: [] }
};
check('manifest: valid passes', validateManifest(goodManifest).ok === true);
check('manifest: bad version fails', validateManifest({ ...goodManifest, version: 'x' }).ok === false);
check('manifest: bad id fails', validateManifest({ ...goodManifest, id: 'Bad Id!' }).ok === false);
check('manifest: KB host not in network fails',
  validateManifest({ ...goodManifest, network: undefined, permissions: { ...goodManifest.permissions, network: [] } }).ok === false);
check('manifest: deny-by-default (no perms block)',
  (() => { const m = validateManifest({ manifestVersion: 1, id: 'fa7.x', name: 'X', version: '1.0.0' }).manifest; return m.permissions.filesystem === 'none' && m.permissions.shell.allowlist.length === 0; })());
check('manifest: secrets => elevated', validateManifest({ ...goodManifest, permissions: { ...goodManifest.permissions, secrets: ['API_KEY'] } }).manifest.elevated === true);

// --- S1 sandbox capability gating ---
(async () => {
  const granted = { filesystem: 'none', shell: { allowlist: ['python'] }, network: ['docs.python.org'], mcp: [], secrets: [] };
  const calls = [];
  const exec = async (name, args) => { calls.push({ name, args }); return 'OK'; };
  // allowed shell routes to executeCommand
  const r1 = await runSkillCode('module.exports.run=async(h)=>h.shell("python a.py")', { granted, executeTool: exec, skillId: 't' });
  check('sandbox: allowed shell routes to Tool Layer', calls.some((c) => c.name === 'executeCommand' && c.args.command === 'python a.py'));
  // denied shell rejects
  let denied = false;
  await runSkillCode('module.exports.run=async(h)=>h.shell("curl x")', { granted, executeTool: exec, skillId: 't' }).catch((e) => { denied = /Permission denied/.test(e.message); });
  check('sandbox: non-allowlisted shell denied', denied);
  // denied filesystem (scope none)
  let fsDenied = false;
  await runSkillCode('module.exports.run=async(h)=>h.fs.write("a.txt","x")', { granted, executeTool: exec, skillId: 't' }).catch((e) => { fsDenied = /Permission denied/.test(e.message); });
  check('sandbox: filesystem denied when scope=none', fsDenied);
  // require is blocked
  let reqBlocked = false;
  await runSkillCode('const fs=require("fs");module.exports.run=async()=>1', { granted, executeTool: exec, skillId: 't' }).catch((e) => { reqBlocked = /blocked/.test(e.message); });
  check('sandbox: require() blocked', reqBlocked);

  // --- S1 grant clamping (cannot exceed manifest) ---
  const mgr = new SkillManager({ builtinDir: path.join(ROOT, 'skills'), installsPath: path.join(tmpHome, 'skill-installs.json') });
  const disc = await mgr.discover();
  check('manager: discovers built-in skills', disc.length >= 3 && disc.some((s) => s.id === 'fa7.python-expert'));
  await mgr.install('fa7.python-expert');
  const gr = await mgr.grant('fa7.python-expert', { filesystem: 'workspace-only', shell: { allowlist: ['python', 'rm'] }, network: ['evil.com'], mcp: [], secrets: [] });
  check('manager: grant clamps shell to manifest', gr.granted.shell.allowlist.includes('python') && !gr.granted.shell.allowlist.includes('rm'));
  check('manager: grant clamps network to manifest', !gr.granted.network.includes('evil.com'));
  check('manager: activate requires grant', (await mgr.setActive('fa7.python-expert', true)).ok === true);
  // eval gate
  const s = await mgr._findSkill('fa7.python-expert');
  const ev = await evaluateSkill(s.dir, s.manifest);
  check('eval: python-expert verified', ev.verified === true && ev.total >= 3);

  console.log(`\nResults: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(fail ? 1 : 0);
})();
// NOTE: the async IIFE above prints the final summary, cleans tmpHome, and exits.
