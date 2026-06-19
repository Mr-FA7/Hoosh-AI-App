#!/usr/bin/env node
/**
 * Hoosh AI smoke test — run against companion on :3001
 * Usage: node scripts/smoke-test.js [--base http://localhost:3001]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1]
  || process.env.HOOSH_API_BASE
  || 'http://localhost:3001';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  return { status: res.status, json, text, headers: res.headers };
}

async function readNdjsonStream(res, maxLines = 30, timeoutMs = 25000) {
  const lines = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const deadline = Date.now() + timeoutMs;
  const isTerminal = (l) => {
    const ev = l?.agent_event;
    return !!(ev?.done || ev?.type === 'finish' || ev?.type === 'done' || ev?.type === 'error');
  };
  const readWithTimeout = (ms) => Promise.race([
    reader.read(),
    new Promise((resolve) => setTimeout(() => resolve({ done: false, value: undefined, timedOut: true }), ms))
  ]);
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const chunk = await readWithTimeout(remaining);
    if (chunk.timedOut) break;
    if (chunk.done) break;
    if (!chunk.value) continue;
    buf += decoder.decode(chunk.value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() || '';
    for (const line of parts) {
      const t = line.trim();
      if (!t) continue;
      try { lines.push(JSON.parse(t)); } catch { lines.push({ _parseError: t.slice(0, 120) }); }
      if (isTerminal(lines[lines.length - 1])) break;
    }
    if (lines.some(isTerminal)) break;
    if (lines.length >= maxLines) break;
  }
  try { reader.cancel(); } catch { /* ignore */ }
  return lines;
}

async function waitForServer(maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await req('GET', '/api/v3/system/information');
      if (r.status === 200) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

async function main() {
  console.log(`\n🔥 Hoosh AI Smoke Test — ${BASE}\n`);

  if (!(await waitForServer())) {
    fail('Server reachable', 'companion not responding on :3001');
    printSummary();
    process.exit(1);
  }
  pass('Server reachable');

  // System
  const sys = await req('GET', '/api/v3/system/information');
  if (sys.status === 200 && sys.json) pass('GET /system/information');
  else fail('GET /system/information', `status ${sys.status}`);

  // Test project
  const testRoot = path.join(os.tmpdir(), `hoosh-smoke-${Date.now()}`);
  fs.mkdirSync(testRoot, { recursive: true });
  const sampleFile = path.join(testRoot, 'hello.js');
  fs.writeFileSync(sampleFile, `export function greet(name) {\n  return 'Hello ' + name;\n}\n`, 'utf8');

  const open = await req('POST', '/api/v3/project/open', { path: testRoot });
  if (open.status === 200 && open.json?.ok) pass('POST /project/open', testRoot);
  else fail('POST /project/open', open.json?.error || open.text?.slice(0, 120));

  const projPath = await req('GET', '/api/v3/project/path');
  if (projPath.json?.path === testRoot) pass('GET /project/path');
  else fail('GET /project/path', String(projPath.json?.path));

  // Indexing + agent config
  const idx = await req('GET', '/api/v3/indexing/config');
  if (idx.status === 200 && idx.json?.vectorBackend) pass('GET /indexing/config', `fts=${idx.json.ftsBackend}`);
  else fail('GET /indexing/config');

  const agCfg = await req('GET', '/api/v3/agent/config');
  if (agCfg.status === 200 && typeof agCfg.json?.deferWrites === 'boolean') {
    pass('GET /agent/config', `deferWrites=${agCfg.json.deferWrites}`);
  } else fail('GET /agent/config');

  const agSave = await req('POST', '/api/v3/agent/config', { deferWrites: true, autoCommit: true });
  if (agSave.json?.ok) pass('POST /agent/config');
  else fail('POST /agent/config');

  // Agent sessions
  const sessCreate = await req('POST', '/api/v3/agent-sessions', { title: 'Smoke Test Session' });
  const sessionId = sessCreate.json?.session?.id;
  if (sessionId) pass('POST /agent-sessions', sessionId);
  else fail('POST /agent-sessions', sessCreate.text?.slice(0, 100));

  if (sessionId) {
    const msg = await req('POST', `/api/v3/agent-sessions/${sessionId}/messages`, {
      message: { role: 'user', content: 'smoke ping', at: new Date().toISOString() }
    });
    if (msg.json?.ok) pass('POST /agent-sessions/:id/messages');
    else fail('POST /agent-sessions/:id/messages');
  }

  // LSP
  const sampleContent = fs.readFileSync(sampleFile, 'utf8');
  const lspComp = await req('POST', '/api/v3/lsp/completion', {
    filePath: 'hello.js', line: 1, character: 10, content: sampleContent
  });
  if (lspComp.status === 200 && Array.isArray(lspComp.json?.items)) pass('POST /lsp/completion', `${lspComp.json.items.length} items`);
  else fail('POST /lsp/completion');

  const lspHover = await req('POST', '/api/v3/lsp/hover', {
    filePath: 'hello.js', line: 1, character: 15, content: sampleContent
  });
  if (lspHover.status === 200) pass('POST /lsp/hover');
  else fail('POST /lsp/hover');

  const lspDef = await req('POST', '/api/v3/lsp/definition', {
    filePath: 'hello.js', line: 1, character: 15, content: sampleContent
  });
  if (lspDef.status === 200) pass('POST /lsp/definition');
  else fail('POST /lsp/definition');

  // Extensions
  const langs = await req('GET', '/api/v3/extensions/languages');
  if (langs.status === 200 && Array.isArray(langs.json?.languages)) pass('GET /extensions/languages', `${langs.json.languages.length} langs`);
  else fail('GET /extensions/languages');

  const themes = await req('GET', '/api/v3/extensions/themes');
  if (themes.status === 200 && Array.isArray(themes.json?.themes)) pass('GET /extensions/themes', `${themes.json.themes.length} themes`);
  else fail('GET /extensions/themes');

  // ACP
  const acp = await req('GET', '/api/v3/acp/backends');
  if (acp.status === 200 && Array.isArray(acp.json?.backends)) pass('GET /acp/backends');
  else fail('GET /acp/backends');

  // Chat fast-path (greeting — no Ollama required)
  try {
    const chatRes = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
        model: 'mistral',
        mode: 'ask',
        allowedModels: ['mistral'],
        sessionId
      })
    });
    if (chatRes.ok) {
      const lines = await readNdjsonStream(chatRes, 10, 8000);
      const hasContent = lines.some((l) => l?.message?.content || l?.agent_event?.type === 'done');
      if (hasContent) pass('POST /ai/chat greeting fast-path', `${lines.length} NDJSON lines`);
      else fail('POST /ai/chat greeting fast-path', 'empty stream');
    } else fail('POST /ai/chat greeting', `status ${chatRes.status}`);
  } catch (e) {
    fail('POST /ai/chat greeting', e.message);
  }

  // Mission stream (may need Ollama — report gracefully)
  try {
    const missionRes = await fetch(`${BASE}/api/v3/mission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'Add a one-line comment to hello.js', projectName: '' })
    });
    if (missionRes.ok) {
      const lines = await readNdjsonStream(missionRes, 200, 60000);
      const types = [...new Set(lines.map((l) => l?.agent_event?.type).filter(Boolean))];
      const hasPlan = types.includes('plan') || types.includes('status') || types.includes('mission_name');
      const hasDone = types.includes('done') || types.includes('finish') || types.includes('error')
        || lines.some((l) => l?.agent_event?.done);
      if (hasPlan) pass('POST /v3/mission stream started', types.slice(0, 8).join(', '));
      else fail('POST /v3/mission stream', `events: ${types.join(', ') || 'none'}`);
      if (hasDone) pass('POST /v3/mission terminal event');
      else fail('POST /v3/mission terminal event', 'no finish/done within timeout (Ollama may be offline)');
    } else {
      fail('POST /v3/mission', `status ${missionRes.status}`);
    }
  } catch (e) {
    fail('POST /v3/mission', e.message);
  }

  // Session assistant message after chat
  if (sessionId) {
    const sessGet = await req('GET', `/api/v3/agent-sessions/${sessionId}`);
    const msgs = sessGet.json?.session?.messages || [];
    const hasAssistant = msgs.some((m) => m.role === 'assistant');
    const hasUser = msgs.some((m) => m.role === 'user');
    if (hasUser) pass('Session has user message');
    else fail('Session has user message');
    if (hasAssistant) pass('Session has assistant message (backend sync)');
    else fail('Session has assistant message', 'chat greeting may not persist assistant on fast-path — check companion');
  }

  // Phase 6 APIs
  const catalog = await req('GET', '/api/v3/mcp/catalog');
  if (catalog.status === 200 && Array.isArray(catalog.json?.catalog)) pass('GET /mcp/catalog', `${catalog.json.catalog.length} items`);
  else fail('GET /mcp/catalog');

  const engines = await req('GET', '/api/v3/engines/matrix');
  if (engines.status === 200 && Array.isArray(engines.json?.engines)) pass('GET /engines/matrix', `${engines.json.engines.length} engines`);
  else fail('GET /engines/matrix');

  const skills = await req('GET', '/api/v3/skills/match?q=test');
  if (skills.status === 200 && Array.isArray(skills.json?.skills)) pass('GET /skills/match');
  else fail('GET /skills/match');

  const tools = await req('GET', '/api/v3/approval/tools');
  if (tools.status === 200 && Array.isArray(tools.json?.tools)) pass('GET /approval/tools', `${tools.json.tools.length} tools`);
  else fail('GET /approval/tools');

  const termBind = await req('POST', '/api/v3/terminals/agent-bind', { sessionId: sessionId || 'smoke-test' });
  if (termBind.json?.ok && termBind.json?.terminalName) pass('POST /terminals/agent-bind', termBind.json.terminalName);
  else fail('POST /terminals/agent-bind', termBind.text?.slice(0, 80));

  const lintRun = await req('POST', '/api/v3/lint/run', { files: [] });
  if (lintRun.status === 200) pass('POST /lint/run');
  else fail('POST /lint/run');

  const termSync = await req('POST', '/api/v3/context/terminal/sync', {
    buffer: 'smoke test output\n',
    selection: 'smoke test output',
    purpose: 'ai',
    sessionName: termBind.json?.terminalName
  });
  if (termSync.json?.ok) pass('POST /context/terminal/sync');
  else fail('POST /context/terminal/sync', termSync.text?.slice(0, 80));

  const termCtx = await req('GET', `/api/v3/context/terminal?sessionId=${encodeURIComponent(sessionId || 'smoke-test')}&buffer=client`);
  if (termCtx.json?.ok && String(termCtx.json?.content || '').includes('Terminal context')) {
    pass('GET /context/terminal');
  } else fail('GET /context/terminal', termCtx.text?.slice(0, 80));

  const probSync = await req('POST', '/api/v3/context/problems/sync', {
    markers: [{ resource: 'smoke.ts', message: 'test error', severity: 8, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }],
    activeFile: 'smoke.ts'
  });
  if (probSync.json?.ok) pass('POST /context/problems/sync');
  else fail('POST /context/problems/sync');

  const probWorkspace = await req('POST', '/api/v3/context/problems/sync', {
    files: [
      { path: 'a.ts', markers: [{ resource: 'a.ts', message: 'a', severity: 4, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }] },
      { path: 'b.ts', markers: [{ resource: 'b.ts', message: 'b', severity: 8, startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2 }] }
    ]
  });
  if (probWorkspace.json?.ok && probWorkspace.json?.fileCount >= 2) pass('POST /context/problems/sync workspace');
  else fail('POST /context/problems/sync workspace', probWorkspace.text?.slice(0, 80));

  const grammars = await req('GET', '/api/v3/extensions/grammars');
  if (grammars.json?.grammars?.length) pass('GET /extensions/grammars builtin');
  else fail('GET /extensions/grammars builtin');

  const gramJs = await req('GET', '/api/v3/extensions/grammar/javascript');
  if (gramJs.json?.content?.includes('scopeName') || gramJs.json?.scopeName) pass('GET /extensions/grammar/javascript');
  else fail('GET /extensions/grammar/javascript', gramJs.text?.slice(0, 80));

  const fcc = await req('GET', '/api/v3/fcc/status');
  if (fcc.json?.ok && fcc.json?.endpoints?.length) pass('GET /fcc/status');
  else fail('GET /fcc/status');

  const themeConv = await req('POST', '/api/v3/extensions/themes/convert', {
    theme: { type: 'dark', tokenColors: [{ scope: 'comment', settings: { foreground: '#6A9955' } }] }
  });
  if (themeConv.json?.ok && themeConv.json?.monaco?.rules) pass('POST /extensions/themes/convert');
  else fail('POST /extensions/themes/convert', themeConv.text?.slice(0, 80));

  const probCtx = await req('GET', '/api/v3/context/problems');
  if (probCtx.json?.ok && String(probCtx.json?.content || '').includes('Problems')) pass('GET /context/problems');
  else fail('GET /context/problems', probCtx.text?.slice(0, 80));

  const docsCtx = await req('GET', '/api/v3/context/docs?q=readme');
  if (docsCtx.json?.ok && String(docsCtx.json?.content || '').includes('Documentation')) pass('GET /context/docs');
  else fail('GET /context/docs', docsCtx.text?.slice(0, 80));

  const docsList = await req('GET', '/api/v3/docs/list');
  if (docsList.status === 200 && Array.isArray(docsList.json?.sources)) pass('GET /docs/list');
  else fail('GET /docs/list');

  const probList = await req('GET', '/api/v3/context/problems/list');
  if (probList.json?.ok !== false) pass('GET /context/problems/list');
  else fail('GET /context/problems/list');

  const engHealth = await req('GET', '/api/v3/engines/health');
  if (engHealth.json?.ok && Array.isArray(engHealth.json?.health)) pass('GET /engines/health');
  else fail('GET /engines/health');

  const provCatalog = await req('GET', '/api/v3/providers/catalog');
  if (provCatalog.json?.ok && provCatalog.json?.catalog?.length) pass('GET /providers/catalog');
  else fail('GET /providers/catalog');

  const provHealth = await req('GET', '/api/v3/providers/health');
  if (provHealth.json?.ok && Array.isArray(provHealth.json?.health)) pass('GET /providers/health');
  else fail('GET /providers/health');

  const extCmds = await req('GET', '/api/v3/extensions/commands');
  if (extCmds.json?.ok && extCmds.json?.commands?.length) pass('GET /extensions/commands');
  else fail('GET /extensions/commands');

  const cmdExec = await req('POST', '/api/v3/extensions/commands/execute', { command: 'hoosh.docs.refresh' });
  if (cmdExec.json?.ok) pass('POST /extensions/commands/execute');
  else fail('POST /extensions/commands/execute', cmdExec.text?.slice(0, 80));

  const lspStatus = await req('GET', '/api/v3/lsp/status');
  if (lspStatus.json?.ok && Array.isArray(lspStatus.json?.servers)) pass('GET /lsp/status');
  else fail('GET /lsp/status');

  const extAct = await req('GET', '/api/v3/extensions/activations');
  if (extAct.json?.ok && Array.isArray(extAct.json?.activations)) pass('GET /extensions/activations');
  else fail('GET /extensions/activations');

  const lmTools = await req('GET', '/api/v3/lm/tools');
  if (lmTools.json?.ok && lmTools.json?.tools?.length) pass('GET /lm/tools');
  else fail('GET /lm/tools');

  const mcpGw = await req('GET', '/api/v3/mcp/gateway/catalog');
  if (mcpGw.json?.ok && Array.isArray(mcpGw.json?.tools)) pass('GET /mcp/gateway/catalog');
  else fail('GET /mcp/gateway/catalog');

  const workspace = await req('GET', '/api/v3/workspace');
  if (workspace.json?.ok && Array.isArray(workspace.json?.folders) && workspace.json.folders.length >= 1) {
    pass('GET /workspace', `${workspace.json.folders.length} folders`);
  } else fail('GET /workspace', workspace.text?.slice(0, 80));

  const extraDir = path.join(testRoot, 'extra-lib');
  fs.mkdirSync(extraDir, { recursive: true });
  const addWs = await req('POST', '/api/v3/workspace/folders', { path: extraDir, name: 'extra-lib' });
  if (addWs.json?.ok && addWs.json.folders?.length >= 2) {
    pass('POST /workspace/folders add', `${addWs.json.folders.length} folders`);
  } else fail('POST /workspace/folders add', addWs.text?.slice(0, 80));

  const filesMulti = await req('GET', '/api/v3/files');
  if (Array.isArray(filesMulti.json) && filesMulti.json.length >= 2 && filesMulti.json.every((e) => e.isDirectory)) {
    pass('GET /files multi-root roots', `${filesMulti.json.length} roots`);
  } else fail('GET /files multi-root roots', JSON.stringify(filesMulti.json).slice(0, 80));

  fs.writeFileSync(path.join(extraDir, 'token.js'), 'export const SMOKE_MULTIROOT_TOKEN = true;\n');
  const extDir = path.join(testRoot, '.fa7', 'extensions', 'smoke-ext');
  fs.mkdirSync(extDir, { recursive: true });
  fs.writeFileSync(path.join(extDir, 'package.json'), JSON.stringify({
    name: 'smoke-ext',
    main: 'extension.js',
    activationEvents: ['onStartupFinished'],
    contributes: { commands: [{ command: 'smoke.hello', title: 'Smoke Hello' }] }
  }));
  fs.writeFileSync(path.join(extDir, 'extension.js'), `exports.activate = function(ctx) {
  const vscode = require('vscode');
  const disp = vscode.commands.registerCommand('smoke.hello', function() { return 'hello-sandbox'; });
  ctx.subscriptions.push(disp);
};`);

  const rescan = await req('POST', '/api/v3/index/rescan');
  if (rescan.json?.ok && rescan.json.fileCount >= 2) pass('POST /index/rescan multi-root', `${rescan.json.fileCount} files`);
  else fail('POST /index/rescan multi-root', rescan.text?.slice(0, 80));

  const idxStatus = await req('GET', '/api/v3/index/status');
  const hasExtra = (idxStatus.json?.samplePaths || []).some((p) => String(p).startsWith('extra-lib:'));
  if (idxStatus.json?.ok && (hasExtra || idxStatus.json.fileCount >= 2)) pass('GET /index/status multi-root');
  else fail('GET /index/status multi-root', JSON.stringify(idxStatus.json).slice(0, 80));

  const sandboxAct = await req('POST', '/api/v3/extensions/sandbox/activate');
  if (sandboxAct.json?.ok) pass('POST /extensions/sandbox/activate');
  else fail('POST /extensions/sandbox/activate', sandboxAct.text?.slice(0, 80));

  const smokeCmd = await req('POST', '/api/v3/extensions/commands/execute', { command: 'smoke.hello' });
  if (smokeCmd.json?.ok && smokeCmd.json?.sandbox) pass('POST /extensions sandbox command');
  else fail('POST /extensions sandbox command', smokeCmd.text?.slice(0, 80));

  const extRuntime = await req('GET', '/api/v3/extensions/runtime');
  if (extRuntime.json?.ok && extRuntime.json?.contributions) pass('GET /extensions/runtime');
  else fail('GET /extensions/runtime', extRuntime.text?.slice(0, 80));

  const wvReg = await req('POST', '/api/v3/extensions/webviews/register', {
    id: 'smoke-test-panel',
    html: '<html><body>smoke</body></html>',
    extension: 'hoosh'
  });
  if (wvReg.json?.ok && wvReg.json?.webview?.id === 'smoke-test-panel') pass('POST /extensions/webviews/register');
  else fail('POST /extensions/webviews/register', wvReg.text?.slice(0, 80));

  const wvGet = await req('GET', '/api/v3/extensions/webviews/smoke-test-panel');
  if (wvGet.json?.ok && wvGet.json?.webview?.html?.includes('smoke')) pass('GET /extensions/webviews/:id');
  else fail('GET /extensions/webviews/:id', wvGet.text?.slice(0, 80));

  if (provCatalog.json?.catalog?.length >= 100) pass('GET /providers/catalog 100+', `${provCatalog.json.catalog.length} providers`);
  else fail('GET /providers/catalog 100+', `${provCatalog.json?.catalog?.length || 0} providers`);

  const extKb = await req('GET', '/api/v3/extensions/keybindings?editorTextFocus=1');
  if (extKb.json?.ok && Array.isArray(extKb.json?.active)) pass('GET /extensions/keybindings when-clause');
  else fail('GET /extensions/keybindings when-clause', extKb.text?.slice(0, 80));

  const completionSrv = await req('POST', '/api/v3/completion/server', { prefix: 'const ', suffix: '', fileName: 'smoke.ts' });
  if (completionSrv.status === 200 && completionSrv.json?.ok !== false) pass('POST /completion/server');
  else fail('POST /completion/server', completionSrv.text?.slice(0, 80));

  // Project memory (ContextEngine remember/recall)
  const memWrite = await req('POST', '/api/v3/memory', { text: 'Smoke test project uses Vite + React', tags: ['smoke'] });
  if (memWrite.json?.ok) pass('POST /memory (remember)');
  else fail('POST /memory (remember)', memWrite.text?.slice(0, 80));

  const memRecall = await req('GET', '/api/v3/memory?q=what%20build%20tool%20does%20this%20project%20use');
  if (memRecall.json?.ok && Array.isArray(memRecall.json.facts) && memRecall.json.facts.some((f) => /Vite/.test(f.text))) {
    pass('GET /memory?q (recall)');
  } else fail('GET /memory?q (recall)', memRecall.text?.slice(0, 80));

  // Skill system (S1)
  const skillCat = await req('GET', '/api/v3/skill/catalog');
  if (skillCat.json?.ok && Array.isArray(skillCat.json.skills) && skillCat.json.skills.some((s) => s.id === 'fa7.python-expert')) {
    pass('GET /skill/catalog', `${skillCat.json.skills.length} skills`);
  } else fail('GET /skill/catalog', skillCat.text?.slice(0, 80));

  const skillEval = await req('GET', '/api/v3/skill/fa7.python-expert/eval');
  if (skillEval.json?.ok && skillEval.json.verified === true) pass('GET /skill/:id/eval', `${skillEval.json.passed}/${skillEval.json.total} verified`);
  else fail('GET /skill/:id/eval', skillEval.text?.slice(0, 80));

  const skInstall = await req('POST', '/api/v3/skill/fa7.deep-research/install');
  if (skInstall.json?.ok) pass('POST /skill/:id/install'); else fail('POST /skill/:id/install', skInstall.text?.slice(0, 80));
  const skGrant = await req('POST', '/api/v3/skill/fa7.deep-research/grant', {});
  if (skGrant.json?.ok) pass('POST /skill/:id/grant'); else fail('POST /skill/:id/grant', skGrant.text?.slice(0, 80));
  const skActivate = await req('POST', '/api/v3/skill/fa7.deep-research/activate', { active: true });
  if (skActivate.json?.ok && skActivate.json.active) pass('POST /skill/:id/activate'); else fail('POST /skill/:id/activate', skActivate.text?.slice(0, 80));

  const audit = await req('GET', '/api/v3/audit');
  if (audit.json?.ok && Array.isArray(audit.json.entries) && audit.json.entries.some((e) => e.action === 'skill.activate')) {
    pass('GET /audit (skill-attributed)');
  } else fail('GET /audit', audit.text?.slice(0, 80));

  // Cleanup
  try { fs.rmSync(testRoot, { recursive: true, force: true }); } catch { /* ignore */ }

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n────────────────────────────────`);
  console.log(`Results: ${ok} passed, ${bad} failed (${results.length} total)`);
  if (bad) {
    console.log('\nFailed:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  • ${r.name}: ${r.detail || 'failed'}`);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
