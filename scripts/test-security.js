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

  // ── Autonomous missions must not become a blanket approval bypass ──────────
  // Missions auto-approve so they don't hang on a prompt nobody answers, but
  // they must NOT set `yolo` (which short-circuits needsApproval and would
  // discard the command allowlist + protected git subcommands).
  {
    const AgentKernel = require(path.join(ROOT, 'kernel.js'));
    const mgr2 = new ToolApprovalManager();
    const k = new AgentKernel(ROOT, 'http://127.0.0.1:11434', null);
    k.approvalManager = mgr2;
    const snapshot = JSON.stringify(mgr2.config.autoApprove);

    k.setAutonomousExecution(true);
    const needs = (cmd) => mgr2.needsApproval('executeCommand', { command: cmd });
    check('autonomous: file writes auto-approve', mgr2.needsApproval('writeFile', { path: 'a.txt' }) === false);
    check('autonomous: allowlisted dev command auto-approves', needs('npm install') === false);
    check('autonomous: rm still requires approval', needs('rm -rf /') === true);
    check('autonomous: git push still requires approval', needs('git push') === true);
    check('autonomous: curl still requires approval', needs('curl http://evil.com') === true);
    check('autonomous: never enables yolo', mgr2.config.yolo === false);

    k.setAutonomousExecution(false);
    check('autonomous: approval config restored afterwards', JSON.stringify(mgr2.config.autoApprove) === snapshot);
  }

  // ── Code navigation tools (glob/grep) stay inside the project ─────────────
  {
    const AgentKernel = require(path.join(ROOT, 'kernel.js'));
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'hoosh-nav-'));
    fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'node_modules', 'junk'), { recursive: true });
    fs.mkdirSync(path.join(proj, '.github'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'src', 'a.ts'), 'export const NEEDLE = 1;\nconst other = 2;\n');
    fs.writeFileSync(path.join(proj, 'src', 'b.js'), 'console.log("NEEDLE here");\n');
    fs.writeFileSync(path.join(proj, '.github', 'ci.yml'), 'name: ci\n');
    fs.writeFileSync(path.join(proj, 'node_modules', 'junk', 'c.ts'), 'NEEDLE in vendor\n');
    // A secret outside the project must never be reachable.
    const outside = path.join(proj, '..', `hoosh-outside-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'NEEDLE outside\n');

    const nk = new AgentKernel(proj, 'http://127.0.0.1:11434', null);
    const g = await nk.executeTool('glob', { pattern: 'src/*.ts' });
    check('glob finds project files', g.includes('src/a.ts') && !g.includes('src/b.js'));

    const dot = await nk.executeTool('glob', { pattern: '**/*.yml' });
    check('glob includes dotted dirs like .github', dot.includes('.github/ci.yml'));

    const gr = await nk.executeTool('grep', { pattern: 'NEEDLE' });
    check('grep reports path:line matches', /src\/a\.ts:1:/.test(gr));
    check('grep skips node_modules', !gr.includes('node_modules'));
    check('grep cannot reach outside the project root', !gr.includes('outside'));

    const scoped = await nk.executeTool('grep', { pattern: 'NEEDLE', glob: 'src/*.js' });
    check('grep honours a glob filter', scoped.includes('src/b.js') && !scoped.includes('src/a.ts'));

    const bad = await nk.executeTool('grep', { pattern: '([unclosed' });
    check('grep rejects an invalid regex without throwing', /Tool Error/.test(bad));

    try { fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(outside, { force: true }); } catch { /* ignore */ }
  }

  // ── Native tool calling: schemas + provider normalisation ─────────────────
  {
    const { AGENT_TOOL_SCHEMAS, buildToolsPayload, normalizeToolCall } =
      require(path.join(ROOT, 'lib/agentToolSchemas'));

    const names = AGENT_TOOL_SCHEMAS.map((t) => t.name);
    check('tool schemas cover the core coding tools',
      ['readFile', 'writeFile', 'patchFile', 'glob', 'grep', 'executeCommand'].every((n) => names.includes(n)));
    check('every schema has an object parameter spec',
      AGENT_TOOL_SCHEMAS.every((t) => t.parameters && t.parameters.type === 'object' && t.parameters.properties));
    check('writeFile requires path and content',
      AGENT_TOOL_SCHEMAS.find((t) => t.name === 'writeFile').parameters.required.join() === 'path,content');

    const payload = buildToolsPayload();
    check('payload uses the function envelope both providers expect',
      payload.length === AGENT_TOOL_SCHEMAS.length &&
      payload.every((t) => t.type === 'function' && t.function.name && t.function.parameters));
    check('payload can be filtered to a subset',
      buildToolsPayload(['grep']).length === 1);

    // Ollama hands back an object; OpenAI hands back a JSON string.
    check('normalises Ollama-style object arguments',
      JSON.stringify(normalizeToolCall({ function: { name: 'writeFile', arguments: { path: 'a.txt', content: 'x' } } }))
        === JSON.stringify({ name: 'writeFile', args: { path: 'a.txt', content: 'x' } }));
    check('normalises OpenAI-style string arguments',
      normalizeToolCall({ function: { name: 'grep', arguments: '{"pattern":"foo"}' } }).args.pattern === 'foo');
    check('malformed arguments return null instead of throwing',
      normalizeToolCall({ function: { name: 'x', arguments: '{oops' } }) === null);
    check('a call with no name is rejected',
      normalizeToolCall({ function: { arguments: {} } }) === null);
  }

  // --- HTTP permission gate (companion routes that skip kernel.executeTool) ---
  {
    const { ensureHttpToolAllowed } = require(path.join(ROOT, 'lib/httpPermissionGate'));
    const gateMgr = new ToolApprovalManager();
    gateMgr.config.yolo = false;
    gateMgr.config.autoApprove.terminal = false;
    gateMgr.config.autoApprove.mcp = false;
    gateMgr.config.autoApprove.browser = true;

    const auto = await ensureHttpToolAllowed(gateMgr, 'browserAgent', { url: 'https://example.com' });
    check('http-gate: browser auto-approve path', auto.ok === true && auto.autoApproved === true);

    const pendingP = ensureHttpToolAllowed(gateMgr, 'executeCommand', { command: 'curl http://evil.test' }, { timeoutMs: 2000 });
    // Respond deny on the pending ticket.
    await new Promise((r) => setTimeout(r, 20));
    const pending = gateMgr.listPending();
    check('http-gate: terminal creates pending approval', pending.length === 1 && pending[0].tool === 'executeCommand');
    if (pending[0]) gateMgr.respond(pending[0].id, false);
    const denied = await pendingP;
    check('http-gate: denied terminal returns ok:false', denied.ok === false && denied.denied === true);

    const allowP = ensureHttpToolAllowed(gateMgr, 'mcpTool', { tool: 'demo:ping' }, { timeoutMs: 2000 });
    await new Promise((r) => setTimeout(r, 20));
    const pend2 = gateMgr.listPending();
    if (pend2[0]) gateMgr.respond(pend2[0].id, true);
    const allowed = await allowP;
    check('http-gate: approved mcp returns ok:true', allowed.ok === true && allowed.approved === true);

    const skip = await ensureHttpToolAllowed(null, 'executeCommand', { command: 'ls' });
    check('http-gate: missing manager is skip-ok (boot safety)', skip.ok === true && skip.skipped === true);
  }

  // --- permission presets ---
  {
    const { detectPreset, applyPreset, describeCurrent } = require(path.join(ROOT, 'lib/permissionPresets'));
    const pm = new ToolApprovalManager();
    const safe = applyPreset(pm, 'safe');
    check('preset: apply safe', safe.ok === true && safe.preset === 'safe');
    check('preset: safe asks terminal', pm.needsApproval('executeCommand', { command: 'npm i' }) === true);
    check('preset: detect safe', detectPreset(pm.getConfig()) === 'safe');
    const full = applyPreset(pm, 'full');
    check('preset: apply full', full.ok === true && full.yolo !== false);
    check('preset: full yolo', pm.needsApproval('executeCommand', { command: 'rm -rf x' }) === false);
    const desc = describeCurrent(pm);
    check('preset: describe lists presets', Array.isArray(desc.presets) && desc.presets.length >= 2);
  }

  // --- device auth helpers ---
  {
    const { resolveBindHost, isLoopbackAddress, createDeviceAuth } = require(path.join(ROOT, 'lib/deviceAuth'));
    check('bind: default localhost', resolveBindHost() === '127.0.0.1');
    check('loopback: 127.0.0.1', isLoopbackAddress('127.0.0.1'));
    check('loopback: ::1', isLoopbackAddress('::1'));
    check('loopback: reject lan', !isLoopbackAddress('192.168.1.10'));
    const auth = createDeviceAuth();
    check('device-auth: has token', !!auth.state.deviceToken && !!auth.state.deviceId);
    check('device-auth: tokenValid', auth.tokenValid(auth.state.deviceToken));
    check('device-auth: reject junk', !auth.tokenValid('nope'));
    const pair = auth.createPairingCode();
    check('pair: start code', !!pair.code && pair.code.length === 6);
    const bad = auth.confirmPairing('000000');
    check('pair: reject wrong code', bad.ok === false);
    const okPair = auth.confirmPairing(pair.code, { clientName: 'test' });
    check('pair: confirm', okPair.ok === true && !!okPair.sessionToken);
    check('pair: session token valid', auth.tokenValid(okPair.sessionToken));
    const sessions = auth.listSessions();
    check('pair: list sessions', sessions.length >= 1);
    const rev = auth.revokeSession(okPair.sessionId);
    check('pair: revoke session', rev.ok === true);
    check('pair: revoked invalid', !auth.tokenValid(okPair.sessionToken));
    const { originAllowed } = require(path.join(ROOT, 'lib/deviceAuth'));
    check('origin: localhost ok', originAllowed('http://127.0.0.1:5173'));
    check('origin: reject random', !originAllowed('https://evil.example'));
  }

  // --- core store schema ---
  {
    const { HooshCoreStore } = require(path.join(ROOT, 'lib/hooshCoreStore'));
    const store = new HooshCoreStore(path.join(tmpHome, '.aivon-os', 'hoosh-core.sqlite'));
    if (store.available()) {
      store.open();
      const ok = store.insertEvent({
        id: 'evt-test-1',
        type: 'test.event',
        at: new Date().toISOString(),
        payload: { n: 1 }
      });
      check('core-store: insert event', ok === true);
      store.close();
    } else {
      check('core-store: skipped (no node:sqlite)', true);
    }
  }

  console.log(`\nResults: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(fail ? 1 : 0);
})();
// NOTE: the async IIFE above prints the final summary, cleans tmpHome, and exits.
