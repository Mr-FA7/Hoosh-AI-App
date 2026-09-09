const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const AgentKernel = require('./kernel');
const Indexer = require('./indexer');
const OllamaManager = require('./ollamaManager');
const SystemHealth = require('./systemHealth');
const ResourceManager = require('./resourceManager');
const NegahAgent = require('./negahAgent');
const NegahRunner = require('./negahRunner');
const { buildComposeArtifacts } = require('./composeBuildPipeline');
const GitHubManager = require('./githubManager');
const companionOllama = require('./companionOllamaRuntime');
const companionShellPty = require('./companionShellPty');
const { mountStudioRoutes } = require('./companionStudioDev');
const { mountOllamaPullRoutes } = require('./companionOllamaPull');
const { mountOllamaApiProxyRoutes } = require('./companionOllamaApiProxy');
const { mountUatRoutes } = require('./companionUatMount');
const { mountVmLabRoutes } = require('./companionVmLab');
const { mountStacksRoutes } = require('./companionStacks');
const { mountFlowRoutes } = require('./companionFlows');
const { mountMediaRoutes } = require('./companionMedia');
const { FlowEngine } = require('./lib/flowEngine');
const { listFlows } = require('./lib/flowStore');
const { maybeAutoStartStack } = require('./lib/stackAutoStart');
const { readDevProfile } = require('./lib/hooshDevProfile');
const { downloadOllamaRuntimeIntoUserData } = require('./companionOllamaRuntimeDownload');
const { loadFa7Plugins } = require('./companionFa7Plugins');
const { KavoshBrowserKernel } = require('./kavoshBrowserKernel');
const { GiraBdtmKernel } = require('./giraBdtmKernel');
const { McpManager } = require('./lib/mcpManager');
const {
  loadRules,
  loadSkills,
  selectRulesForContext,
  matchSkillsForQuery,
  buildRulesPrompt,
  buildSkillsPrompt,
  ensureDefaults
} = require('./lib/rulesSkills');
const { CheckpointManager } = require('./lib/checkpointManager');
const { LlmGateway } = require('./lib/llmGateway');
const { ToolApprovalManager } = require('./lib/toolApproval');
const { ensureHttpToolAllowed } = require('./lib/httpPermissionGate');
const auditLog = require('./lib/auditLog');
const { SkillManager } = require('./lib/skillManager');
const { evaluateSkill } = require('./lib/skillEval');
const { runSkillCode } = require('./lib/skillSandbox');
const { compactMessages, compactWithLlm } = require('./lib/contextCompaction');
const gitWorkspace = require('./lib/gitWorkspace');
const { VectorIndex } = require('./lib/vectorIndex');
const { LanceVectorIndex } = require('./lib/lanceVectorIndex');
const { SandboxRunner } = require('./lib/sandboxRunner');
const { LspBridge } = require('./lib/lspBridge');
const { AcpAdapter } = require('./lib/acpAdapter');
const { listExtensionLanguages, listExtensionGrammars, listExtensionThemes } = require('./lib/extensionBridge');
const { SqliteFtsIndex, sqliteFtsAvailable } = require('./lib/sqliteFtsIndex');
const { SubagentRunner } = require('./lib/subagentRunner');
const { FtsIndex } = require('./lib/ftsIndex');
const { tryFastPath } = require('./lib/fastPath');
const { fuseCandidates } = require('./lib/completionFusion');
const { AgentSessions } = require('./lib/agentSessions');
const { AgentAutomation } = require('./lib/agentAutomation');
const { HitlGraph } = require('./lib/hitlGraph');
const { StreamRegistry } = require('./lib/streamRegistry');
const { GatherMode } = require('./lib/gatherMode');
const { mountAgentServer } = require('./lib/agentServer');
const { listCatalog, applyCatalogToConfig } = require('./lib/mcpCatalog');
const { getEngineMatrix, suggestRoleRouting } = require('./lib/engineMatrix');
const { runPostEditChecks } = require('./lib/lintRunner');
const { normalizeAgentResponse } = require('./lib/toolNormalizer');
const { formatTerminalContext } = require('./lib/terminalContext');
const problemsContext = require('./lib/problemsContext');
const docsContext = require('./lib/docsContext');
const { mountFccProxyRoutes } = require('./lib/fccProxy');
const { getBuiltinGrammar } = require('./lib/builtinGrammars');
const { convertVscodeTheme } = require('./lib/themeConverter');
const { runPlaywrightInSandbox } = require('./lib/sandboxPlaywright');
const { listExtensionCommands, executeCommand, listExtensionActivations, listExtensionKeybindings, listContributions, registerWebview, getWebview, filterKeybindings } = require('./lib/extensionHost');
const { WorkspaceManager } = require('./lib/workspaceManager');
const { resolveListRequest, resolveReadPath } = require('./lib/workspacePaths');
const { activateAll, sandboxStatus, clearSandbox } = require('./lib/extensionSandbox');
const { McpGateway } = require('./lib/mcpGateway');
const { collectTools, toOpenAIFunctions, toAnthropicTools, invokeTool } = require('./lib/lmToolProtocol');
const { CompletionServer } = require('./lib/completionServer');
const { runBrowserAgent } = require('./lib/browserAgentLoop');
const { emitAgentVisualAction, subscribeAgentVisualActions, getAgentVisualHistory } = require('./lib/agentActionHub');
const { getCatalog, applyCatalogToProviders, healthCheckAll } = require('./lib/litellmRouter');

const os = require('os');
const PORT = Number(process.env.FA7_PORT) || 3001;
const PTY_WS_PORT = Number(process.env.FA7_PTY_PORT) || 3002;
const SYSTEM_DIR = path.join(os.homedir(), '.aivon-os');
const SANDBOX_CONFIG_PATH = path.join(SYSTEM_DIR, 'sandbox.json');
const INDEX_CONFIG_PATH = path.join(SYSTEM_DIR, 'indexing.json');
  const AGENT_CONFIG_PATH = path.join(SYSTEM_DIR, 'agent.json');
const CONFIG_PATH = path.join(SYSTEM_DIR, 'fa7_config.json');
const RECENT_PATH = path.join(SYSTEM_DIR, 'recent-projects.json');

// Ensure System directory exists
fs.ensureDirSync(SYSTEM_DIR);

function isValidProjectDirectory(dirPath) {
  try {
    const p = path.resolve(String(dirPath));
    if (!fs.existsSync(p)) return false;
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Only restore a project the user explicitly saved — never default to the app install folder. */
function loadInitialProjectRoot() {
  const tryPath = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const p = path.resolve(raw.trim());
    return isValidProjectDirectory(p) ? p : null;
  };

  if (process.env.FA7_PROJECT_ROOT) {
    const fromEnv = tryPath(process.env.FA7_PROJECT_ROOT);
    if (fromEnv) return fromEnv;
  }

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = fs.readJsonSync(CONFIG_PATH);
      const fromConfig = tryPath(config.projectRoot);
      if (fromConfig) return fromConfig;
    } catch (e) {
      console.error('[Config] Failed to load config.json', e);
    }
  }

  return null;
}

function getPtyCwd() {
  return currentProjectRoot || os.homedir();
}

function getServiceRoot() {
  return currentProjectRoot || SYSTEM_DIR;
}

let currentProjectRoot = loadInitialProjectRoot();
let workspaceManager = null;
/** Set from main() once AgentKernel exists — avoids TDZ on module-level getWorkspaceManager */
let agentKernelRef = null;
let indexerRef = null;

async function getWorkspaceManager() {
  if (!currentProjectRoot) {
    workspaceManager = null;
    agentKernelRef?.setWorkspaceManager?.(null);
    if (indexerRef?.setWorkspaceManager) indexerRef.setWorkspaceManager(null);
    return null;
  }
  if (!workspaceManager || workspaceManager.primaryRoot !== path.resolve(currentProjectRoot)) {
    workspaceManager = await WorkspaceManager.load(currentProjectRoot);
    agentKernelRef?.setWorkspaceManager?.(workspaceManager);
    indexerRef?.setWorkspaceManager?.(workspaceManager);
  }
  return workspaceManager;
}
let notebookPath = currentProjectRoot
  ? path.join(currentProjectRoot, '.fa7', 'notebook.md')
  : null;

// Ensure FA7 system directory exists
async function ensureFa7Dir(root) {
    const fa7Dir = path.join(root, '.fa7');
    try {
        await fs.access(fa7Dir);
    } catch {
        await fs.mkdir(fa7Dir, { recursive: true });
    }
}

async function initNotebook(root) {
    const nbPath = path.join(root, '.fa7', 'notebook.md');
    try {
        await fs.access(nbPath);
    } catch {
        const initialContent = `# AI Project Notebook\n\n## Project Context\nInitialized at: ${new Date().toISOString()}\n\n## User Rules\n1. Always follow professional coding standards.\n\n## Completed Tasks\n- [x] Initialized Project\n\n## Future Tasks\n- [ ] Define project requirements\n`;
        await fs.writeFile(nbPath, initialContent, 'utf8');
    }
}

function saveConfig() {
  try {
    if (!currentProjectRoot) {
      if (fs.existsSync(CONFIG_PATH)) fs.removeSync(CONFIG_PATH);
      return;
    }
    fs.writeJsonSync(CONFIG_PATH, { projectRoot: currentProjectRoot }, { spaces: 2 });
  } catch (e) {
    console.error('[Config] Failed to save config.json', e);
  }
}

async function main() {
  const COMPANION_NAME = 'FA7 OS Companion';
  const electron = (() => { try { return require('electron'); } catch { return null; } })();
  const ollamaInfo = await companionOllama.ensureOllamaForCompanion();
  let lastOllamaBootstrap = ollamaInfo;
  const ollamaHttp = () => companionOllama.getActiveOllamaBase();
  console.log('[FA7 OS] Ollama:', ollamaHttp(), '| mode:', ollamaInfo.mode);

  const app = express();
  // Allow aihoosh.com (HTTPS public site) to call localhost directly.
  // Chrome Private Network Access (PNA) requires Access-Control-Allow-Private-Network header.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type,Authorization,X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(bodyParser.json({ limit: '5mb' }));

  mountStudioRoutes(app, { getActiveProjectRoot: () => currentProjectRoot });
  mountOllamaPullRoutes(app);
  mountOllamaApiProxyRoutes(app);
  mountUatRoutes(app);
  mountVmLabRoutes(app);
  mountStacksRoutes(app, () => currentProjectRoot);

  let flowEngine = new FlowEngine({
    getProjectRoot: () => currentProjectRoot,
    getKernel: () => kernel,
    getHitl: () => hitlGraph
  });
  mountFlowRoutes(app, () => currentProjectRoot, () => flowEngine);
  mountMediaRoutes(app, () => currentProjectRoot);

  async function refreshFlowSchedules() {
    if (!currentProjectRoot || !flowEngine) return;
    try {
      const flows = await listFlows(currentProjectRoot);
      flowEngine.refreshSchedules(flows);
    } catch (e) {
      console.warn('[Flows] schedule refresh:', e.message);
    }
  }

  const { port: resolvedPtyPort } = await companionShellPty.startPtyWebSocketServer({
    port: PTY_WS_PORT,
    defaultCwd: getPtyCwd()
  });
  companionShellPty.updateDefaultCwd(getPtyCwd());
  console.log('[FA7 OS] Fard Terminal PTY WebSocket: ws://127.0.0.1:' + resolvedPtyPort);

  const bootServiceRoot = getServiceRoot();
  let indexer = new Indexer(bootServiceRoot);
  indexerRef = indexer;
  let kernel = new AgentKernel(bootServiceRoot, ollamaHttp(), indexer);
  agentKernelRef = kernel;
  let engine = new OllamaManager(bootServiceRoot, ollamaHttp());
  const negah = new NegahAgent(ollamaHttp());
  const negahRunner = new NegahRunner(getPtyCwd());
  const github = new GitHubManager({
    systemDir: SYSTEM_DIR,
    getProjectRoot: () => currentProjectRoot
  });
  const health = new SystemHealth({ systemDir: SYSTEM_DIR });
  const resManager = new ResourceManager();
  const kavoshKernel = new KavoshBrowserKernel();
  const giraKernel = new GiraBdtmKernel();
  const mcpManager = new McpManager();
  const mcpGateway = new McpGateway(mcpManager);
  const llmGateway = new LlmGateway(() => ollamaHttp());
  mountFccProxyRoutes(app, () => llmGateway);
  kernel.setLlmGateway(llmGateway);
  const toolApproval = new ToolApprovalManager();
  const skillManager = new SkillManager({ projectRoot: currentProjectRoot });

  // Build active Skills' system-prompt block and push it into the kernel (S1).
  async function refreshSkillPrompts() {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const active = await skillManager.activeSkills();
      const blocks = [];
      for (const s of active) {
        let prompt = '';
        if (s.manifest.systemPrompt) {
          try { prompt = await fs.readFile(path.join(s.dir, s.manifest.systemPrompt), 'utf8'); } catch { /* ignore */ }
        }
        if (prompt.trim()) blocks.push(`### Skill: ${s.manifest.name}\n${prompt.trim()}`);
      }
      const text = blocks.length ? `## Active Skills:\n${blocks.join('\n\n')}` : '';
      if (kernel.setSkillPrompts) kernel.setSkillPrompts(text);
    } catch (e) {
      console.warn('[Skills] refresh prompts failed:', e.message);
    }
  }
  const acpAdapter = new AcpAdapter();
  let vectorIndex = null;
  let lanceIndex = null;
  let lspBridge = null;
  let sandboxRunner = new SandboxRunner(bootServiceRoot, { enabled: false });

  function loadSandboxConfig() {
    try {
      if (fs.existsSync(SANDBOX_CONFIG_PATH)) {
        const cfg = fs.readJsonSync(SANDBOX_CONFIG_PATH);
        sandboxRunner = new SandboxRunner(currentProjectRoot || bootServiceRoot, cfg);
        kernel.setSandboxRunner(sandboxRunner);
        return cfg;
      }
    } catch { /* ignore */ }
    return {
      enabled: false,
      image: 'node:20-bookworm-slim',
      playwrightImage: 'mcr.microsoft.com/playwright:v1.49.0-jammy'
    };
  }

  async function applyDevProfileSandbox() {
    if (!currentProjectRoot) return;
    try {
      const { profile } = await readDevProfile(currentProjectRoot);
      if (!profile?.sandbox) return;
      const base = loadSandboxConfig();
      const merged = {
        ...base,
        image: profile.sandbox.image || base.image,
        memory: profile.sandbox.memory || base.memory,
        cpus: profile.sandbox.cpus || base.cpus
      };
      sandboxRunner = new SandboxRunner(currentProjectRoot, merged);
      kernel.setSandboxRunner(sandboxRunner);
    } catch (e) {
      console.warn('[Stacks] dev profile sandbox merge skipped:', e.message);
    }
  }

  function getVectorIndex() {
    if (!currentProjectRoot) return null;
    if (!vectorIndex || vectorIndex.projectRoot !== currentProjectRoot) {
      vectorIndex = new VectorIndex(currentProjectRoot, ollamaHttp());
    }
    return vectorIndex;
  }

  function loadAgentConfig() {
    try {
      if (fs.existsSync(AGENT_CONFIG_PATH)) return fs.readJsonSync(AGENT_CONFIG_PATH);
    } catch { /* ignore */ }
    return { deferWrites: true, autoCommit: true };
  }

  function applyAgentConfig(cfg = loadAgentConfig()) {
    if (kernel.setDeferWrites) kernel.setDeferWrites(cfg.deferWrites !== false);
    if (kernel.setAutoCommit) kernel.setAutoCommit(cfg.autoCommit !== false);
    return cfg;
  }

  function loadIndexingConfig() {
    try {
      if (fs.existsSync(INDEX_CONFIG_PATH)) {
        return fs.readJsonSync(INDEX_CONFIG_PATH);
      }
    } catch { /* ignore */ }
    return { vectorBackend: 'json', ftsBackend: 'json' };
  }

  function getLanceIndex() {
    if (!currentProjectRoot) return null;
    if (!lanceIndex || lanceIndex.projectRoot !== currentProjectRoot) {
      const vi = getVectorIndex();
      lanceIndex = new LanceVectorIndex(currentProjectRoot, (text) => vi.embed(text));
    }
    return lanceIndex;
  }

  let ftsIndex = null;
  const streamRegistry = new StreamRegistry();
  const hitlGraph = new HitlGraph();
  let agentSessions = new AgentSessions(currentProjectRoot);
  const agentAutomation = new AgentAutomation();

  function wirePlatformContext() {
    kernel?.setPlatformContext?.({ flowEngine, agentAutomation, hitlGraph });
  }
  wirePlatformContext();

  function getFtsIndex() {
    if (!currentProjectRoot) return null;
    const cfg = loadIndexingConfig();
    const useSqlite = (cfg.ftsBackend === 'sqlite' || (indexer.index?.size || 0) > 800) && sqliteFtsAvailable();
    if (useSqlite) {
      if (!ftsIndex || ftsIndex.projectRoot !== currentProjectRoot || ftsIndex.constructor.name !== 'SqliteFtsIndex') {
        if (ftsIndex?.close) try { ftsIndex.close(); } catch { /* ignore */ }
        ftsIndex = new SqliteFtsIndex(currentProjectRoot);
        ftsIndex.projectRoot = currentProjectRoot;
        ftsIndex.load().catch(() => {});
      }
      return ftsIndex;
    }
    if (!ftsIndex || ftsIndex.projectRoot !== currentProjectRoot || ftsIndex.constructor.name === 'SqliteFtsIndex') {
      if (ftsIndex?.close) try { ftsIndex.close(); } catch { /* ignore */ }
      ftsIndex = new FtsIndex(currentProjectRoot);
      ftsIndex.projectRoot = currentProjectRoot;
      ftsIndex.load().catch(() => {});
    }
    return ftsIndex;
  }

  function getLspBridge() {
    if (!currentProjectRoot) return null;
    if (!lspBridge || lspBridge.projectRoot !== currentProjectRoot) {
      if (lspBridge) lspBridge.stop();
      lspBridge = new LspBridge(currentProjectRoot);
      listExtensionLanguages(currentProjectRoot).then((langs) => {
        if (lspBridge) lspBridge.setExtensionLanguages(langs);
      }).catch(() => {});
    }
    return lspBridge;
  }

  agentAutomation.setTriggerHandler(async (job) => {
    if (!currentProjectRoot || !job.prompt) return;
    console.log('[Automation] Triggered job', job.id);
    try {
      await kernel.executeAutonomousLoop(job.prompt, { mode: 'agent' });
    } catch (e) {
      console.error('[Automation] Job failed:', e.message);
    }
  });
  const smartWebSearcher = {
    async search(query, opts = {}) {
      const q = String(query || '').trim();
      if (!q) return { ok: false, error: 'query is required', results: [] };
      const limit = Math.max(1, Math.min(10, Number(opts.limit || 5)));
      try {
        // DuckDuckGo Instant Answer JSON endpoint (no API key required).
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
        const r = await axios.get(url, { timeout: 12000 });
        const data = r.data || {};
        const rows = [];
        const pushRow = (item) => {
          if (!item) return;
          const title = String(item.Text || item.Heading || '').trim();
          const href = String(item.FirstURL || item.AbstractURL || '').trim();
          if (!title && !href) return;
          rows.push({
            title: title || href,
            url: href || null,
            snippet: String(item.Result || item.AbstractText || item.Text || '').replace(/<[^>]*>/g, '').trim()
          });
        };
        pushRow({ Heading: data.Heading, AbstractURL: data.AbstractURL, AbstractText: data.AbstractText });
        const stack = Array.isArray(data.RelatedTopics) ? [...data.RelatedTopics] : [];
        while (stack.length) {
          const node = stack.shift();
          if (!node) continue;
          if (Array.isArray(node.Topics)) {
            stack.push(...node.Topics);
            continue;
          }
          pushRow(node);
          if (rows.length >= limit) break;
        }
        return { ok: true, query: q, results: rows.slice(0, limit) };
      } catch (e) {
        return { ok: false, query: q, error: e.message || 'search failed', results: [] };
      }
    }
  };

  const initServices = () => {
    engine.init().then(() => console.log('[Engine] Localized storage ready'));
      kernel.init().then(() => {
        kernel.setApprovalManager(toolApproval);
        kernel.setLlmGateway(llmGateway);
        applyAgentConfig();
        loadSandboxConfig();
        wirePlatformContext();
        applyDevProfileSandbox().then(() => {
          maybeAutoStartStack(currentProjectRoot)
            .then((r) => {
              if (r && !r.skipped && r.ok) {
                console.log(`[Stacks] autoUp ready (${r.preview?.urls?.length || 0} preview URLs)`);
              }
            })
            .catch((e) => console.warn('[Stacks] autoUp:', e.message));
        }).catch(() => {});
        console.log('[Kernel] Ready');
      });
    if (currentProjectRoot) {
      agentSessions.setProjectRoot(currentProjectRoot);
      indexer.scan().then(async () => {
        const vi = getVectorIndex();
        if (vi) {
          indexer.setVectorIndex(vi);
          await vi.load().catch(() => {});
        }
        const fts = getFtsIndex();
        if (fts) {
          indexer.setFtsIndex(fts);
          if (fts.rebuildFromIndexer) fts.rebuildFromIndexer(indexer);
        }
        kernel.indexer = indexer;
        const cfg = loadIndexingConfig();
        const fileCount = indexer.index?.size || 0;
        const useLance = cfg.vectorBackend === 'lancedb' || fileCount > 400;
        if (useLance && vi) {
          try {
            const li = getLanceIndex();
            const needsRebuild = await li.needsRebuild(vi);
            if (needsRebuild) {
              await li.rebuildFromVectorIndex(vi);
              console.log(`[Indexer] LanceDB rebuilt (${fileCount} files)`);
            } else {
              console.log(`[Indexer] LanceDB loaded from cache (${fileCount} files)`);
            }
            indexer.setLanceIndex(li);
            if (cfg.vectorBackend !== 'lancedb') {
              fs.writeJsonSync(INDEX_CONFIG_PATH, { ...cfg, vectorBackend: 'lancedb' }, { spaces: 2 });
            }
            console.log(`[Indexer] LanceDB active (${fileCount} files)`);
          } catch (e) {
            console.warn('[Indexer] LanceDB init skipped:', e.message);
          }
        }
        try {
          const langs = await listExtensionLanguages(currentProjectRoot);
          const bridge = getLspBridge();
          if (bridge) bridge.setExtensionLanguages(langs);
        } catch { /* non-fatal */ }
      });
      ensureDefaults(currentProjectRoot).catch(() => {});
      mcpManager.connectAll(currentProjectRoot).then((tools) => {
        kernel.setMcpManager(mcpManager);
        console.log(`[MCP] ${tools.length} tools available`);
      }).catch((e) => console.warn('[MCP] Init skipped:', e.message));
    }
    agentAutomation.load();
    agentAutomation.startAll();
    refreshFlowSchedules().catch(() => {});
    skillManager.setProjectRoot(currentProjectRoot);
    refreshSkillPrompts();
  };

  mountAgentServer(app, {
    kernel,
    indexer,
    agentSessions,
    hitlGraph,
    getProjectRoot: () => currentProjectRoot
  });

  await github.init();
  await health.init();
  initServices();

  // 🩺 Aivon Medic API Integration
  let lastDiagnosticResult = null;

  app.get('/api/diagnostics', async (req, res) => {
    try {
      // Logic: If cache is fresh (< 30s), return it, else rescanning
      if (lastDiagnosticResult && (Date.now() - lastDiagnosticResult.timestamp < 30000) && !req.query.force) {
        return res.json(lastDiagnosticResult);
      }
      const data = await kernel.runGlobalDiagnostics();
      lastDiagnosticResult = data;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Neural Core Probing Failed: ' + e.message });
    }
  });

  // 🧠 Project memory (ContextEngine remember/recall)
  app.get('/api/v3/memory', (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q) return res.json({ ok: true, facts: kernel.recallProjectFacts(q, Number(req.query.limit) || 5) });
      res.json({
        ok: true,
        facts: kernel.memory?.facts || [],
        learned_patterns: kernel.memory?.learned_patterns || []
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/memory', async (req, res) => {
    try {
      const { text, scope, tags } = req.body || {};
      const r = await kernel.rememberFact(text, { scope, tags });
      res.json(r);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ───────────────────────── Skill system (S1) ─────────────────────────
  app.get('/api/v3/skill/catalog', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      res.json({ ok: true, skills: await skillManager.discover() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/v3/skill/:id/inspect', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      res.json(await skillManager.inspect(req.params.id));
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/v3/skill/:id/eval', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const s = await skillManager._findSkill(req.params.id);
      if (!s) return res.status(404).json({ ok: false, error: 'Skill not found' });
      res.json({ ok: true, ...(await evaluateSkill(s.dir, s.manifest)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/v3/skill/:id/install', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const r = await skillManager.install(req.params.id);
      if (r.ok) auditLog.record(currentProjectRoot, { actor: 'user', action: 'skill.install', skillId: req.params.id });
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/v3/skill/:id/grant', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const r = await skillManager.grant(req.params.id, req.body?.permissions);
      if (r.ok) auditLog.record(currentProjectRoot, { actor: 'user', action: 'skill.grant', skillId: req.params.id, detail: r.summary });
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/v3/skill/:id/activate', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const r = await skillManager.setActive(req.params.id, req.body?.active !== false);
      if (r.ok) { auditLog.record(currentProjectRoot, { actor: 'user', action: r.active ? 'skill.activate' : 'skill.deactivate', skillId: req.params.id }); await refreshSkillPrompts(); }
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/v3/skill/:id/uninstall', async (req, res) => {
    try {
      const r = await skillManager.uninstall(req.params.id);
      auditLog.record(currentProjectRoot, { actor: 'user', action: 'skill.uninstall', skillId: req.params.id });
      await refreshSkillPrompts();
      res.json(r);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Run a Skill's shipped capability code in the sandbox (routes via Tool Layer).
  app.post('/api/v3/skill/:id/run', async (req, res) => {
    try {
      skillManager.setProjectRoot(currentProjectRoot);
      const id = req.params.id;
      const active = await skillManager.activeSkills();
      const entry = active.find((s) => s.manifest.id === id);
      if (!entry) return res.status(400).json({ ok: false, error: 'Skill not active (install → grant → activate first)' });
      if (!entry.manifest.capability) return res.status(400).json({ ok: false, error: 'Skill ships no capability code' });
      const code = await fs.readFile(path.join(entry.dir, entry.manifest.capability), 'utf8');
      const result = await runSkillCode(code, {
        granted: entry.granted,
        skillId: id,
        input: req.body?.input || {},
        executeTool: (name, args) => kernel.executeTool(name, args, null),
        audit: (e) => auditLog.record(currentProjectRoot, { actor: 'skill', action: 'capability', ...e })
      });
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/v3/audit', (req, res) => {
    res.json({ ok: true, entries: auditLog.read(currentProjectRoot, Number(req.query.limit) || 200) });
  });

  app.post('/api/repair', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Diagnostic ID required.' });
      const result = await kernel.applySurgicalRepair(id);
      lastDiagnosticResult = null; // Invalidate cache after repair
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Surgical Repair Failed: ' + e.message });
    }
  });

  app.post('/api/v3/negah/execute', async (req, res) => {
    try {
      if (Array.isArray(req.body?.commands) && req.body.commands.length) {
        const directRun = await negahRunner.runCommands(req.body.commands, {
          cwd: currentProjectRoot,
          onVisual: emitAgentVisualAction
        });
        return res.json({ ok: true, mode: 'direct_runner', ...directRun });
      }
      const startedAt = Date.now();
      const maxIterations = Math.max(1, Math.min(10, Number(req.body?.maxIterations || 4)));
      const trace = [];
      let state = {
        trigger: req.body?.trigger || 'manual',
        human_input: req.body?.human_input || '',
        last_action_status: req.body?.last_action_status || 'none',
        last_action_message: req.body?.last_action_message || '',
        current_screen_base64: req.body?.current_screen_base64 || '',
        elapsed_time_sec: 0
      };

      for (let i = 0; i < maxIterations; i++) {
        state.elapsed_time_sec = Math.floor((Date.now() - startedAt) / 1000);
        const modelResult = await negah.process(state);
        trace.push({ iteration: i + 1, model: modelResult });

        if (modelResult?.agent_resolution) {
          return res.json({
            ok: true,
            iterations: i + 1,
            trace,
            ...modelResult
          });
        }

        const commands = modelResult?.agent_action?.commands;
        if (!Array.isArray(commands) || commands.length === 0) {
          return res.json({
            ok: false,
            error: 'NEGHA_NO_ACTION',
            message: 'Negah returned no executable commands.',
            iterations: i + 1,
            trace
          });
        }

        const runnerResult = await negahRunner.runCommands(commands, {
          cwd: currentProjectRoot,
          onVisual: emitAgentVisualAction
        });
        trace.push({ iteration: i + 1, runner: runnerResult });
        state.last_action_status = runnerResult.status;
        state.last_action_message = runnerResult.summary;
        if (runnerResult.screen_base64) {
          state.current_screen_base64 = runnerResult.screen_base64;
        }
      }

      res.json({
        ok: false,
        error: 'NEGHA_MAX_ITERATIONS',
        message: `Negah did not produce a terminal resolution in ${maxIterations} iterations.`,
        iterations: maxIterations,
        trace
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.post('/api/v3/system/routing', (req, res) => {
    try {
        const payload = req.body && Object.keys(req.body).length ? req.body : { task: req.body?.task };
        const decision = resManager.getRoutingDecision(payload);
        res.json(decision);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v3/system/routing', (req, res) => {
    // Default GET routing for status check
    const stats = resManager.getHardwareStats();
    const decision = resManager.getRoutingDecision({ type: 'chat', priority: 'medium' });
    res.json({ stats, decision });
});

app.get('/api/v3/system/information', (req, res) => {
    const info = resManager.getHardwareStats();
    res.json(info.hardware);
});

app.post('/api/v3/github/config', async (req, res) => {
  try {
    res.json(await github.setClientId(req.body?.client_id || ''));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/v3/github/auth/token', async (req, res) => {
  try {
    const token = req.body?.access_token || '';
    if (!token) return res.status(400).json({ ok: false, error: 'access_token is required' });
    res.json(await github.setAccessToken(token, req.body?.scope || 'repo'));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/v3/github/auth/status', async (req, res) => {
  try {
    res.json(await github.getAuthStatus());
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/v3/github/auth/device/start', async (req, res) => {
  try {
    res.json(await github.startDeviceFlow(req.body?.scopes || ['repo']));
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/v3/github/auth/device/poll', async (req, res) => {
  try {
    res.json(await github.pollDeviceFlow());
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/v3/github/auth/logout', async (req, res) => {
  try {
    res.json(await github.logout());
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/v3/github/repos', async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.private !== 'boolean') body.private = true;
    res.json(await github.createRepository(body));
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message, details: e?.response?.data || null });
  }
});

app.patch('/api/v3/github/repos/:owner/:repo/visibility', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const isPrivate = !!req.body?.private;
    res.json(await github.setRepositoryVisibility(owner, repo, isPrivate));
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message, details: e?.response?.data || null });
  }
});

app.post('/api/v3/github/publish', async (req, res) => {
  try {
    const mode = (req.body?.mode || 'git').toLowerCase();
    const payload = {
      projectRoot: req.body?.projectRoot || currentProjectRoot,
      repoName: req.body?.repoName,
      owner: req.body?.owner,
      description: req.body?.description || '',
      private: typeof req.body?.private === 'boolean' ? req.body.private : true,
      commitMessage: req.body?.commitMessage || 'Initial commit from FA7 OS',
      branch: req.body?.branch || 'main',
      maxFiles: req.body?.maxFiles,
      maxFileBytes: req.body?.maxFileBytes
    };
    if (mode === 'api') {
      return res.json(await github.publishWithApi(payload));
    }
    if (mode === 'git') {
      return res.json(await github.publishWithGit(payload));
    }
    return res.status(400).json({ ok: false, error: "Unsupported mode. Use 'git' or 'api'." });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message, details: e?.response?.data || null });
  }
});

// Ultra-light liveness probe. The site checks this to detect the companion;
// it must answer instantly (system/health spawns toolchain checks and can take
// 10s+, which would blow the 2.5s connection-probe timeout and look "offline").
app.get('/api/v3/ping', (req, res) => {
    res.json({ ok: true, name: 'FA7 OS Companion', port: PORT });
});
app.get('/api/v3/system/health', async (req, res) => {
    res.json(await health.checkAll());
});
app.get('/api/v3/system/custom-tools', async (req, res) => {
    res.json({ ok: true, tools: await health.getCustomTools() });
});

  const HOOSH_VAULT_PATH = path.join(require('os').homedir(), '.hoosh-os', 'tool_vault.json');

  app.get('/api/v3/vault', async (req, res) => {
    try {
      await fs.ensureDir(path.dirname(HOOSH_VAULT_PATH));
      if (!await fs.pathExists(HOOSH_VAULT_PATH)) {
        return res.json({ ok: true, entries: {} });
      }
      const raw = await fs.readJson(HOOSH_VAULT_PATH);
      const entries = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      res.json({ ok: true, entries });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'vault read failed' });
    }
  });

  app.put('/api/v3/vault', async (req, res) => {
    try {
      const entries = req.body?.entries;
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        return res.status(400).json({ ok: false, error: 'entries object required' });
      }
      await fs.ensureDir(path.dirname(HOOSH_VAULT_PATH));
      await fs.writeJson(HOOSH_VAULT_PATH, entries, { spaces: 2 });
      try {
        await kernel.reloadVaultFromDisk();
      } catch (e) {
        console.warn('[Vault] kernel reload after save:', e?.message || e);
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'vault write failed' });
    }
  });

// Legacy support for FileExplorer (to be removed once UI is updated)
app.get('/api/ai/system-stats', (req, res) => {
    const stats = resManager.getHardwareStats();
    res.json({
        gpu: stats.hardware.gpu.vendor === 'apple' ? 'Apple Metal (Active)' : 'Local CPU',
        vram: stats.hardware.ram.total + 'MB',
        latency: 'Normal'
    });
});

  app.post('/api/v3/system/install', async (req, res) => {
    const { name } = req.body;
    res.json(await health.installTool(name));
  });

  app.post('/api/v3/system/uninstall', async (req, res) => {
    const { name } = req.body;
    res.json(await health.uninstallTool(name));
  });

  app.post('/api/v3/system/custom-tools', async (req, res) => {
    res.json(await health.addCustomTool(req.body || {}));
  });

  app.delete('/api/v3/system/custom-tools/:name', async (req, res) => {
    res.json(await health.removeCustomTool(req.params.name));
  });

  app.post('/api/v3/system/install-command', async (req, res) => {
    const { command, source } = req.body || {};
    res.json(await health.runInstallCommand(command, { source }));
  });

  app.get('/api/v3/engine/status', async (req, res) => {
    const st = await engine.getStatus();
    res.json({
      ...st,
      ollamaRuntime: companionOllama.getRuntimeStatus(),
      ollamaBootstrapMode: lastOllamaBootstrap.mode
    });
  });

  app.post('/api/ollama/download-runtime', async (req, res) => {
    try {
      const r = await downloadOllamaRuntimeIntoUserData();
      let ollamaRestarted = false;
      if (!r.cached) {
        const info = await companionOllama.restartManagedOllamaService();
        lastOllamaBootstrap = info;
        kernel.setOllamaUrl(info.url);
        engine.setOllamaApiBase(info.url);
        ollamaRestarted = true;
        console.log('[FA7 OS] Ollama restarted after runtime download:', info.url, '|', info.mode);
      }
      res.json({
        ok: true,
        ...r,
        ollamaRestarted,
        activeOllamaUrl: companionOllama.getActiveOllamaBase(),
        ollamaMode: lastOllamaBootstrap.mode
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Project Management API
  app.get('/api/v3/project/path', async (req, res) => {
    if (!currentProjectRoot) {
      return res.json({ path: null, name: null, folders: [] });
    }
    const wm = await getWorkspaceManager();
    res.json({
      path: currentProjectRoot,
      name: path.basename(currentProjectRoot),
      folders: wm?.list() || [{ name: path.basename(currentProjectRoot), path: currentProjectRoot }]
    });
  });

  app.get('/api/v3/workspace', async (req, res) => {
    try {
      const wm = await getWorkspaceManager();
      if (!wm) return res.json({ ok: true, folders: [] });
      res.json({ ok: true, primary: wm.primaryRoot, folders: wm.list() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/workspace/folders', async (req, res) => {
    try {
      const wm = await getWorkspaceManager();
      if (!wm) return res.status(400).json({ ok: false, error: 'No project open' });
      const folderPath = String(req.body?.path || '');
      const name = req.body?.name ? String(req.body.name) : undefined;
      const folders = await wm.addFolder(folderPath, name);
      indexer.setWorkspaceManager(wm);
      if (typeof indexer.scan === 'function') await indexer.scan().catch(() => {});
      res.json({ ok: true, folders });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.delete('/api/v3/workspace/folders', async (req, res) => {
    try {
      const wm = await getWorkspaceManager();
      if (!wm) return res.status(400).json({ ok: false, error: 'No project open' });
      const folderPath = String(req.body?.path || req.query?.path || '');
      const folders = await wm.removeFolder(folderPath);
      indexer.setWorkspaceManager(wm);
      if (typeof indexer.scan === 'function') await indexer.scan().catch(() => {});
      res.json({ ok: true, folders });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/workspace/resolve', async (req, res) => {
    try {
      const wm = await getWorkspaceManager();
      if (!wm) return res.status(400).json({ ok: false, error: 'No project open' });
      const resolved = wm.resolveFile(req.body?.ref || req.body?.path);
      if (!resolved) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, ...resolved });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/project/close', (req, res) => {
    if (currentProjectRoot) clearSandbox(currentProjectRoot);
    currentProjectRoot = null;
    notebookPath = null;
    workspaceManager = null;
    agentKernelRef?.setWorkspaceManager?.(null);
    saveConfig();
    res.json({ ok: true });
  });

  app.post('/api/v3/project/open', async (req, res) => {
    const { path: newPath } = req.body;
    if (!newPath || !fs.existsSync(newPath)) {
      return res.status(400).json({ error: 'Valid directory path is required' });
    }

    try {
      const stats = await fs.lstat(newPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Selected path is not a directory' });
      }

      currentProjectRoot = path.resolve(newPath);
      notebookPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      await ensureFa7Dir(currentProjectRoot);
      await initNotebook(currentProjectRoot);
      saveConfig();
      saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));

      // Re-initialize services
      indexer = new Indexer(currentProjectRoot);
      indexerRef = indexer;
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
      agentKernelRef = kernel;
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      negahRunner.setProjectRoot(currentProjectRoot);
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      wirePlatformContext();

      initServices();
      await getWorkspaceManager();
      indexer.setWorkspaceManager(workspaceManager);
      if (currentProjectRoot) clearSandbox(currentProjectRoot);
      
      console.log(`[FA7 OS] Switched project root to: ${currentProjectRoot}`);
      refreshFlowSchedules().catch(() => {});
      res.json({ ok: true, path: currentProjectRoot });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Marketplace Proxy (Open VSX)
  app.post('/api/v3/project/build/compose', async (req, res) => {
    try {
      const projectRoot = req.body?.projectRoot ? path.resolve(req.body.projectRoot) : currentProjectRoot;
      const result = await buildComposeArtifacts({
        projectRoot,
        tasks: req.body?.tasks,
        dry_run: !!req.body?.dry_run,
        timeoutMs: req.body?.timeoutMs
      });
      if (!result.ok) {
        return res.status(500).json(result);
      }
      return res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Marketplace Proxy (Open VSX)
  app.get('/api/v3/marketplace/search', async (req, res) => {
    try {
      const { q = '', size = 20, offset = 0 } = req.query;
      console.log(`[Marketplace Proxy] Searching for: "${q}"`);
      const response = await axios.get(`https://open-vsx.org/api/-/search`, {
        params: { 
          query: q, 
          size, 
          offset,
          sortBy: 'relevance',
          sortOrder: 'desc'
        }
      });
      res.json(response.data);
    } catch (e) {
      console.error(`[Marketplace Proxy] Error:`, e.response?.data || e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Marketplace Install
  app.post('/api/v3/marketplace/install', async (req, res) => {
    try {
      const { namespace, name, version, downloadUrl } = req.body;
      if (!downloadUrl) return res.status(400).json({ error: 'No download URL' });

      console.log(`[Marketplace] Installing: ${namespace}.${name}@${version}`);
      
      const extDir = path.join(currentProjectRoot, '.fa7', 'extensions');
      const targetDir = path.join(extDir, `${namespace}.${name}-${version}`);
      
      await fs.ensureDir(extDir);
      
      // Download VSIX
      const tempPath = path.join(extDir, `temp-${Date.now()}.vsix`);
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Extract
      console.log(`[Marketplace] Extracting to: ${targetDir}`);
      const zip = new AdmZip(tempPath);
      // VSIX structure is typically /extension/...
      // We want to extract it so the package.json is at the top of targetDir
      zip.extractAllTo(targetDir, true);
      
      // Cleanup temp
      await fs.remove(tempPath);

      // (Optional) If it extracted into an 'extension' subfolder, move content up
      const innerExtDir = path.join(targetDir, 'extension');
      if (await fs.pathExists(innerExtDir)) {
          const files = await fs.readdir(innerExtDir);
          for (const file of files) {
              await fs.move(path.join(innerExtDir, file), path.join(targetDir, file), { overwrite: true });
          }
          await fs.remove(innerExtDir);
      }

      console.log(`[Marketplace] Successfully installed ${name}`);
      res.json({ success: true, path: targetDir });
    } catch (e) {
      console.error('[Marketplace] Install failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Installed Extensions
  app.get('/api/v3/marketplace/installed', async (req, res) => {
    try {
      const extDir = path.join(currentProjectRoot, '.fa7', 'extensions');
      if (!await fs.pathExists(extDir)) return res.json([]);
      
      const dirs = await fs.readdir(extDir);
      const installed = [];
      for (const dir of dirs) {
        if (dir.startsWith('temp-')) continue;
        const pkgPath = path.join(extDir, dir, 'package.json');
        if (await fs.pathExists(pkgPath)) {
          const pkg = await fs.readJson(pkgPath);
          installed.push({
            id: pkg.name,
            publisher: pkg.publisher,
            version: pkg.version,
            displayName: pkg.displayName,
            description: pkg.description,
            localPath: path.join(extDir, dir),
            themes: pkg.contributes?.themes || []
          });
        }
      }
      res.json(installed);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/marketplace/theme-content', async (req, res) => {
    try {
      const { localPath, themePath } = req.query;
      const fullPath = path.resolve(localPath, themePath);
      
      // Security: ensure fullPath is within currentProjectRoot
      if (!fullPath.startsWith(currentProjectRoot)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (await fs.pathExists(fullPath)) {
        const theme = await fs.readJson(fullPath);
        res.json(theme);
      } else {
        res.status(404).json({ error: 'Theme not found' });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/marketplace/extension/:pub/:name', async (req, res) => {
    try {
      const { pub, name } = req.params;
      const response = await axios.get(`https://open-vsx.org/api/${pub}/${name}/latest`);
      res.json(response.data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/shell/info', (req, res) => {
    res.json({
      ptyWsPort: resolvedPtyPort,
      ptyWsUrl: `ws://127.0.0.1:${resolvedPtyPort}`,
      defaultCwd: currentProjectRoot,
      platform: process.platform,
      ptyPurposeValues: ['ai', 'user'],
      /*
       * FA7 OS Companion v3.0 — local models, PTY terminal, health, studio.
       */
      ptyPurposeHint:
        'On WebSocket init, optional field purpose: "ai" | "user" — also set via env FA7_PTY_PURPOSE.'
    });
  });

  app.post('/api/shell/open-external-terminal', async (req, res) => {
    const cwd = req.body?.cwd;
    const d = cwd && fs.existsSync(cwd) ? cwd : getPtyCwd();
    res.json(await companionShellPty.openSystemTerminal(d));
  });

  app.post('/api/shell/open-external-url', async (req, res) => {
    res.json(await companionShellPty.openExternalUrl(req.body?.url));
  });

  app.post('/api/v3/terminal/exec', async (req, res) => {
    try {
      const { exec } = require('child_process');
      const command = String(req.body?.command || '').trim();
      if (!command) return res.status(400).json({ ok: false, error: 'command is required' });
      const blocked = [
        /rm\s+-rf\s+\//i,
        /\bsudo\b/i,
        /\bshutdown\b/i,
        /\breboot\b/i,
        /\bdd\s+if=/i,
        /\bmkfs/i
      ];
      if (blocked.some((re) => re.test(command))) {
        return res.status(400).json({ ok: false, error: 'Blocked dangerous command.' });
      }
      // Same Permission Engine as kernel.executeTool — HTTP must not bypass it.
      const gate = await ensureHttpToolAllowed(toolApproval, 'executeCommand', { command });
      if (!gate.ok) {
        auditLog.record(currentProjectRoot, {
          actor: 'http',
          action: 'permission.denied',
          tool: 'executeCommand',
          detail: command.slice(0, 200)
        });
        return res.status(403).json({ ok: false, error: gate.error || 'Permission denied', denied: true });
      }
      exec(command, { cwd: getPtyCwd(), timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          return res.json({
            ok: false,
            error: String(error.message || 'Command failed'),
            stdout: String(stdout || '').slice(0, 4000),
            stderr: String(stderr || '').slice(0, 4000)
          });
        }
        return res.json({
          ok: true,
          stdout: String(stdout || '').slice(0, 4000),
          stderr: String(stderr || '').slice(0, 4000)
        });
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'terminal exec failed' });
    }
  });

  app.post('/api/v3/terminal/analyze-error', async (req, res) => {
    try {
      const command = String(req.body?.command || '').trim();
      const stdout = String(req.body?.stdout || '');
      const stderr = String(req.body?.stderr || '');
      const exitCode = Number.isFinite(Number(req.body?.exitCode)) ? Number(req.body.exitCode) : null;
      const model = String(req.body?.model || 'mistral');
      const details = [stderr, stdout].filter(Boolean).join('\n').trim();

      if (!command && !details) {
        return res.status(400).json({ ok: false, error: 'command or stderr/stdout is required' });
      }

      const prompt = [
        'Role: terminal error analyst for software development.',
        'Return valid JSON only, no extra text.',
        'Output format:',
        '{"summary":"...","rootCause":"...","fixes":["..."],"commands":["..."],"confidence":0.0}',
        'Rules: do not propose destructive commands (rm -rf /, sudo shutdown, disk format, etc).',
        `command: ${command || '(empty)'}`,
        `exitCode: ${exitCode === null ? 'unknown' : exitCode}`,
        'stderr/stdout:',
        details || '(empty)'
      ].join('\n');

      const modelRes = await axios.post(`${ollamaHttp()}/api/generate`, {
        model,
        prompt,
        stream: false
      }, { timeout: 25000 });

      const raw = String(modelRes?.data?.response || '').trim();
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Best-effort extraction when model adds extra wrappers.
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {}
        }
      }

      if (!parsed || typeof parsed !== 'object') {
        return res.json({
          ok: true,
          summary: 'Analysis returned, but JSON format was incomplete.',
          rootCause: null,
          fixes: [],
          commands: [],
          confidence: 0.35,
          raw
        });
      }

      return res.json({
        ok: true,
        summary: String(parsed.summary || ''),
        rootCause: String(parsed.rootCause || ''),
        fixes: Array.isArray(parsed.fixes) ? parsed.fixes.map((x) => String(x)) : [],
        commands: Array.isArray(parsed.commands) ? parsed.commands.map((x) => String(x)) : [],
        confidence: Number(parsed.confidence || 0),
        raw
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'analyze error failed' });
    }
  });

  app.post('/api/v3/web/search', async (req, res) => {
    try {
      const query = String(req.body?.query || '').trim();
      const limit = Number(req.body?.limit || 5);
      if (!query) return res.status(400).json({ ok: false, error: 'query is required', results: [] });
      const out = await smartWebSearcher.search(query, { limit });
      if (!out.ok) return res.status(502).json(out);
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'web search failed', results: [] });
    }
  });

  app.post('/api/v3/browser/kavosh/resolve', (req, res) => {
    try {
      const input = req.body?.input || req.body?.url || '';
      const result = kavoshKernel.evaluateNavigation(input);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json({ ok: true, ...result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'Resolve failed' });
    }
  });

  app.get('/api/v3/agent/actions/stream', (req, res) => {
    subscribeAgentVisualActions(res);
  });

  app.get('/api/v3/agent/actions/history', (req, res) => {
    res.json({ ok: true, actions: getAgentVisualHistory(Number(req.query?.limit || 40)) });
  });

  app.get('/api/v3/project/preview-url', async (req, res) => {
    try {
      const port = Number(process.env.FA7_PORT || 3001);
      const {
        resolveProjectPreviewUrl,
        FA7_UI_PORT,
        HOOSH_APP_ROOT
      } = require('./lib/projectPreviewUrl');
      const resolved = await resolveProjectPreviewUrl(currentProjectRoot, {
        scanTerminalUrls: (opts) => companionShellPty.scanTerminalDevUrls(opts)
      });
      return res.json({
        ...resolved,
        companionUrl: `http://localhost:${port}`,
        fa7UiPort: FA7_UI_PORT,
        hooshAppRoot: HOOSH_APP_ROOT
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/project/preview-url', async (req, res) => {
    try {
      if (!currentProjectRoot) {
        return res.status(400).json({ ok: false, error: 'No project open' });
      }
      const { savePreviewUrl, normalizePreviewUrl, probeUrl, isHooshProjectRoot } = require('./lib/projectPreviewUrl');
      const url = normalizePreviewUrl(req.body?.url);
      if (!url) return res.status(400).json({ ok: false, error: 'Valid preview url required' });
      const probe = await probeUrl(url);
      if (!probe.ok) {
        return res.status(400).json({ ok: false, error: 'Preview URL is not reachable on this machine' });
      }
      if (probe.isShell && !isHooshProjectRoot(currentProjectRoot)) {
        return res.status(400).json({
          ok: false,
          error: 'That URL serves the Hoosh IDE itself — start your project dev server and use its URL instead.'
        });
      }
      const saved = await savePreviewUrl(currentProjectRoot, url);
      return res.json({ ok: true, url: saved, projectRoot: currentProjectRoot });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/browser/capture', async (req, res) => {
    try {
      const url = String(req.body?.url || '').trim();
      if (!url) return res.status(400).json({ ok: false, error: 'url required' });
      const nav = kavoshKernel.evaluateNavigation(url);
      if (!nav.ok) return res.status(400).json(nav);
      const { captureBrowserPage } = require('./lib/sandboxPlaywright');
      const sbCfg = loadSandboxConfig();
      const out = await captureBrowserPage(currentProjectRoot, {
        url: nav.url || url,
        sandbox: sandboxRunner.isEnabled(),
        playwrightImage: sbCfg?.playwrightImage
      });
      if (!out.ok) {
        return res.status(500).json({ ok: false, error: out.error || out.stderr || 'capture failed' });
      }
      return res.json({
        ok: true,
        url: out.url,
        title: out.title,
        text: out.text,
        selector: out.selector,
        screenshot: out.screenshot
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'capture failed' });
    }
  });

  app.post('/api/v3/browser/pick-context', async (req, res) => {
    try {
      const url = String(req.body?.url || '').trim();
      if (!url) return res.status(400).json({ ok: false, error: 'url required' });
      const nav = kavoshKernel.evaluateNavigation(url);
      if (!nav.ok) return res.status(400).json(nav);
      const { captureBrowserPage } = require('./lib/sandboxPlaywright');
      const out = await captureBrowserPage(currentProjectRoot, { url: nav.url || url, sandbox: false });
      if (!out.ok) {
        return res.status(500).json({ ok: false, error: out.error || 'pick failed' });
      }
      return res.json({
        ok: true,
        url: out.url,
        selector: out.selector || 'body',
        excerpt: String(out.text || '').slice(0, 2000)
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'pick failed' });
    }
  });

  app.get('/api/v3/browser/kavosh/proxy', async (req, res) => {
    try {
      const raw = String(req.query?.url || '').trim();
      let target;
      try {
        target = new URL(raw);
      } catch {
        return res.status(400).send('Invalid url');
      }
      const host = String(target.hostname || '').toLowerCase();
      if (host === 'google.com' || host.endsWith('.google.com')) {
        // Google full search page is JS-heavy and often blank in framed proxy mode.
        // Force basic HTML view for better in-app rendering.
        if (target.pathname === '/search') {
          target.searchParams.set('gbv', '1');
        }
      }
      if (!['http:', 'https:'].includes(target.protocol)) {
        return res.status(400).send('Only http/https allowed');
      }

      const upstream = await axios.get(target.toString(), {
        responseType: 'arraybuffer',
        timeout: 20000,
        maxRedirects: 5,
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 FA7-Kavosh',
          Accept: req.headers.accept || '*/*',
          'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9'
        }
      });

      const ctype = String(upstream.headers['content-type'] || 'text/html; charset=utf-8');
      const body = Buffer.from(upstream.data || []);

      // Remove frame-blocking headers for in-app preview endpoint.
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Cache-Control', 'no-store');

      if (ctype.toLowerCase().includes('text/html')) {
        let html = body.toString('utf8');
        const baseTag = `<base href="${target.toString()}">`;
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n`);
        } else {
          html = `${baseTag}\n${html}`;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(upstream.status || 200).send(html);
      }

      res.setHeader('Content-Type', ctype);
      return res.status(upstream.status || 200).send(body);
    } catch (e) {
      return res.status(502).send(`Proxy failed: ${e.message || 'unknown error'}`);
    }
  });

  app.get('/api/v3/gira/status', async (req, res) => {
    try {
      const readiness = await giraKernel.isReady();
      res.json({
        ok: true,
        ready: readiness.ok,
        readiness,
        projectRoot: giraKernel.projectRoot,
        jobs: giraKernel.listJobs()
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'status failed' });
    }
  });

  app.post('/api/v3/gira/download/direct', async (req, res) => {
    try {
      const url = req.body?.url;
      const out = await giraKernel.startDirectDownload(url);
      if (!out.ok) return res.status(400).json(out);
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'start download failed' });
    }
  });

  app.get('/api/v3/gira/jobs/:id', (req, res) => {
    try {
      const job = giraKernel.getJob(req.params.id);
      if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
      return res.json({ ok: true, job });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'job lookup failed' });
    }
  });

  app.post('/api/ai/context', (req, res) => {
    const { query, activeFile } = req.body;
    const context = indexer.getRelevantContext(query, activeFile);
    res.json({ context });
  });

  app.get('/api/v3/symbols/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q) return res.json({ results: [] });
      const out = [];
      for (const [relPath, data] of (indexer.index || new Map()).entries()) {
        for (const s of (data.symbols || []).slice(0, 80)) {
          const name = String(s.content || '').toLowerCase();
          if (!name.includes(q)) continue;
          out.push({
            id: `${relPath}:${s.line || 0}:${s.content}`,
            path: relPath,
            line: s.line || 0,
            symbol: s.content
          });
          if (out.length >= 25) break;
        }
        if (out.length >= 25) break;
      }
      res.json({ results: out });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/symbols/context', async (req, res) => {
    try {
      const raw = String(req.query.id || '');
      const [relPath, lineStr] = raw.split(':');
      if (!relPath) return res.status(400).json({ ok: false, error: 'id required' });
      const line = Math.max(1, Number(lineStr || 1));
      const fullPath = path.join(currentProjectRoot || bootServiceRoot, relPath);
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(0, line - 6);
      const end = Math.min(lines.length, line + 6);
      const snippet = lines.slice(start, end).join('\n');
      res.json({ ok: true, path: relPath, line, snippet });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/ai/repo-map', (req, res) => {
    const q = req.query.q || '';
    const map = indexer.getRepoMap ? indexer.getRepoMap(q) : indexer.getProjectMap();
    res.json({ map });
  });

  app.post('/api/ai/semantic-search', async (req, res) => {
    try {
      const query = String(req.body?.query || '').trim();
      if (!query) return res.status(400).json({ ok: false, error: 'query required' });
      const cfg = loadIndexingConfig();
      let hits = [];
      if (cfg.vectorBackend === 'lancedb') {
        const li = getLanceIndex();
        hits = await li.search(query, Number(req.body?.topK) || 8);
      } else {
        hits = await indexer.semanticSearch(query, Number(req.body?.topK) || 8);
      }
      res.json({ ok: true, hits });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/hybrid-search', async (req, res) => {
    try {
      const query = String(req.body?.query || '').trim();
      if (!query) return res.status(400).json({ ok: false, error: 'query required' });
      const hits = await indexer.hybridSearch(query, Number(req.body?.topK) || 8);
      res.json({ ok: true, ...hits });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/fts/rebuild', async (req, res) => {
    try {
      const fts = getFtsIndex();
      if (!fts) return res.status(400).json({ ok: false, error: 'No project' });
      const result = fts.rebuildFromIndexer(indexer);
      await fts.save();
      indexer.setFtsIndex(fts);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/gather', async (req, res) => {
    try {
      const gather = new GatherMode(kernel, indexer, llmGateway);
      const events = [];
      const context = await gather.gather(req.body?.goal || '', {
        onEvent: (type, data) => events.push({ type, ...data })
      });
      res.json({ ok: true, context, events });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/chat/abort', (req, res) => {
    const { streamId } = req.body || {};
    const ok = streamId ? streamRegistry.abort(streamId) : false;
    if (!ok) streamRegistry.abortAll();
    res.json({ ok: true, aborted: ok || !streamId });
  });

  app.get('/api/v3/agent-sessions', async (req, res) => {
    res.json({ sessions: await agentSessions.list() });
  });

  app.post('/api/v3/agent-sessions', async (req, res) => {
    const s = await agentSessions.create(req.body?.title);
    res.json({ ok: true, session: s });
  });

  app.get('/api/v3/agent-sessions/:id', async (req, res) => {
    const s = await agentSessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json({ session: s });
  });

  app.delete('/api/v3/agent-sessions/:id', async (req, res) => {
    await agentSessions.remove(req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/v3/automation', (req, res) => {
    res.json({ jobs: agentAutomation.list() });
  });

  app.post('/api/v3/automation', (req, res) => {
    const job = agentAutomation.add(req.body || {});
    res.json({ ok: true, job });
  });

  app.patch('/api/v3/automation/:id', (req, res) => {
    const job = agentAutomation.update(req.params.id, req.body || {});
    if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
    res.json({ ok: true, job });
  });

  app.delete('/api/v3/automation/:id', (req, res) => {
    agentAutomation.remove(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/v3/automation/webhook/:secret', async (req, res) => {
    const job = agentAutomation.findByWebhookSecret(req.params.secret);
    if (!job) return res.status(404).json({ ok: false, error: 'Unknown webhook' });
    await agentAutomation.fire({ ...job, prompt: req.body?.prompt || job.prompt });
    res.json({ ok: true });
  });

  app.get('/api/v3/hitl/workflows', (req, res) => {
    res.json({ workflows: hitlGraph.list() });
  });

  app.post('/api/v3/hitl/workflows', (req, res) => {
    const wf = hitlGraph.create(req.body?.name, req.body?.steps);
    res.json({ ok: true, workflow: wf });
  });

  app.post('/api/v3/hitl/workflows/:id/approve', (req, res) => {
    const wf = hitlGraph.approve(req.params.id, req.body?.approved !== false);
    res.json({ ok: true, workflow: wf });
  });

  app.post('/api/v3/hitl/workflows/:id/run', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      let wf = hitlGraph.get(req.params.id);
      if (!wf) return res.status(404).json({ ok: false, error: 'Workflow not found' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      while (wf && wf.status === 'running' && wf.current < wf.steps.length) {
        const step = wf.steps[wf.current];
        if (!step) break;
        if (step.requiresApproval && step.status === 'pending') {
          writeJsonLine(res, { agent_event: { type: 'hitl_wait', workflowId: wf.id, step } });
          return res.end();
        }
        writeJsonLine(res, { agent_event: { type: 'hitl_step_start', step } });
        const result = await kernel.executeAutonomousLoop(step.prompt || step.label, {
          mode: 'agent',
          onEvent: (event) => writeJsonLine(res, { agent_event: event })
        });
        hitlGraph.completeStep(wf.id, JSON.stringify(result).slice(0, 4000));
        hitlGraph.approve(wf.id, true);
        wf = hitlGraph.get(req.params.id);
      }
      writeJsonLine(res, { agent_event: { type: 'hitl_complete', workflowId: wf?.id, status: wf?.status } });
      res.end();
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
      else {
        writeJsonLine(res, { agent_event: { type: 'error', message: e.message } });
        res.end();
      }
    }
  });

  app.post('/api/v3/mission/implement', async (req, res) => {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null;
      const result = await kernel.implementPendingPlan((event) => {
        writeJsonLine(res, { message: { content: '' }, agent_event: event });
      });
      if (!result.ok) {
        writeJsonLine(res, { agent_event: { type: 'error', message: result.error || 'Implement failed' } });
      } else if (!result.paused) {
        writeJsonLine(res, { agent_event: { type: 'done', done: true } });
        if (sessionId) {
          await finalizeAgentSession(sessionId, 'Plan implementation completed.');
        }
      }
      res.end();
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
      else {
        writeJsonLine(res, { agent_event: { type: 'error', message: e.message } });
        res.end();
      }
    }
  });

  app.post('/api/v3/mission/continue', async (req, res) => {
    try {
      const reply = String(req.body?.reply || '').trim();
      if (!reply) return res.status(400).json({ ok: false, error: 'reply is required' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await kernel.resumeMission(reply, (event) => {
        writeJsonLine(res, { message: { content: '' }, agent_event: event });
      });
      if (!result.ok) {
        writeJsonLine(res, { agent_event: { type: 'error', message: result.error || 'Resume failed' } });
      } else if (result.result) {
        writeJsonLine(res, { message: { content: String(result.result).slice(0, 8000) }, agent_event: { type: 'done', done: true } });
      }
      res.end();
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/agent-sessions/:id/messages', async (req, res) => {
    try {
      const message = req.body?.message;
      if (!message) return res.status(400).json({ ok: false, error: 'message required' });
      const session = await agentSessions.appendMessage(req.params.id, message);
      res.json({ ok: true, session });
    } catch (e) {
      res.status(404).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/vector/rebuild', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const vi = getVectorIndex();
      const result = await vi.rebuildFromIndexer(indexer, Number(req.body?.maxFiles) || 80);
      indexer.setVectorIndex(vi);
      const cfg = loadIndexingConfig();
      if (cfg.vectorBackend === 'lancedb') {
        const li = getLanceIndex();
        const seeded = await li.rebuildFromVectorIndex(vi);
        return res.json({ ok: true, ...result, lancedb: seeded });
      }
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/indexing/config', (req, res) => {
    const cfg = loadIndexingConfig();
    res.json({ ...cfg, sqliteAvailable: sqliteFtsAvailable() });
  });

  app.get('/api/v3/agent/config', (req, res) => {
    res.json(loadAgentConfig());
  });

  /**
   * Which models the agent will actually run — so the UI can show whether a
   * mission is local or cloud, and prove that Offline Strict stays offline.
   * Pass ?allowedModels=a,b to preview the resolution under a given policy.
   */
  app.get('/api/v3/agent/models', async (req, res) => {
    const preview = typeof req.query.allowedModels === 'string' && req.query.allowedModels.trim()
      ? req.query.allowedModels.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
    const previousPolicy = kernel.getModelPolicy?.() || null;
    try {
      if (preview) kernel.setModelPolicy(preview);
      const h = await kernel.getHybridModels();
      const isCloud = (d) => /(?:-cloud$|:cloud$)/i.test(String(d?.model || ''));
      res.json({
        ok: true,
        light: { ...h.light, cloud: isCloud(h.light) },
        heavy: { ...h.heavy, cloud: isCloud(h.heavy) },
        cloudOk: h.cloudOk,
        offline: !isCloud(h.light) && !isCloud(h.heavy),
        policy: kernel.getModelPolicy?.() || null
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    } finally {
      // A preview must not leak into the kernel's real policy.
      if (preview) kernel.setModelPolicy(previousPolicy);
    }
  });

  app.post('/api/v3/agent/config', (req, res) => {
    try {
      const cfg = {
        deferWrites: req.body?.deferWrites !== false,
        autoCommit: req.body?.autoCommit !== false
      };
      fs.writeJsonSync(AGENT_CONFIG_PATH, cfg, { spaces: 2 });
      applyAgentConfig(cfg);
      res.json({ ok: true, config: cfg });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/indexing/config', (req, res) => {
    try {
      const cfg = {
        vectorBackend: String(req.body?.vectorBackend || 'json'),
        ftsBackend: String(req.body?.ftsBackend || 'json')
      };
      if (!['json', 'lancedb'].includes(cfg.vectorBackend)) cfg.vectorBackend = 'json';
      if (!['json', 'sqlite'].includes(cfg.ftsBackend)) cfg.ftsBackend = 'json';
      if (cfg.ftsBackend === 'sqlite' && !sqliteFtsAvailable()) cfg.ftsBackend = 'json';
      fs.writeJsonSync(INDEX_CONFIG_PATH, cfg, { spaces: 2 });
      ftsIndex = null;
      res.json({ ok: true, config: cfg, sqliteAvailable: sqliteFtsAvailable() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/lsp/completion', async (req, res) => {
    try {
      const { filePath, line, character, content } = req.body || {};
      const bridge = getLspBridge();
      if (!bridge) return res.json({ ok: false, items: [] });
      const items = await bridge.completion(filePath, Number(line) || 1, Number(character) || 0, content || '');
      res.json({ ok: true, items });
    } catch (e) {
      res.json({ ok: false, items: [], error: e.message });
    }
  });

  app.post('/api/v3/lsp/hover', async (req, res) => {
    try {
      const { filePath, line, character, content } = req.body || {};
      const bridge = getLspBridge();
      if (!bridge) return res.json({ ok: false, hover: null });
      const hover = await bridge.hover(filePath, Number(line) || 1, Number(character) || 0, content || '');
      res.json({ ok: true, hover });
    } catch (e) {
      res.json({ ok: false, hover: null, error: e.message });
    }
  });

  app.post('/api/v3/lsp/definition', async (req, res) => {
    try {
      const { filePath, line, character, content } = req.body || {};
      const bridge = getLspBridge();
      if (!bridge) return res.json({ ok: false, definition: null });
      const definition = await bridge.definition(filePath, Number(line) || 1, Number(character) || 0, content || '');
      res.json({ ok: true, definition });
    } catch (e) {
      res.json({ ok: false, definition: null, error: e.message });
    }
  });

  app.get('/api/v3/lsp/status', (req, res) => {
    try {
      const bridge = getLspBridge();
      res.json({ ok: true, servers: bridge?.status?.() || [] });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/commands', async (req, res) => {
    try {
      const commands = await listExtensionCommands(currentProjectRoot);
      res.json({ ok: true, commands });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/extensions/commands/execute', async (req, res) => {
    try {
      const { command, args } = req.body || {};
      const result = await executeCommand(currentProjectRoot, command, args || {}, {
        indexer,
        runLint: async (root, files) => runPostEditChecks(root, files),
        gitStatus: (root) => gitWorkspace.getStatus(root)
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/activations', async (req, res) => {
    try {
      const openFiles = String(req.query.openFiles || '').split(',').filter(Boolean);
      const wm = await getWorkspaceManager();
      const activations = await listExtensionActivations(currentProjectRoot, openFiles, wm);
      res.json({ ok: true, activations });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/keybindings', async (req, res) => {
    try {
      const keybindings = await listExtensionKeybindings(currentProjectRoot);
      const ctx = {
        editorTextFocus: req.query.editorTextFocus === '1',
        resourceLangId: req.query.lang ? String(req.query.lang) : ''
      };
      const active = filterKeybindings(keybindings, ctx);
      res.json({ ok: true, keybindings, active });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/extensions/keybindings/execute', async (req, res) => {
    try {
      const key = String(req.body?.key || '').trim();
      const keybindings = await listExtensionKeybindings(currentProjectRoot);
      const hit = keybindings.find((kb) => kb.key === key);
      if (!hit) return res.status(404).json({ ok: false, error: 'No command for keybinding' });
      const result = await executeCommand(currentProjectRoot, hit.command, req.body?.args || {}, {
        indexer,
        runLint: async (root, files) => runPostEditChecks(root, files),
        gitStatus: (root) => gitWorkspace.getStatus(root)
      });
      res.json({ ok: true, command: hit.command, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/runtime', async (req, res) => {
    try {
      const contributions = await listContributions(currentProjectRoot);
      res.json({ ok: true, contributions });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/extensions/webviews/register', (req, res) => {
    try {
      const { id, html, extension } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
      const webview = registerWebview(id, html, extension);
      res.json({ ok: true, webview });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/webviews/:id', (req, res) => {
    try {
      const webview = getWebview(req.params.id);
      if (!webview) return res.status(404).json({ ok: false, error: 'Not found' });
      res.json({ ok: true, webview });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/extensions/sandbox/activate', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const result = await activateAll(currentProjectRoot);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/sandbox/status', (req, res) => {
    try {
      if (!currentProjectRoot) return res.json({ ok: true, commands: [], subscriptionCount: 0 });
      res.json(sandboxStatus(currentProjectRoot));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/index/rescan', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const wm = await getWorkspaceManager();
      indexer.setWorkspaceManager(wm);
      await indexer.scan();
      res.json({
        ok: true,
        fileCount: indexer.index?.size || 0,
        folders: wm?.list()?.length || 1
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/index/status', async (req, res) => {
    try {
      const wm = await getWorkspaceManager();
      const paths = Array.from(indexer.index?.keys?.() || []);
      res.json({
        ok: true,
        fileCount: paths.length,
        folders: wm?.list() || [],
        samplePaths: paths.slice(0, 12)
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/mcp/gateway/catalog', async (req, res) => {
    try {
      const catalog = await mcpGateway.catalog();
      res.json({ ok: true, ...catalog });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/mcp/gateway/invoke', async (req, res) => {
    try {
      const { toolId, arguments: toolArgs } = req.body || {};
      if (!toolId) return res.status(400).json({ ok: false, error: 'Missing toolId' });
      const gate = await ensureHttpToolAllowed(toolApproval, 'mcpTool', {
        tool: toolId,
        arguments: toolArgs || {}
      });
      if (!gate.ok) {
        auditLog.record(currentProjectRoot, {
          actor: 'http',
          action: 'permission.denied',
          tool: 'mcpTool',
          detail: String(toolId).slice(0, 200)
        });
        return res.status(403).json({ ok: false, error: gate.error || 'Permission denied', denied: true });
      }
      const result = await mcpGateway.invoke(toolId, toolArgs || {});
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/mcp/gateway/resources', async (req, res) => {
    try {
      const resources = await mcpGateway.listResources();
      res.json({ ok: true, resources });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/mcp/gateway/prompts', async (req, res) => {
    try {
      const prompts = await mcpGateway.listPrompts();
      res.json({ ok: true, prompts });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/lm/tools', (req, res) => {
    try {
      const format = String(req.query.format || 'openai');
      const tools = collectTools(mcpManager);
      if (format === 'anthropic') {
        return res.json({ ok: true, tools: toAnthropicTools(tools) });
      }
      res.json({ ok: true, tools: toOpenAIFunctions(tools), raw: tools });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/lm/invoke', async (req, res) => {
    try {
      const { name, arguments: toolArgs } = req.body || {};
      const result = await invokeTool(name, toolArgs || {}, {
        kernel,
        mcpManager,
        emit: () => {}
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/browser/agent', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const gate = await ensureHttpToolAllowed(toolApproval, 'browserAgent', {
        goal: req.body?.goal,
        url: req.body?.url
      });
      if (!gate.ok) {
        auditLog.record(currentProjectRoot, {
          actor: 'http',
          action: 'permission.denied',
          tool: 'browserAgent',
          detail: String(req.body?.goal || req.body?.url || '').slice(0, 200)
        });
        return res.status(403).json({ ok: false, error: gate.error || 'Permission denied', denied: true });
      }
      const cfg = loadSandboxConfig();
      const result = await runBrowserAgent(currentProjectRoot, {
        goal: req.body?.goal,
        url: req.body?.url,
        maxSteps: req.body?.maxSteps,
        sandbox: sandboxRunner.isEnabled(),
        playwrightImage: cfg.playwrightImage,
        kavosh: kavoshKernel,
        llmGenerate: (p) => llmGateway.generate(p),
        onVisualAction: emitAgentVisualAction
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/acp/backends', (req, res) => {
    res.json({ backends: acpAdapter.list(), useAcpForChat: !!acpAdapter.config.useAcpForChat });
  });

  app.get('/api/v3/acp/config', (req, res) => {
    res.json({ config: acpAdapter.config });
  });

  app.post('/api/v3/acp/config', (req, res) => {
    try {
      const cfg = acpAdapter.save(req.body || {});
      res.json({ ok: true, config: cfg });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/acp/run', async (req, res) => {
    try {
      const { backendId, prompt } = req.body || {};
      const result = await acpAdapter.run(backendId, prompt, currentProjectRoot);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/acp/run-stream', async (req, res) => {
    try {
      const { backendId, prompt } = req.body || {};
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const result = await acpAdapter.runStream(backendId, String(prompt || ''), currentProjectRoot, (chunk) => {
        writeJsonLine(res, {
          message: { content: chunk.text || '' },
          agent_event: { type: chunk.type === 'stderr' ? 'error' : 'token', token: chunk.text }
        });
      });
      writeJsonLine(res, {
        message: { content: result.stdout || '' },
        agent_event: { type: 'done', done: true, ok: result.ok }
      });
      res.end();
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
      else res.end();
    }
  });

  app.get('/api/v3/sandbox/config', (req, res) => {
    res.json(loadSandboxConfig());
  });

  app.post('/api/v3/sandbox/config', (req, res) => {
    try {
      const cfg = {
        enabled: !!req.body?.enabled,
        image: String(req.body?.image || 'node:20-bookworm-slim'),
        playwrightImage: String(req.body?.playwrightImage || 'mcr.microsoft.com/playwright:v1.49.0-jammy')
      };
      fs.writeJsonSync(SANDBOX_CONFIG_PATH, cfg, { spaces: 2 });
      sandboxRunner = new SandboxRunner(currentProjectRoot || bootServiceRoot, cfg);
      kernel.setSandboxRunner(sandboxRunner);
      res.json({ ok: true, config: cfg });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/terminals', (req, res) => {
    res.json({ terminals: companionShellPty.listNamedTerminals() });
  });

  app.post('/api/v3/terminals/create', (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const result = companionShellPty.createNamedTerminal(name, {
        cwd: currentProjectRoot || getPtyCwd(),
        mode: req.body?.mode,
        purpose: req.body?.purpose
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/languages', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.json({ languages: [] });
      const languages = await listExtensionLanguages(currentProjectRoot);
      res.json({ languages });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/grammars', async (req, res) => {
    try {
      const { listBuiltinGrammars } = require('./lib/builtinGrammars');
      if (!currentProjectRoot) {
        return res.json({ grammars: listBuiltinGrammars() });
      }
      res.json({ grammars: await listExtensionGrammars(currentProjectRoot) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/grammar/:language', async (req, res) => {
    try {
      const lang = req.params.language;
      if (currentProjectRoot) {
        const grammars = await listExtensionGrammars(currentProjectRoot);
        const g = grammars.find((x) => x.language === lang);
        if (g?.grammarPath) {
          const content = await fs.readFile(g.grammarPath, 'utf8');
          return res.json({
            language: g.language,
            scopeName: g.scopeName,
            content,
            format: g.grammarPath.endsWith('.json') ? 'json' : 'plist'
          });
        }
      }
      const builtin = await getBuiltinGrammar(lang);
      if (!builtin) return res.status(404).json({ error: 'Grammar not found' });
      res.json({
        language: builtin.language,
        scopeName: builtin.scopeName,
        content: builtin.content,
        format: builtin.format
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/extensions/themes', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.json({ themes: [] });
      res.json({ themes: await listExtensionThemes(currentProjectRoot) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/rules', async (req, res) => {
    if (!currentProjectRoot) return res.json({ rules: [] });
    try {
      const rules = await loadRules(currentProjectRoot);
      res.json({ rules });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/skills/match', async (req, res) => {
    if (!currentProjectRoot) return res.json({ skills: [] });
    try {
      const q = String(req.query.q || '');
      const skills = await loadSkills(currentProjectRoot);
      res.json({ skills: matchSkillsForQuery(skills, q) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/skills', async (req, res) => {
    if (!currentProjectRoot) return res.json({ skills: [] });
    try {
      const skills = await loadSkills(currentProjectRoot);
      res.json({ skills });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/mcp/status', (req, res) => {
    res.json(mcpManager.getStatus());
  });

  app.get('/api/v3/mcp/tools', (req, res) => {
    res.json({ tools: mcpManager.listTools() });
  });

  app.post('/api/v3/mcp/reconnect', async (req, res) => {
    try {
      const tools = await mcpManager.connectAll(currentProjectRoot);
      kernel.setMcpManager(mcpManager);
      res.json({ ok: true, tools });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/checkpoints', async (req, res) => {
    if (!currentProjectRoot) return res.json({ checkpoints: [] });
    try {
      const wm = await getWorkspaceManager();
      const cm = new CheckpointManager(currentProjectRoot, wm);
      const checkpoints = await cm.list();
      res.json({ checkpoints });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v3/checkpoints/restore', async (req, res) => {
    try {
      const { id, sessionId, messageIndex } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing checkpoint id' });
      const wm = await getWorkspaceManager();
      const cm = new CheckpointManager(currentProjectRoot, wm);
      const result = await cm.restore(id);
      let chatTruncated = false;
      if (sessionId != null && messageIndex != null) {
        const s = await agentSessions.get(String(sessionId));
        if (s && Array.isArray(s.messages)) {
          const idx = Math.max(0, Number(messageIndex));
          s.messages = s.messages.slice(0, idx);
          await agentSessions.save(s);
          chatTruncated = true;
        }
      }
      if (typeof indexer.scan === 'function') await indexer.scan();
      res.json({ ...result, chatTruncated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/context/git-diff', async (req, res) => {
    try {
      const { execSync } = require('child_process');
      const cwd = currentProjectRoot || process.cwd();
      const diff = execSync('git diff HEAD 2>/dev/null || git diff', {
        cwd,
        encoding: 'utf8',
        maxBuffer: 500000,
        timeout: 8000
      });
      res.json({ ok: true, diff: diff.slice(0, 120000) });
    } catch (e) {
      res.json({ ok: false, diff: '', error: e.message });
    }
  });

  app.get('/api/v3/context/terminal', (req, res) => {
    try {
      const ctx = companionShellPty.getTerminalContext({
        sessionId: req.query.sessionId,
        purpose: req.query.purpose || 'all',
        selection: req.query.selection || '',
        clientBuffer: req.query.buffer || ''
      });
      const primary = ctx.primary || {};
      const content = formatTerminalContext({
        buffer: primary.buffer,
        selection: primary.selection,
        purpose: primary.purpose,
        cwd: primary.cwd,
        sessionName: primary.sessionName,
        lastCommand: primary.lastCommand,
        lastExitCode: primary.lastExitCode,
        commandOutput: primary.commandOutput
      });
      res.json({ ok: true, content, sessions: ctx.sessions, primary });
    } catch (e) {
      res.status(500).json({ ok: false, content: '', error: e.message });
    }
  });

  app.post('/api/v3/context/terminal/sync', (req, res) => {
    try {
      const result = companionShellPty.syncClientTerminalState(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/context/problems/sync', (req, res) => {
    try {
      if (Array.isArray(req.body?.files)) {
        const result = problemsContext.syncWorkspaceMarkers(req.body.files);
        return res.json({ ok: true, ...result });
      }
      const result = problemsContext.syncMarkers(req.body?.markers, req.body?.activeFile);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/context/problems/list', (req, res) => {
    try {
      const summary = problemsContext.getStoredSummary();
      res.json({ ok: true, ...summary });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/context/problems', async (req, res) => {
    try {
      const file = req.query.file ? String(req.query.file) : '';
      const runLint = req.query.runLint === '1' || req.query.runLint === 'true';
      const content = await problemsContext.buildProblemsContext(currentProjectRoot, { file, runLint });
      res.json({
        ok: true,
        content,
        summary: problemsContext.getStoredSummary()
      });
    } catch (e) {
      res.status(500).json({ ok: false, content: '', error: e.message });
    }
  });

  app.get('/api/v3/docs/list', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.json({ sources: [] });
      const config = await docsContext.loadConfig(currentProjectRoot);
      res.json({ sources: config.sources || [] });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/docs/add', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const result = await docsContext.addDocSource(currentProjectRoot, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/context/docs', async (req, res) => {
    try {
      if (!currentProjectRoot) {
        return res.json({ ok: true, content: '## Documentation\n(no project open)', results: [] });
      }
      const q = String(req.query.q || '').trim();
      let codeHits = [];
      if (q && req.query.rerank === '1' && indexer.hybridSearch) {
        try {
          codeHits = await indexer.hybridSearch(q, 6);
        } catch { /* ignore */ }
      }
      const { results } = await docsContext.searchDocs(currentProjectRoot, q, 8, { codeHits });
      const content = docsContext.formatDocsContext(results, q);
      res.json({ ok: true, content, results: results.map((r) => ({
        id: r.id,
        title: r.title,
        path: r.path,
        url: r.url,
        score: r.score
      })) });
    } catch (e) {
      res.status(500).json({ ok: false, content: '', error: e.message });
    }
  });

  app.post('/api/v3/extensions/themes/convert', async (req, res) => {
    try {
      const theme = req.body?.theme || req.body;
      const id = String(req.body?.id || 'hoosh-converted');
      const converted = convertVscodeTheme(theme, id);
      res.json({ ok: true, monaco: converted });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/sandbox/playwright', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const result = await runPlaywrightInSandbox(currentProjectRoot, {
        url: req.body?.url,
        script: req.body?.script,
        sandbox: sandboxRunner.isEnabled(),
        timeoutMs: Number(req.body?.timeoutMs) || 120000
      });
      res.json({ ok: !!result.ok, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/context/track-edit', (req, res) => {
    const p = String(req.body?.path || '').replace(/^\.\//, '');
    if (p && indexer.trackRecentEdit) indexer.trackRecentEdit(p);
    res.json({ ok: true });
  });

  app.post('/api/v3/context/apply-file', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const relPath = String(req.body?.path || '').replace(/^\.\//, '');
      const content = String(req.body?.content ?? '');
      if (!relPath || relPath.includes('..')) {
        return res.status(400).json({ ok: false, error: 'Invalid path' });
      }
      const full = path.join(currentProjectRoot, relPath);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content, 'utf8');
      if (indexer.trackRecentEdit) indexer.trackRecentEdit(relPath);
      if (typeof indexer.scan === 'function') {
        try { await indexer.scan(); } catch { /* non-fatal */ }
      }
      let lint = null;
      let lintLoop = null;
      if (req.body?.runLint !== false) {
        lintLoop = await kernel.healFileWithLintLoop(relPath, 'en', null);
        lint = lintLoop?.lint || null;
      }
      if (kernel.autoCommit) {
        try {
          gitWorkspace.stageFiles(currentProjectRoot, [relPath]);
          gitWorkspace.commit(currentProjectRoot, `hoosh: apply ${relPath}`);
        } catch { /* non-fatal */ }
      }
      res.json({
        ok: true,
        path: relPath,
        lint: lint ? { failed: lint.failed, feedback: lint.feedback } : null,
        lintLoop: lintLoop ? { passed: lintLoop.passed, attempts: lintLoop.attempts } : null,
        healHint: lintLoop && !lintLoop.passed
          ? 'Lint/test still failing after auto-heal attempts.'
          : null
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/mcp/catalog', (req, res) => {
    res.json({ catalog: listCatalog() });
  });

  app.post('/api/v3/mcp/catalog/add', async (req, res) => {
    try {
      const id = String(req.body?.id || '');
      const cfgPath = currentProjectRoot
        ? path.join(currentProjectRoot, '.fa7', 'mcp.json')
        : path.join(os.homedir(), '.hoosh-os', 'mcp.json');
      let current = { mcpServers: {} };
      if (await fs.pathExists(cfgPath)) {
        try { current = await fs.readJson(cfgPath); } catch { /* ignore */ }
      }
      const next = applyCatalogToConfig(current, id, currentProjectRoot || process.cwd());
      if (!next) return res.status(404).json({ ok: false, error: 'Unknown catalog id' });
      await fs.ensureDir(path.dirname(cfgPath));
      await fs.writeJson(cfgPath, next, { spaces: 2 });
      const tools = await mcpManager.connectAll(currentProjectRoot);
      kernel.setMcpManager(mcpManager);
      res.json({ ok: true, config: next, tools });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/engines/matrix', (req, res) => {
    res.json({ engines: getEngineMatrix(llmGateway.getConfig()) });
  });

  app.get('/api/v3/engines/health', async (req, res) => {
    try {
      const engines = getEngineMatrix(llmGateway.getConfig());
      const ollamaBase = ollamaHttp();
      const { testProvider } = require('./lib/litellmRouter');
      const rows = [];
      for (const e of engines) {
        let ok = false;
        let detail = '';
        try {
          if (e.id === 'ollama' || e.provider === 'ollama') {
            const r = await axios.get(`${ollamaBase}/api/tags`, { timeout: 4000 });
            ok = r.status === 200;
            detail = ok ? 'reachable' : `HTTP ${r.status}`;
          } else {
            const prov = llmGateway.getProvider(e.provider);
            const test = await testProvider(prov, ollamaHttp);
            ok = !!test.ok;
            detail = test.detail || (ok ? 'reachable' : 'unreachable');
          }
        } catch (err) {
          detail = err.message || 'unreachable';
        }
        rows.push({ id: e.id, name: e.name, ok, detail });
      }
      res.json({ ok: true, health: rows });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/engines/apply', (req, res) => {
    try {
      const engineId = String(req.body?.engineId || '');
      const routing = suggestRoleRouting(engineId);
      if (!routing) return res.status(404).json({ ok: false, error: 'Unknown engine' });
      const { ENGINES } = require('./lib/engineMatrix');
      const engine = ENGINES.find((x) => x.id === engineId);
      const cfg = llmGateway.getConfig();
      const roles = { ...(cfg.roles || {}) };
      const providers = { ...(cfg.providers || {}) };
      for (const [role, v] of Object.entries(routing)) {
        roles[role] = { ...(roles[role] || {}), provider: v.provider };
      }
      if (engine?.provider && providers[engine.provider]) {
        providers[engine.provider] = {
          ...providers[engine.provider],
          enabled: true,
          baseUrl: engine.defaultUrl || providers[engine.provider].baseUrl
        };
      }
      const updated = llmGateway.save({
        ...cfg,
        roles,
        providers,
        defaultProvider: engine?.provider || cfg.defaultProvider
      });
      res.json({ ok: true, config: updated, applied: engineId });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/approval/tools', (req, res) => {
    res.json({ tools: toolApproval.listToolCategories() });
  });

  app.post('/api/v3/approval/per-tool', (req, res) => {
    try {
      const { tool, autoApprove } = req.body || {};
      if (!tool) return res.status(400).json({ ok: false, error: 'tool required' });
      const config = toolApproval.setPerTool(tool, autoApprove);
      res.json({ ok: true, config });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/terminals/agent-bind', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });
      const result = companionShellPty.getOrCreateAgentTerminal(sessionId, {
        cwd: currentProjectRoot || process.cwd(),
        mode: req.body?.mode || 'system'
      });
      res.json({ ok: true, terminalName: result.name, reused: !!result.reused, cwd: result.cwd });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/lint/run', async (req, res) => {
    try {
      if (!currentProjectRoot) return res.status(400).json({ ok: false, error: 'No project open' });
      const files = Array.isArray(req.body?.files) ? req.body.files : [];
      const result = await runPostEditChecks(currentProjectRoot, files);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/complete', async (req, res) => {
    try {
      const server = new CompletionServer({
        indexer,
        lspBridge: getLspBridge(),
        llmGateway
      });
      const result = await server.complete(req.body || {});
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/v3/completion/server', async (req, res) => {
    try {
      const server = new CompletionServer({
        indexer,
        lspBridge: getLspBridge(),
        llmGateway
      });
      const result = await server.complete(req.body || {});
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/providers/config', (req, res) => {
    res.json({ ok: true, config: llmGateway.getConfig() });
  });

  app.post('/api/v3/providers/config', (req, res) => {
    try {
      const updated = llmGateway.save(req.body || {});
      res.json({ ok: true, config: llmGateway.getConfig() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/providers/models', async (req, res) => {
    try {
      const models = await llmGateway.listModels();
      res.json({ models });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/providers/catalog', (req, res) => {
    res.json({ ok: true, catalog: getCatalog() });
  });

  app.post('/api/v3/providers/catalog/apply', (req, res) => {
    try {
      const providerId = String(req.body?.providerId || '');
      if (!providerId) return res.status(400).json({ ok: false, error: 'Missing providerId' });
      const updated = applyCatalogToProviders(llmGateway.config, providerId);
      llmGateway.save(updated);
      res.json({ ok: true, config: llmGateway.getConfig() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/providers/health', async (req, res) => {
    try {
      const health = await healthCheckAll(llmGateway, ollamaHttp);
      res.json({ ok: true, health });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/providers/test', async (req, res) => {
    try {
      const providerId = String(req.body?.providerId || '');
      if (!providerId) return res.status(400).json({ ok: false, error: 'Missing providerId' });
      const { testProvider } = require('./lib/litellmRouter');
      const prov = llmGateway.getProvider(providerId);
      const result = await testProvider(prov, ollamaHttp);
      res.json({ ok: true, providerId, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/approval/config', (req, res) => {
    res.json({ ok: true, config: toolApproval.getConfig() });
  });

  app.post('/api/v3/approval/config', (req, res) => {
    try {
      const updated = toolApproval.save(req.body || {});
      res.json({ ok: true, config: updated });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/v3/approval/pending', (req, res) => {
    res.json({ pending: toolApproval.listPending() });
  });

  app.post('/api/v3/approval/respond', (req, res) => {
    const { id, approved } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    res.json(toolApproval.respond(id, !!approved));
  });

  app.get('/api/v3/git/status', (req, res) => {
    res.json(gitWorkspace.getStatus(currentProjectRoot));
  });

  app.get('/api/v3/git/diff', (req, res) => {
    res.json(gitWorkspace.getDiff(currentProjectRoot, req.query.path));
  });

  app.get('/api/v3/git/log', (req, res) => {
    res.json({ log: gitWorkspace.getLog(currentProjectRoot, Number(req.query.limit) || 15) });
  });

  app.post('/api/v3/git/stage', (req, res) => {
    const paths = req.body?.paths || [];
    res.json(gitWorkspace.stageFiles(currentProjectRoot, paths));
  });

  app.post('/api/v3/git/commit', (req, res) => {
    res.json(gitWorkspace.commit(currentProjectRoot, req.body?.message));
  });

  app.get('/api/v3/rules/list', async (req, res) => {
    if (!currentProjectRoot) return res.json({ rules: [] });
    res.json({ rules: await loadRules(currentProjectRoot) });
  });

  app.post('/api/v3/rules/save', async (req, res) => {
    try {
      const { name, content } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const dir = path.join(currentProjectRoot, '.fa7', 'rules');
      await fs.ensureDir(dir);
      const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, '_') + '.md';
      await fs.writeFile(path.join(dir, safe), content || '');
      res.json({ ok: true, path: `.fa7/rules/${safe}` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/v3/mcp/config', async (req, res) => {
    const cfgPath = currentProjectRoot
      ? path.join(currentProjectRoot, '.fa7', 'mcp.json')
      : path.join(os.homedir(), '.hoosh-os', 'mcp.json');
    let config = { mcpServers: {} };
    if (await fs.pathExists(cfgPath)) {
      try { config = await fs.readJson(cfgPath); } catch { /* ignore */ }
    }
    res.json({ ok: true, path: cfgPath, config });
  });

  app.post('/api/v3/mcp/config', async (req, res) => {
    try {
      const cfgPath = path.join(currentProjectRoot || path.join(os.homedir(), '.hoosh-os'), '.fa7', 'mcp.json');
      if (currentProjectRoot) {
        await fs.ensureDir(path.dirname(cfgPath));
      }
      const actualPath = currentProjectRoot ? cfgPath : path.join(os.homedir(), '.hoosh-os', 'mcp.json');
      await fs.ensureDir(path.dirname(actualPath));
      await fs.writeJson(actualPath, req.body?.config || req.body || { mcpServers: {} }, { spaces: 2 });
      const tools = await mcpManager.connectAll(currentProjectRoot);
      kernel.setMcpManager(mcpManager);
      res.json({ ok: true, tools });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/ai/compact', async (req, res) => {
    try {
      const { messages, useLlm } = req.body || {};
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });
      if (useLlm) {
        const result = await compactWithLlm(messages, (opts) => llmGateway.generate(opts));
        return res.json(result);
      }
      res.json(compactMessages(messages));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/v2/chat', async (req, res) => {
    const response = await axios.post(`${ollamaHttp()}/api/chat`, req.body, { responseType: 'stream' });
    res.setHeader('Content-Type', 'text/event-stream');
    response.data.pipe(res);
  });

  app.post('/api/v2/code', async (req, res) => {
    try {
      const { prompt, model = 'codellama' } = req.body;
      const response = await axios.post(`${ollamaHttp()}/api/generate`, {
        model,
        prompt: `Generate only the code for: ${prompt}. Do not include explanations.`,
        stream: false
      });
      res.json({ code: response.data.response });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/v2/analyze', async (req, res) => {
    try {
      const { fileName } = req.body;
      const filePath = path.join(currentProjectRoot, fileName);
      const content = await fs.readFile(filePath, 'utf8');
      const response = await axios.post(`${ollamaHttp()}/api/generate`, {
        model: 'mistral',
        prompt: `Analyze this file for potential bugs and performance issues:\n${content}`,
        stream: false
      });
      res.json({ analysis: response.data.response });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/v2/multi-edit', async (req, res) => {
    try {
      const { prompt, files: targetFiles } = req.body;

      const relevantFiles = targetFiles || Array.from(indexer.index.keys()).slice(0, 5);

      const proposals = await Promise.all(
        relevantFiles.map(async (fileName) => {
          const filePath = path.join(currentProjectRoot, fileName);
          const content = await fs.readFile(filePath, 'utf8');

          const modelMap = {
            planner: 'qwen2.5:32b',
            coder: 'deepseek-coder:33b',
            reviewer: 'qwen2.5:32b',
            optimizer: 'mistral'
          };

          const response = await axios.post(`${ollamaHttp()}/api/generate`, {
            model: modelMap.coder,
            prompt: `Plan a change for this file to: ${prompt}\nFile: ${fileName}\nContent:\n${content}\nReturn ONLY the modified code.`,
            stream: false
          });

          return {
            fileName,
            original: content,
            proposed: response.data.response
          };
        })
      );

      res.json({ proposals });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/files', '/api/v3/files'], async (req, res) => {
    try {
      if (!currentProjectRoot) return res.json([]);
      const wm = await getWorkspaceManager();
      const listReq = resolveListRequest(wm, currentProjectRoot, req.query.path);

      if (listReq.mode === 'roots') {
        return res.json(listReq.folders.map((f) => ({
          name: f.name,
          isDirectory: true,
          path: f.name,
          workspaceRoot: true
        })));
      }

      const files = await fs.readdir(listReq.absDir);
      const result = [];

      for (const file of files) {
        if (file.startsWith('.') && !file.startsWith('.fa7/extensions')) continue;
        if (['node_modules', '.git', 'dist', '.DS_Store'].includes(file)) continue;

        const filePath = path.join(listReq.absDir, file);
        const stats = await fs.stat(filePath);
        result.push({
          name: file,
          isDirectory: stats.isDirectory(),
          path: listReq.toEntryPath(file)
        });
      }
      res.json(result);
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return res.json([]);
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/file', '/api/v3/file'], async (req, res) => {
    try {
      if (!currentProjectRoot) {
        return res.status(400).json({ error: 'No project is open' });
      }
      const p = req.query.path;
      const wm = await getWorkspaceManager();
      const filePath = resolveReadPath(wm, currentProjectRoot, p);
      if (!filePath) return res.status(400).json({ error: 'Missing path' });
      let st;
      try {
        st = await fs.stat(filePath);
      } catch (e) {
        return res.status(404).json({ error: e.message || 'Not found' });
      }
      if (st.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory', isDirectory: true });
      }
      const content = await fs.readFile(filePath, 'utf8');
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/v3/project/switch', async (req, res) => {
    try {
      const { path: newPath } = req.body;
      if (!newPath) return res.status(400).json({ error: 'Missing path' });
      const resolved = path.resolve(newPath);
      if (!isValidProjectDirectory(resolved)) {
        return res.status(400).json({ error: 'Valid directory path is required' });
      }
      currentProjectRoot = resolved;
      notebookPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      await ensureFa7Dir(currentProjectRoot);
      await initNotebook(currentProjectRoot);
      indexer = new Indexer(currentProjectRoot);
      indexerRef = indexer;
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp());
      agentKernelRef = kernel;
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      initServices();
      await getWorkspaceManager();
      saveConfig();
      saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));
      res.json({ success: true, root: currentProjectRoot });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/v3/project/config', (req, res) => {
      res.json({ root: currentProjectRoot });
  });

  const isInsideProject = (absFile) => {
    const root = path.resolve(currentProjectRoot);
    const file = path.resolve(absFile);
    const rel = path.relative(root, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  };

  app.post('/api/file', async (req, res) => {
    try {
      const { path: relativePath, content } = req.body;
      const filePath = path.isAbsolute(relativePath) ? relativePath : path.join(currentProjectRoot, relativePath);
      if (!isInsideProject(filePath)) {
        return res.status(400).json({ error: 'Path must be inside the project root' });
      }
      await fs.outputFile(path.resolve(filePath), content ?? '', 'utf8');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Copy a user-selected file on disk into the project (dest is relative to project root). */
  app.post('/api/v3/files/import-from-path', async (req, res) => {
    try {
      const rawSource = req.body?.sourcePath;
      const rawDest = req.body?.destRelative;
      if (!rawSource || typeof rawSource !== 'string' || !rawDest || typeof rawDest !== 'string') {
        return res.status(400).json({ ok: false, error: 'sourcePath and destRelative required' });
      }
      const absSource = path.resolve(String(rawSource).trim());
      if (!await fs.pathExists(absSource)) {
        return res.status(400).json({ ok: false, error: 'Source file not found' });
      }
      const st = await fs.stat(absSource);
      if (!st.isFile()) {
        return res.status(400).json({ ok: false, error: 'Source must be a file' });
      }
      const resolvedRoot = path.resolve(currentProjectRoot);
      const destAbs = path.resolve(path.join(resolvedRoot, String(rawDest).trim()));
      const relFromRoot = path.relative(resolvedRoot, destAbs);
      if (!relFromRoot || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
        return res.status(400).json({ ok: false, error: 'Destination must be inside the project' });
      }
      await fs.ensureDir(path.dirname(destAbs));
      await fs.copy(absSource, destAbs);
      const rel = path.relative(resolvedRoot, destAbs);
      res.json({ ok: true, path: rel });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/v3/files/search', (req, res) => {
    const q = req.query.q || '';
    res.json(indexer.search(q));
  });

  app.get('/api/v3/files/content', async (req, res) => {
    try {
      const relPath = req.query.path;
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const filePath = path.isAbsolute(relPath) ? relPath : path.join(currentProjectRoot, relPath);
      const content = await fs.readFile(filePath, 'utf8');
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Attach all text-like files under an absolute folder path (for chat context). */
  app.post('/api/v3/files/attach-folder-from-path', async (req, res) => {
    try {
      const raw = req.body?.path;
      const maxFiles = Math.min(Math.max(Number(req.body?.maxFiles) || 200, 1), 500);
      const maxBytesPerFile = Math.min(Math.max(Number(req.body?.maxBytesPerFile) || 120000, 1024), 500000);
      if (!raw || typeof raw !== 'string') {
        return res.status(400).json({ ok: false, error: 'Missing path' });
      }
      const root = path.resolve(String(raw).trim());
      let st;
      try {
        st = await fs.stat(root);
      } catch {
        return res.status(400).json({ ok: false, error: 'Path not found' });
      }
      if (!st.isDirectory()) {
        return res.status(400).json({ ok: false, error: 'Not a directory' });
      }

      const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '__pycache__']);
      const TEXT_EXT = new Set([
        '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.css', '.scss', '.html', '.htm', '.txt',
        '.py', '.rs', '.go', '.yml', '.yaml', '.toml', '.sh', '.bash', '.kt', '.swift', '.vue', '.svelte',
        '.c', '.h', '.cpp', '.cc', '.hpp', '.java', '.properties', '.xml', '.gradle', '.kts', '.sql', '.svg'
      ]);
      const files = [];

      async function walk(absDir, relFromRoot) {
        if (files.length >= maxFiles) return;
        let names;
        try {
          names = await fs.readdir(absDir);
        } catch {
          return;
        }
        for (const name of names) {
          if (files.length >= maxFiles) break;
          if (name === '.DS_Store') continue;
          if (name.startsWith('.') && name !== '.fa7') continue;
          const full = path.join(absDir, name);
          const rel = relFromRoot ? `${relFromRoot}/${name}` : name;
          let s;
          try {
            s = await fs.stat(full);
          } catch {
            continue;
          }
          if (s.isDirectory()) {
            if (SKIP_DIRS.has(name)) continue;
            await walk(full, rel);
          } else if (s.isFile()) {
            if (s.size > maxBytesPerFile) continue;
            const ext = path.extname(name).toLowerCase();
            if (ext && !TEXT_EXT.has(ext)) continue;
            try {
              const buf = await fs.readFile(full);
              if (buf.length > maxBytesPerFile) continue;
              const text = buf.toString('utf8');
              files.push({
                name: rel.split(path.sep).join('/'),
                type: 'text/plain',
                content: text
              });
            } catch {
              /* skip binary / unreadable */
            }
          }
        }
      }

      await walk(root, '');
      res.json({ ok: true, root, count: files.length, files });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  });

  async function classifyIntent(prompt, classifyModel = 'mistral') {
      const p = prompt.toLowerCase();
      const chatOnlyKeywords = [
          'سلام', 'درود', 'hi', 'hello', 'hey', 'چطوری', 'how are you',
          'پیشنهاد', 'suggestion', 'نظر', 'idea', 'what do you think', 'چی کم داره'
      ];
      // A greeting word can appear inside a real task ("بساز یک صفحه که بنویسد سلام"),
      // so only treat as chat-only when no build/action verb is present.
      if (chatOnlyKeywords.some(kw => p.includes(kw)) &&
          !/(build|create|fix|edit|change|research|search|download|نصب|ویرایش|تغییر|تحلیل|بساز|بنویس|درست کن|ایجاد|اضافه کن|عوض کن|حذف کن|پاک کن|اجرا کن|کد بزن)/.test(p)) {
          return 'chat';
      }

      // Heuristic bypass for common mission keywords
      const missionKeywords = [
          'build', 'create', 'make', 'refactor', 'save as', 
          'change', 'update', 'modify', 'patch', 'fix', 
          'verify', 'test', 'negah', 'check', 'add', 'remove',
          'research', 'analyze', 'analysis', 'internet', 'search web', 'download source',
          'تحقیق', 'تحلیل', 'بررسی', 'سرچ', 'دانلود', 'اینترنت', 'ترمینال', 'قابلیت',
          // Persian action/build verbs — classifyIntent used to miss these and
          // the LLM fallback mislabelled "یه وب بساز" as chat.
          'بساز', 'بسازی', 'بنویس', 'بنویسی', 'درست کن', 'ایجاد', 'اضافه کن', 'اضافه‌ کن',
          'تغییر بده', 'تغییرش بده', 'تغییر', 'عوض کن', 'عوضش کن', 'حذف کن', 'پاک کن',
          'ویرایش', 'اجرا کن', 'نصب کن', 'رفع کن', 'پیاده‌سازی', 'پیاده سازی', 'کدنویسی', 'کد بزن'
      ];
      if (missionKeywords.some(kw => p.includes(kw))) {
          return 'mission';
      }
      try {
          const res = await axios.post(`${ollamaHttp()}/api/generate`, {
              model: String(classifyModel || 'mistral'),
              system: "Classify user intent. Output ONLY 'chat' or 'mission'.",
              prompt: prompt,
              stream: false
          }, { timeout: 5000 }); // 5s timeout
          const label = res.data.response.toLowerCase();
          return label.includes('mission') ? 'mission' : 'chat';
      } catch (e) {
          return 'chat';
      }
  }

  /** Ollama model ids: "base:tag" is compatible with "base" (same family). */
  function ollamaModelNamesCompatible(a, b) {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (!x || !y) return false;
    if (x === y) return true;
    return x.startsWith(y + ':') || y.startsWith(x + ':');
  }

  /** Enforce Hoosh UI model checkboxes when client sends allowedModels (must match selected model). */
  function validateAllowedModelsPolicy(model, allowedModels) {
    if (!Array.isArray(allowedModels)) return null;
    if (allowedModels.length === 0) {
      return {
        status: 403,
        error: 'No AI models are enabled in Hoosh settings (Engine → AI Models). Enable at least one model.'
      };
    }
    const m = String(model || '').trim();
    if (m && !allowedModels.some((x) => ollamaModelNamesCompatible(m, String(x)))) {
      return {
        status: 403,
        error: `Model "${m}" is not enabled in Hoosh AI Models settings.`
      };
    }
    return null;
  }

  function detectLang(text) {
    return /[\u0600-\u06FF]/.test(String(text || '')) ? 'fa' : 'en';
  }

  function buildFriendlyChatSystemPrompt(lang) {
    const langInstruction = lang === 'fa'
      ? '**زبان:** همیشه به فارسی جواب بده. اگر کاربر صراحتاً زبان دیگری خواست، تغییر بده.'
      : '**Language:** Always reply in the **same language as the user\'s latest message**. Only switch if they **explicitly** ask for another language.';
    return [
      lang === 'fa' ? 'تو یه دستیار هوشمند برای FA7 هستی. ساده، مختصر و مفید جواب بده.' : 'You are a conversational assistant for FA7.',
      langInstruction,
      'For greetings, suggestions, and general chat, answer naturally and helpfully.',
      'For questions **not** about the open project (general knowledge, culture, explanations, etc.), answer **fully** like any assistant — do **not** refuse for being off-topic.',
      'Do not claim you can only help with FA7 unless the request is clearly unsafe/unrelated.',
      'Keep responses concise and useful.',
      '**Project access:** The next section of this system message includes the workspace root, the active file buffer when available, and indexed file snippets or a file list. **Never** say you cannot see the user project files. To load any file\'s full contents, emit <!--FA7_DEV_READ:relative/path.ext--> in your reply.',
      '**Live internet:** You are not directly connected to the web. For weather, news, or up-to-date facts, the system prompt describes <!--FA7_AI_BROWSER ...--> and terminal tags — emit those so the IDE can open pages or fetch text.',
      'If the user asks whether you can "see" the app or project, say yes — the workspace context is attached; use FA7_DEV_READ when you need more files.'
    ].join('\n');
  }

  function isSimpleGreeting(text) {
    const p = String(text || '').trim().toLowerCase();
    if (!p) return false;
    const greetingSet = new Set([
      'سلام', 'درود', 'سلامم', 'سلام.', 'درود.', 'hi', 'hello', 'hey', 'yo'
    ]);
    if (greetingSet.has(p)) return true;
    if (p.length <= 24 && /^(سلام|درود|hi|hello|hey)\b/.test(p)) return true;
    return false;
  }

  /** Returns true for conversational/question messages that should NOT trigger a mission */
  function isConversationalQuestion(text) {
    const p = String(text || '').trim().toLowerCase();
    if (!p || p.length > 300) return false;
    // Questions / confirmations / check-ins
    const conversationalPatterns = [
      /^(می‌?فهم|میفهم)/,          // میفهمی؟ میفهمم
      /^(آیا|آیا می|میتونی|می‌?تونی)/,
      /^(چی|چطور|چطوری|چطوره|کجا|کِی|کی|چرا|چقدر|چند|چیه|چه خبر)/,  // no \b: it is ASCII-based and misbehaves with Persian suffixes
      /^(می‌?دونی|میدونی|بگو|توضیح)/,
      /\?$/,                          // ends with question mark
      /؟$/,                           // Persian question mark
      /^(yes|no|ok|okay|بله|نه|آره|اره|باشه|ممنون|خوبه|عالی|درسته)\b/,
      /^(کار می‌?کنه|کار میکنه|درست (شد|کار)|وصل (شد|هست))/,
      /^(ببین|نگاه کن|ببینم|بررسی کن که)/,
    ];
    return conversationalPatterns.some(r => r.test(p));
  }

  function sanitizeText(value, fallback = '') {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return fallback;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  function normalizeAgentEvent(input) {
    const event = (input && typeof input === 'object') ? input : {};
    return {
      type: sanitizeText(event.type, 'status'),
      message: sanitizeText(event.message, ''),
      ...event
    };
  }

  function normalizeChatEnvelope(input = {}) {
    const message = input.message && typeof input.message === 'object'
      ? { content: sanitizeText(input.message.content, '') }
      : { content: sanitizeText(input.message, '') };
    const envelope = { message };
    if (input.agent_event !== undefined) {
      envelope.agent_event = normalizeAgentEvent(input.agent_event);
    }
    return envelope;
  }

  function writeJsonLine(res, payload) {
    try {
      const normalized = normalizeChatEnvelope(payload);
      res.write(JSON.stringify(normalized) + '\n');
    } catch {
      res.write(JSON.stringify({
        message: { content: '' },
        agent_event: { type: 'error', message: 'Failed to serialize response payload.' }
      }) + '\n');
    }
  }

  async function finalizeAgentSession(sessionId, content) {
    const sid = sessionId ? String(sessionId) : '';
    const body = String(content || '').trim();
    if (!sid || !body) return;
    try {
      const existing = await agentSessions.get(sid);
      if (!existing) {
        console.warn('[FA7 OS] finalizeAgentSession: session not found', sid);
        return;
      }
      await agentSessions.appendMessage(sid, {
        role: 'assistant',
        content: body.slice(0, 50000),
        at: new Date().toISOString()
      });
      await agentSessions.setStatus(sid, 'idle');
    } catch (e) {
      console.warn('[FA7 OS] finalizeAgentSession failed:', e.message);
    }
  }

  async function streamMissionLoop(res, goal, options = {}) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let missionAborted = false;
    let assistantText = '';
    let finishMessage = '';
    const sessionId = options.sessionId ? String(options.sessionId) : null;
    const streamId = streamRegistry.register(res, () => {
      missionAborted = true;
      if (kernel.abortActiveMission) kernel.abortActiveMission();
    });
    res.setHeader('X-Stream-Id', streamId);

    const wrapEvent = typeof options.wrapEvent === 'function'
      ? options.wrapEvent
      : (event) => ({ agent_event: event });

    let paused = false;
    // Fully-delegated mission: commit writes directly + auto-approve so files
    // actually land on disk (within the project root) instead of waiting on
    // DiffZone/approval that a headless mission has no one to confirm.
    kernel.setAutonomousExecution?.(true);
    // Tell the UI up front which models this mission will actually use, so
    // local-vs-cloud is visible rather than guessed.
    try {
      const h = await kernel.getHybridModels();
      const isCloud = (d) => /(?:-cloud$|:cloud$)/i.test(String(d?.model || ''));
      writeJsonLine(res, wrapEvent({
        type: 'models',
        light: h.light.model,
        heavy: h.heavy.model,
        api: h.heavy.api,
        cloud: isCloud(h.heavy),
        offline: !isCloud(h.light) && !isCloud(h.heavy)
      }));
    } catch { /* non-fatal — mission continues */ }
    try {
      const result = await kernel.executeAutonomousLoop(goal, {
        mode: options.mode,
        projectName: options.projectName,
        modeInstructions: options.modeInstructions,
        onEvent: async (event) => {
          if (missionAborted) return;
          if (event.type === 'token' && event.token) assistantText += String(event.token);
          if (event.type === 'finish' && event.message) finishMessage = String(event.message);
          if (event.type === 'rescan') {
            console.log(`[FA7 OS] Task modified disk. Rescanning ${event.path}...`);
            if (typeof indexer.scan === 'function') {
              await indexer.scan();
            }
          }
          writeJsonLine(res, wrapEvent(event));
        }
      });
      paused = !!result?.paused;
    } catch (e) {
      if (!missionAborted) {
        console.error('[FA7 OS] Mission Loop Error:', e);
        writeJsonLine(res, wrapEvent({ type: 'error', message: e.message }));
      }
    } finally {
      kernel.setAutonomousExecution?.(false);
    }

    if (!missionAborted && !paused) {
      writeJsonLine(res, wrapEvent({ type: 'done', done: true, message: finishMessage || 'Mission complete' }));
      if (sessionId) {
        try {
          const content = assistantText.trim() || finishMessage || 'Mission completed';
          await agentSessions.appendMessage(sessionId, {
            role: 'assistant',
            content: content.slice(0, 50000),
            at: new Date().toISOString()
          });
          await agentSessions.setStatus(sessionId, 'idle');
        } catch { /* non-fatal */ }
      }
    } else if (paused) {
      writeJsonLine(res, wrapEvent({ type: 'paused', done: false }));
    }

    if (!res.writableEnded) res.end();
  }

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, stream, model, mode, allowedModels, sessionId } = req.body;
      const lastMessage = messages[messages.length - 1].content;
      const lang = detectLang(lastMessage);

      if (sessionId) {
        try {
          await agentSessions.appendMessage(String(sessionId), {
            role: 'user',
            content: String(lastMessage),
            at: new Date().toISOString()
          });
          await agentSessions.setStatus(String(sessionId), 'running');
        } catch { /* non-fatal */ }
      }

      if (kernel.setAgentMode) kernel.setAgentMode(mode || 'agent');

      if (req.body.useAcp && acpAdapter.config?.active) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const backendId = req.body.acpBackend || acpAdapter.config.active;
        const result = await acpAdapter.runStream(backendId, lastMessage, currentProjectRoot, (chunk) => {
          if (chunk.text) {
            writeJsonLine(res, {
              message: { content: chunk.text },
              agent_event: { type: 'token', token: chunk.text }
            });
          }
        });
        if (!result.ok && result.stderr) {
          writeJsonLine(res, { agent_event: { type: 'error', message: result.stderr } });
        }
        const acpText = result.stdout || '';
        if (sessionId && acpText) {
          try {
            await agentSessions.appendMessage(String(sessionId), {
              role: 'assistant',
              content: acpText.slice(0, 50000),
              at: new Date().toISOString()
            });
            await agentSessions.setStatus(String(sessionId), 'idle');
          } catch { /* non-fatal */ }
        }
        writeJsonLine(res, { message: { content: '' }, agent_event: { type: 'done', done: true } });
        return res.end();
      }

      const fast = tryFastPath(lastMessage, {
        projectRoot: currentProjectRoot,
        models: await llmGateway.listModels().catch(() => [])
      });
      if (fast) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        writeJsonLine(res, {
          message: { content: fast.content },
          agent_event: { type: 'done', message: `Fast-path: ${fast.type}`, done: true }
        });
        await finalizeAgentSession(sessionId, fast.content);
        return res.end();
      }

      if (mode === 'gather' && currentProjectRoot) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const gather = new GatherMode(kernel, indexer, llmGateway);
        const context = await gather.gather(lastMessage, {
          onEvent: (type, data) => writeJsonLine(res, { message: { content: '' }, agent_event: { type, ...data } })
        });
        writeJsonLine(res, {
          message: { content: context.slice(0, 12000) },
          agent_event: { type: 'done', message: 'Gather complete', done: true }
        });
        await finalizeAgentSession(sessionId, context.slice(0, 12000));
        return res.end();
      }

      // Hard fast-path for short greetings to avoid accidental long generations.
      if (isSimpleGreeting(lastMessage)) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const greetingText = 'Hi 👋 I am here. Tell me exactly what you want and I will handle it step by step.';
        writeJsonLine(res, {
          message: { content: greetingText },
          agent_event: { type: 'done', message: 'Greeting handled directly.', done: true }
        });
        await finalizeAgentSession(sessionId, greetingText);
        return res.end();
      }

      const policyErr = validateAllowedModelsPolicy(model, allowedModels);
      if (policyErr) {
        return res.status(policyErr.status).json({ ok: false, error: policyErr.error, code: 'MODEL_POLICY' });
      }

      const classifyModel =
        Array.isArray(allowedModels) && allowedModels.length > 0 ? String(allowedModels[0]) : 'mistral';

      let intent = await classifyIntent(lastMessage, classifyModel);
      
      // Override intent if mode is explicitly an autonomous one
      if (mode === 'plan' || mode === 'debug') {
          intent = 'mission';
      } else if (mode === 'agent' && currentProjectRoot && intent !== 'chat'
                 && !isSimpleGreeting(lastMessage) && !isConversationalQuestion(lastMessage)) {
          // Agent mode runs a mission only when the classifier judged the
          // message a mission. Casual talk ("چطوری", "نظرت چیه") that
          // classifyIntent labelled 'chat' must NOT be forced into a mission
          // just because a project is open.
          intent = 'mission';
      } else if (mode === 'ask') {
          intent = 'chat';
      }
      
      console.log(`[FA7 OS] Intent for "${lastMessage.substring(0, 30)}...": ${intent} (Mode: ${mode || 'default'})`);

      if (intent === 'mission') {
          try {
              const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
              // Honour the UI's model access mode (Offline Strict / Cloud Native /
              // Hybrid / user-selected) inside the mission too — without this the
              // kernel would happily pick a cloud model in Offline Strict.
              kernel.setModelPolicy?.(allowedModels);
              await streamMissionLoop(res, lastMessage, {
                  mode: mode || 'agent',
                  modeInstructions: systemPrompt,
                  sessionId,
                  wrapEvent: (event) => ({ message: { content: '' }, agent_event: event })
              });
          } catch (e) {
              console.error("[FA7 OS] Mission Loop Error:", e);
              if (!res.headersSent) {
                res.status(500).json({ error: e.message });
              }
          }
          return;
      }

      const chatPayload = { ...req.body };
      let compactionNote = null;
      if (Array.isArray(chatPayload.messages)) {
        const compacted = compactMessages(chatPayload.messages, { maxTokens: 14000, keepRecent: 8 });
        if (compacted.compacted) {
          chatPayload.messages = compacted.messages;
          compactionNote = `Context compacted (${compacted.removed} older messages summarized).`;
          if (compacted.removed >= 4 && llmGateway?.generate) {
            try {
              const llmCompacted = await compactWithLlm(
                chatPayload.messages,
                (opts) => llmGateway.generate(opts),
                { maxTokens: 14000, keepRecent: 8 }
              );
              if (llmCompacted.compacted) {
                chatPayload.messages = llmCompacted.messages;
                compactionNote = `LLM-compacted (${llmCompacted.removed || compacted.removed} messages).`;
              }
            } catch { /* fall back to rule-based summary */ }
          }
        }
      }
      if (Array.isArray(chatPayload.messages)) {
        const incoming = [...chatPayload.messages];
        const friendly = buildFriendlyChatSystemPrompt(lang);
        const firstSys = incoming.findIndex((m) => m && m.role === 'system');
        let extraContext = '';
        if (currentProjectRoot) {
          try {
            const allRules = await loadRules(currentProjectRoot);
            const activeFile = String(req.body?.activeFile || req.query?.activeFile || '');
            const rules = selectRulesForContext(allRules, { activeFile, query: lastMessage });
            const skills = await loadSkills(currentProjectRoot);
            const matched = matchSkillsForQuery(skills, lastMessage);
            extraContext = [buildRulesPrompt(rules), buildSkillsPrompt(matched)].filter(Boolean).join('\n\n');
            if (indexer.getRepoMap) {
              extraContext += '\n\n' + indexer.getRepoMap(lastMessage, { maxChars: 8000 });
            }
            if (lastMessage.length > 20) {
              const hybrid = await indexer.hybridSearch(lastMessage, 5);
              const vi = getVectorIndex();
              const fts = getFtsIndex();
              if (hybrid.merged?.length) {
                extraContext += '\n\n## Hybrid codebase search\n' + hybrid.merged.map((h) =>
                  `### ${h.path} (${h.score.toFixed(2)})\n${h.text || ''}`).join('\n\n');
              } else if (hybrid.vector?.length && vi) {
                extraContext += '\n\n' + vi.formatForContext(hybrid.vector);
              } else if (hybrid.fts?.length && fts) {
                extraContext += '\n\n' + fts.formatForContext(hybrid.fts);
              }
            }
          } catch {
            /* non-fatal */
          }
        }
        if (firstSys >= 0) {
          /** One merged system block so Ollama/local models do not ignore the IDE workspace prompt. */
          const merged = `${friendly}\n\n---\n${String(incoming[firstSys].content || '')}${extraContext ? '\n\n' + extraContext : ''}`;
          incoming[firstSys] = { ...incoming[firstSys], content: merged };
          chatPayload.messages = incoming;
        } else {
          chatPayload.messages = [{ role: 'system', content: friendly + (extraContext ? '\n\n' + extraContext : '') }, ...incoming];
        }
      }

      let selectedModel = chatPayload.model;
      let availableFallbacks = (allowedModels || []).filter(m => String(m).trim() !== String(selectedModel).trim());
      let response = null;
      let attemptError = null;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      let chatAborted = false;
      const streamId = streamRegistry.register(res, () => { chatAborted = true; });
      res.setHeader('X-Stream-Id', streamId);

      if (mode === 'agent' && lastMessage.length > 80 && currentProjectRoot) {
        try {
          const subRunner = new SubagentRunner(kernel);
          const repoCtx = indexer.getRepoMap ? indexer.getRepoMap(lastMessage, { maxChars: 4000 }) : '';
          const subFindings = await subRunner.runParallel(lastMessage, repoCtx, {
            count: 2,
            onEvent: (ev) => writeJsonLine(res, { message: { content: '' }, agent_event: ev })
          });
          if (subFindings) {
            const incoming = [...(chatPayload.messages || [])];
            const sysIdx = incoming.findIndex((m) => m && m.role === 'system');
            const block = '\n\n## Subagent Research\n' + subFindings;
            if (sysIdx >= 0) {
              incoming[sysIdx] = { ...incoming[sysIdx], content: String(incoming[sysIdx].content || '') + block };
            } else {
              incoming.unshift({ role: 'system', content: block });
            }
            chatPayload.messages = incoming;
          }
        } catch (e) {
          writeJsonLine(res, {
            message: { content: '' },
            agent_event: { type: 'status', message: `Subagents skipped: ${e.message}` }
          });
        }
      }

      const tryChat = async (mName) => {
        console.log(`[FA7 OS] Chat Route Invoking Model: ${mName}`);
        const finalPayload = { ...chatPayload, model: String(mName).trim() };
        return await llmGateway.chatStreamCompat(finalPayload, { role: mode || 'chat', timeout: 120000 });
      };

      try {
        response = await tryChat(selectedModel);
      } catch (err) {
        console.warn(`[FA7 OS] Primary model ${selectedModel} failed. Error:`, err.message);
        attemptError = err.message;
        
        for (const fb of availableFallbacks) {
           try {
             console.log(`[FA7 OS] Attempting fallback model: ${fb}`);
             response = await tryChat(fb);
             selectedModel = fb;
             attemptError = null;
             break;
           } catch (fallbackErr) {
             console.warn(`[FA7 OS] Fallback ${fb} failed:`, fallbackErr.message);
           }
        }
      }

      if (compactionNote) {
        writeJsonLine(res, {
          message: { content: '' },
          agent_event: { type: 'status', message: compactionNote }
        });
      }

      // Last resort: try any locally installed Ollama model
      if (!response) {
        try {
          const ollamaTags = await axios.get(`${ollamaHttp()}/api/tags`, { timeout: 3000 });
          const localModels = (ollamaTags.data?.models || []).map(m => m.name).filter(Boolean);
          for (const localM of localModels) {
            if (localM === selectedModel) continue;
            try {
              console.log(`[FA7 OS] Last-resort fallback to local Ollama model: ${localM}`);
              response = await tryChat(localM);
              selectedModel = localM;
              attemptError = null;
              writeJsonLine(res, { message: { content: '' }, agent_event: { type: 'status', message: `Auto-selected local model: ${localM}` } });
              break;
            } catch {}
          }
        } catch {}
      }

      if (!response) {
         writeJsonLine(res, { message: { content: '' }, agent_event: { type: 'error', message: `Model Connection Error. All selected models failed. (Last: ${attemptError})\n\nمدل "${selectedModel}" نصب نیست. در Engine View یه مدل محلی نصب کنید.` } });
         return res.end();
      }

      if (String(selectedModel).trim() !== String(chatPayload.model).trim()) {
         writeJsonLine(res, {
            message: { content: '' },
            agent_event: { type: 'status', message: `⚠️ Fallback Routing Active: Switched to ${selectedModel}` }
         });
      }

      let buffer = '';
      let sawDone = false;
      let streamedChars = 0;
      let assistantStreamText = '';
      const persistAssistant = async () => {
        if (!sessionId || !assistantStreamText.trim()) return;
        try {
          await agentSessions.appendMessage(String(sessionId), {
            role: 'assistant',
            content: assistantStreamText.slice(0, 50000),
            at: new Date().toISOString()
          });
          await agentSessions.setStatus(String(sessionId), 'idle');
        } catch { /* non-fatal */ }
      };
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const content = sanitizeText(parsed?.message?.content, sanitizeText(parsed?.response, ''));
            streamedChars += content.length;
            if (content) assistantStreamText += content;
            const done = !!parsed?.done;
            if (done) sawDone = true;
            writeJsonLine(res, {
              message: { content },
              agent_event: {
                type: done ? 'done' : 'model_chunk',
                message: done ? 'Model stream completed.' : '',
                model: sanitizeText(parsed?.model, sanitizeText(model, '')),
                done
              }
            });
            if (streamedChars > 8000) {
              sawDone = true;
              writeJsonLine(res, {
                message: { content: '' },
                agent_event: { type: 'done', message: 'Output truncated for safety.', done: true }
              });
              try { response.data.destroy(); } catch {}
              void persistAssistant().finally(() => res.end());
              return;
            }
          } catch {
            writeJsonLine(res, {
              message: { content: '' },
              agent_event: { type: 'error', message: 'Non-JSON chunk dropped from model stream.' }
            });
          }
        }
      });
      response.data.on('end', () => {
        if (!sawDone) {
          writeJsonLine(res, {
            message: { content: '' },
            agent_event: { type: 'done', message: 'Model stream ended.', done: true }
          });
        }
        void persistAssistant().finally(() => res.end());
      });
      response.data.on('error', (e) => {
        writeJsonLine(res, {
          message: { content: '' },
          agent_event: { type: 'error', message: sanitizeText(e?.message, 'Model stream error.') }
        });
        void persistAssistant().finally(() => res.end());
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const readPresetModels = async () => {
    const candidates = [
      path.join(__dirname, 'public', 'data', 'ollama-model-presets.json'),
      path.join(__dirname, 'dist', 'data', 'ollama-model-presets.json')
    ];
    for (const p of candidates) {
      try {
        if (await fs.pathExists(p)) {
          const j = await fs.readJson(p);
          const presets = Array.isArray(j?.presets) ? j.presets : [];
          return presets
            .map((m) => ({
              name: String(m?.name || '').trim(),
              label: String(m?.label || '').trim()
            }))
            .filter((m) => m.name);
        }
      } catch {
        // ignore bad preset file and continue with next candidate
      }
    }
    return [];
  };

  const fetchTagNames = async (baseUrl, opts = {}) => {
    const r = await axios.get(`${String(baseUrl).replace(/\/+$/, '')}/api/tags`, opts);
    return Array.isArray(r.data?.models) ? r.data.models : [];
  };
  const onlineChatProbeCache = new Map();
  const ONLINE_PROBE_TTL_MS = 10 * 60 * 1000;

  const probeOnlineChatForModel = async (name, authHeaders = {}) => {
    const key = String(name || '').trim();
    if (!key) return { ok: false, reason: 'invalid model name' };
    const cached = onlineChatProbeCache.get(key);
    const now = Date.now();
    if (cached && (now - cached.at) < ONLINE_PROBE_TTL_MS) {
      return cached.result;
    }
    try {
      const r = await axios.post(
        'https://ollama.com/api/chat',
        {
          model: key,
          stream: false,
          messages: [{ role: 'user', content: 'ping' }],
          options: { num_predict: 1 },
          keep_alive: 0
        },
        { timeout: 12000, headers: authHeaders }
      );
      const result = { ok: !!(r.data?.message || r.data?.response || r.data?.done), state: 'online', reason: '' };
      onlineChatProbeCache.set(key, { at: now, result });
      return result;
    } catch (e) {
      const status = Number(e?.response?.status || 0);
      const reason = e?.response?.data?.error || e?.message || 'probe failed';
      const state =
        status === 404 ? 'offline' :
        (status === 401 || status === 403 || status === 429 || status >= 500 || status === 0) ? 'unknown' :
        'offline';
      const result = { ok: false, state, reason: String(reason) };
      onlineChatProbeCache.set(key, { at: now, result });
      return result;
    }
  };

  app.get('/api/ai/models', async (req, res) => {
    try {
      const models = await llmGateway.listModels();
      res.json({
        models: models.map((m) => ({
          name: m.name,
          label: m.label || m.name,
          provider: m.provider,
          source: m.source
        }))
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/ai/models/catalog', async (req, res) => {
    try {
      const authHeaders = companionOllama.getOllamaAuthHeaders ? companionOllama.getOllamaAuthHeaders() : {};
      const runProbe = String(req.query?.probe || '0') === '1';
      const [localRaw, cloudRaw, presets] = await Promise.all([
        fetchTagNames(ollamaHttp(), { timeout: 10000 }).catch(() => []),
        fetchTagNames('https://ollama.com', { timeout: 15000, headers: authHeaders }).catch(() => []),
        readPresetModels()
      ]);

      const localMap = new Map(localRaw.map((m) => [String(m?.name || '').trim(), m]));
      const cloudMap = new Map(cloudRaw.map((m) => [String(m?.name || '').trim(), m]));
      const presetMap = new Map(presets.map((p) => [p.name, p.label || p.name]));

      const allNames = Array.from(new Set([
        ...Array.from(localMap.keys()),
        ...Array.from(cloudMap.keys()),
        ...Array.from(presetMap.keys())
      ])).filter(Boolean);

      const cloudPresetNames = new Set(
        presets
          .map((p) => String(p?.name || '').trim())
          .filter((n) => /(?:-cloud$|:cloud$)/i.test(n))
      );

      const ollamaNamesCompat = (a, b) => {
        const x = String(a || '').trim();
        const y = String(b || '').trim();
        if (!x || !y) return false;
        if (x === y) return true;
        return x.startsWith(y + ':') || y.startsWith(x + ':');
      };

      const models = allNames.map((name) => {
        const local = localMap.get(name) || null;
        const cloud = cloudMap.get(name) || null;
        const cloudCapable = /(?:-cloud$|:cloud$)/i.test(name) || cloudPresetNames.has(name);
        const label = presetMap.get(name) || name;
        return {
          name,
          label,
          installed: !!local,
          available_online: cloudCapable,
          chat_online: null,
          chat_state: cloudCapable ? 'online' : 'unknown',
          online_reason: '',
          size: local?.size || cloud?.size || null,
          parameter_size: local?.details?.parameter_size || cloud?.details?.parameter_size || '',
          source: local ? 'local' : (cloud ? 'cloud' : 'preset')
        };
      });

      // If Ollama has e.g. "rnj-1:8b" but the catalog row is only "rnj-1" (preset), mark installed from any compatible local tag.
      for (const m of models) {
        if (m.installed) continue;
        for (const [ln, row] of localMap) {
          if (ollamaNamesCompat(m.name, ln)) {
            m.installed = true;
            m.size = m.size || row?.size;
            m.source = 'local';
            break;
          }
        }
      }

      try {
        const gatewayModels = await llmGateway.listModels();
        const existing = new Set(models.map((m) => m.name));
        for (const gm of gatewayModels) {
          if (gm.provider === 'ollama' || existing.has(gm.name)) continue;
          const isLmStudio = gm.provider === 'lmstudio';
          models.push({
            name: gm.name,
            label: gm.label || gm.name,
            installed: true,
            available_online: false,
            chat_online: null,
            chat_state: 'online',
            online_reason: '',
            size: null,
            parameter_size: '',
            source: isLmStudio ? 'lmstudio' : (gm.source || 'gateway'),
            provider: gm.provider || 'gateway'
          });
          existing.add(gm.name);
        }
      } catch { /* gateway optional */ }

      if (runProbe) {
        const concurrency = 4;
        let idx = 0;
        const worker = async () => {
          while (idx < models.length) {
            const i = idx++;
            const m = models[i];
            const pr = await probeOnlineChatForModel(m.name, authHeaders);
            const isCloudCapable = !!m.available_online;
            m.chat_online = pr.ok === true || (isCloudCapable && pr.state === 'unknown');
            m.chat_state = pr.ok ? 'online' : (isCloudCapable ? (pr.state === 'offline' ? 'offline' : 'online') : (pr.state || 'unknown'));
            if (m.chat_state === 'offline') {
              m.available_online = false;
            }
            m.online_reason = pr.reason || '';
            if (!pr.ok && isCloudCapable && (pr.state === 'unknown')) {
              m.online_reason = m.online_reason || 'Cloud-capable model (auth/session required)';
            }
          }
        };
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
      }

      const sortedModels = models.sort((a, b) => {
        if (a.installed !== b.installed) return a.installed ? -1 : 1;
        if (a.chat_online !== b.chat_online) return a.chat_online ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        ok: true,
        local_count: localMap.size,
        online_count: cloudMap.size,
        preset_count: presetMap.size,
        models: sortedModels
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'failed to build model catalog', models: [] });
    }
  });

  app.get('/api/ai/system-stats', async (req, res) => {
    try {
      res.json({
        gpu: 'Apple Metal (Active)',
        vram: '4.2GB / 8.0GB',
        cpu: `${Math.round(process.cpuUsage().user / 1000000)}% API Load`,
        latency: '45ms'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/v3/autonomous-goal', '/api/v3/mission'], async (req, res) => {
    try {
      const { goal, projectName } = req.body;
      const finalProjectName = projectName || `aivon-app-${Date.now().toString().slice(-4)}`;
      console.log(`[FA7 OS] Starting autonomous goal for ${finalProjectName}: ${goal}`);

      await streamMissionLoop(res, goal, { projectName: finalProjectName });
    } catch (err) {
      if (!res.headersSent) {
          res.status(500).json({ error: err.message });
      } else {
          writeJsonLine(res, { agent_event: { type: 'error', message: err.message } });
          res.end();
      }
    }
  });

  // --- Native Dialog ---
  app.get('/api/dialog/open-folder', async (req, res) => {
    try {
      const dialog = electron?.dialog;
      if (dialog) {
        let parentWin = null;
        try {
          const { BrowserWindow } = electron;
          parentWin = BrowserWindow.getFocusedWindow?.() || (BrowserWindow.getAllWindows?.() || [])[0] || null;
        } catch {
          /* ignore */
        }
        const opts = { properties: ['openDirectory', 'createDirectory'] };
        const result = parentWin
          ? await dialog.showOpenDialog(parentWin, opts)
          : await dialog.showOpenDialog(opts);
        if (result.canceled || !result.filePaths.length) return res.json({ ok: true, canceled: true });
        return res.json({ ok: true, canceled: false, path: result.filePaths[0] });
      }

      // Fallback for non-Electron runs (e.g. started from terminal).
      const { execFile } = require('child_process');
      const runExec = (cmd, args = []) => new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message || 'Command failed'));
          resolve(String(stdout || '').trim());
        });
      });

      let chosen = '';
      if (process.platform === 'darwin') {
        chosen = await runExec('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select folder")']);
      } else if (process.platform === 'win32') {
        chosen = await runExec('powershell', [
          '-NoProfile',
          '-Command',
          "Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.FolderBrowserDialog; if($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){Write-Output $f.SelectedPath}"
        ]);
      } else {
        // Linux: try zenity first, fallback to kdialog.
        try {
          chosen = await runExec('zenity', ['--file-selection', '--directory', '--title=Select folder']);
        } catch {
          chosen = await runExec('kdialog', ['--getexistingdirectory', process.cwd()]);
        }
      }

      const selected = String(chosen || '').trim();
      if (!selected) return res.json({ ok: true, canceled: true });
      if (!await fs.pathExists(selected)) return res.status(400).json({ ok: false, error: 'Selected folder does not exist.' });
      return res.json({ ok: true, canceled: false, path: selected });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Folder picker unavailable' });
    }
  });

  /** Pick a folder that must live under the current project (starts at project root in Electron). */
  app.get('/api/dialog/pick-project-subfolder', async (req, res) => {
    try {
      const resolvedRoot = path.resolve(currentProjectRoot);
      const dialog = electron?.dialog;
      if (dialog) {
        const result = await dialog.showOpenDialog({
          defaultPath: resolvedRoot,
          properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || !result.filePaths.length) return res.json({ ok: true, canceled: true });
        const picked = path.resolve(result.filePaths[0]);
        const relRaw = path.relative(resolvedRoot, picked);
        if (relRaw.startsWith('..') || path.isAbsolute(relRaw)) {
          return res.status(400).json({ ok: false, error: 'Please choose a folder inside the current project.' });
        }
        const rel = relRaw.split(path.sep).join('/');
        return res.json({ ok: true, canceled: false, rel });
      }

      const { execFile } = require('child_process');
      const runExec = (cmd, args = []) => new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message || 'Command failed'));
          resolve(String(stdout || '').trim());
        });
      });

      let chosen = '';
      if (process.platform === 'darwin') {
        chosen = await runExec('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select folder inside your project")']);
      } else if (process.platform === 'win32') {
        chosen = await runExec('powershell', [
          '-NoProfile',
          '-Command',
          `Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.FolderBrowserDialog; $f.SelectedPath=[System.IO.Path]::GetFullPath('${resolvedRoot.replace(/'/g, "''")}'); if($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){Write-Output $f.SelectedPath}`
        ]);
      } else {
        try {
          chosen = await runExec('zenity', ['--file-selection', '--directory', `--filename=${resolvedRoot}/`]);
        } catch {
          chosen = await runExec('kdialog', ['--getexistingdirectory', resolvedRoot]);
        }
      }

      const selected = String(chosen || '').trim();
      if (!selected) return res.json({ ok: true, canceled: true });
      const picked = path.resolve(selected);
      if (!await fs.pathExists(picked)) return res.status(400).json({ ok: false, error: 'Folder does not exist.' });
      const relRaw = path.relative(resolvedRoot, picked);
      if (relRaw.startsWith('..') || path.isAbsolute(relRaw)) {
        return res.status(400).json({ ok: false, error: 'Please choose a folder inside the current project.' });
      }
      const rel = relRaw.split(path.sep).join('/');
      return res.json({ ok: true, canceled: false, rel });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Folder picker unavailable' });
    }
  });

  app.get('/api/dialog/open-file', async (req, res) => {
    try {
      const dialog = electron?.dialog;
      if (dialog) {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'All files', extensions: ['*'] }]
        });
        if (result.canceled || !result.filePaths.length) return res.json({ ok: true, canceled: true });
        return res.json({ ok: true, canceled: false, path: result.filePaths[0] });
      }

      const { execFile } = require('child_process');
      const runExec = (cmd, args = []) => new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message || 'Command failed'));
          resolve(String(stdout || '').trim());
        });
      });

      let chosen = '';
      if (process.platform === 'darwin') {
        chosen = await runExec('osascript', ['-e', 'POSIX path of (choose file with prompt "Select file to copy into project")']);
      } else if (process.platform === 'win32') {
        chosen = await runExec('powershell', [
          '-NoProfile',
          '-Command',
          "Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.OpenFileDialog; if($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){Write-Output $f.FileName}"
        ]);
      } else {
        try {
          chosen = await runExec('zenity', ['--file-selection', '--title=Select file']);
        } catch {
          chosen = await runExec('kdialog', ['--getopenfilename', process.cwd()]);
        }
      }

      const selected = String(chosen || '').trim();
      if (!selected) return res.json({ ok: true, canceled: true });
      if (!await fs.pathExists(selected)) return res.status(400).json({ ok: false, error: 'Selected file does not exist.' });
      return res.json({ ok: true, canceled: false, path: selected });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'File picker unavailable' });
    }
  });

  // --- Notebook API ---
  const nowStamp = () => {
    const d = new Date();
    return `${d.toISOString()} | ${d.toLocaleString()}`;
  };

  const upsertMarkdownSection = (doc, heading, body) => {
    const safeDoc = String(doc || '');
    const safeHeading = String(heading || '').trim();
    const safeBody = String(body || '').trimEnd();
    if (!safeHeading) return safeDoc;

    const idx = safeDoc.indexOf(safeHeading);
    if (idx === -1) {
      const sep = safeDoc.endsWith('\n') ? '\n' : '\n\n';
      return `${safeDoc}${sep}${safeHeading}\n${safeBody}\n`;
    }

    const afterHeadingNewline = safeDoc.indexOf('\n', idx + safeHeading.length);
    if (afterHeadingNewline === -1) {
      return `${safeDoc}\n${safeBody}\n`;
    }
    const sectionStart = afterHeadingNewline + 1;
    const nextSection = safeDoc.indexOf('\n## ', sectionStart);
    const sectionEnd = nextSection === -1 ? safeDoc.length : nextSection;
    return `${safeDoc.slice(0, sectionStart)}${safeBody}\n${safeDoc.slice(sectionEnd)}`;
  };

  const extractRulesFromNotebook = (content) => {
    const heading = '## User Rules';
    const idx = content.indexOf(heading);
    if (idx === -1) return [];
    const afterHeading = content.indexOf('\n', idx + heading.length);
    if (afterHeading === -1) return [];
    const bodyStart = afterHeading + 1;
    const nextHeading = content.indexOf('\n## ', bodyStart);
    const body = content.slice(bodyStart, nextHeading === -1 ? content.length : nextHeading);
    return body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(?:\d+[\.\)]|-)\s+(.+)$/);
        return m ? m[1].trim() : '';
      })
      .filter(Boolean);
  };

  const prependNotebookChangeLog = (content, message) => {
    const heading = '## Change Log';
    const line = `- [${nowStamp()}] ${String(message || '').trim()}`;
    const idx = content.indexOf(heading);
    if (idx === -1) {
      const sep = content.endsWith('\n') ? '\n' : '\n\n';
      return `${content}${sep}${heading}\n${line}\n`;
    }
    const afterHeading = content.indexOf('\n', idx + heading.length);
    if (afterHeading === -1) return `${content}\n${line}\n`;
    const insertAt = afterHeading + 1;
    return `${content.slice(0, insertAt)}${line}\n${content.slice(insertAt)}`;
  };

  app.get('/api/notebook/status', async (req, res) => {
    try {
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      const exists = await fs.pathExists(nbPath);
      res.json({ ok: true, exists, path: nbPath });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/notebook/create', async (req, res) => {
    try {
      await ensureFa7Dir(currentProjectRoot);
      await initNotebook(currentProjectRoot);
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      const content = await fs.readFile(nbPath, 'utf8');
      res.json({ ok: true, created: true, path: nbPath, content });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.delete('/api/notebook/delete', async (req, res) => {
    try {
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      const exists = await fs.pathExists(nbPath);
      if (!exists) return res.json({ ok: true, deleted: false, message: 'Notebook not found.' });
      await fs.remove(nbPath);
      res.json({ ok: true, deleted: true, path: nbPath });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/notebook/read', async (req, res) => {
    try {
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      const autoCreate = String(req.query?.autocreate ?? '1') !== '0';
      await ensureFa7Dir(currentProjectRoot);
      if (autoCreate) {
        await initNotebook(currentProjectRoot);
      } else if (!await fs.pathExists(nbPath)) {
        return res.status(404).json({ ok: false, error: 'Notebook not found', exists: false, path: nbPath });
      }
      const content = await fs.readFile(nbPath, 'utf8');
      res.json({ ok: true, exists: true, content, path: nbPath });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/notebook/update', async (req, res) => {
    try {
      const { content } = req.body;
      if (typeof content !== 'string') return res.status(400).json({ ok: false, error: 'content required' });
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      const updated = prependNotebookChangeLog(content, 'Notebook content updated via API.');
      await fs.writeFile(nbPath, updated, 'utf8');
      res.json({ ok: true, logged_at: nowStamp() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/notebook/append-rule', async (req, res) => {
    try {
      const rawRule = String(req.body?.rule || '').trim();
      const normalizedRule = rawRule.replace(/\s+/g, ' ').trim();
      if (!normalizedRule) return res.status(400).json({ ok: false, error: 'rule required' });
      const nbPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      await ensureFa7Dir(currentProjectRoot);
      await initNotebook(currentProjectRoot);
      let content = await fs.readFile(nbPath, 'utf8');

      const rules = extractRulesFromNotebook(content);
      const alreadyExists = rules.some((r) => r.toLowerCase() === normalizedRule.toLowerCase());
      if (alreadyExists) {
        const withLog = prependNotebookChangeLog(content, `Rule ignored (duplicate): ${normalizedRule}`);
        await fs.writeFile(nbPath, withLog, 'utf8');
        return res.json({ ok: true, added: false, duplicate: true, logged_at: nowStamp() });
      }

      const nextRules = [...rules, normalizedRule];
      const rulesBody = nextRules.map((r, i) => `${i + 1}. ${r}`).join('\n');
      content = upsertMarkdownSection(content, '## User Rules', rulesBody);
      content = prependNotebookChangeLog(content, `Rule added: ${normalizedRule}`);

      await fs.writeFile(nbPath, content, 'utf8');
      res.json({ ok: true, added: true, rule: normalizedRule, logged_at: nowStamp() });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Model Management ---
  app.delete('/api/ai/models/:name', async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      await axios.delete(`${ollamaHttp()}/api/delete`, { data: { name } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.response?.data?.error || e.message });
    }
  });

  app.post('/api/ai/models/check', async (req, res) => {
    try {
      const { name } = req.body;
      const r = await axios.get(`${ollamaHttp()}/api/tags`);
      const tags = r.data?.models || [];
      const want = String(name || '').trim();
      const found = tags.some((m) => ollamaModelNamesCompatible(want, String(m.name || '')));
      res.json({ ok: true, installed: found, models: tags.map((m) => m.name) });
    } catch (e) {
      res.status(500).json({ ok: false, installed: false, error: e.message });
    }
  });

  // --- Recent Projects Logic ---
  const DEFAULT_RECENT_PATH = path.join(SYSTEM_DIR, 'recent-projects.json');
 
  function saveRecentProject(projPath, name) {
    try {
      if (!projPath || !fs.existsSync(projPath)) return;
      const stats = fs.lstatSync(projPath);
      if (!stats.isDirectory()) return;

      // Don't save if it's just a generic root and doesn't have a .fa7 dir
      // unless it's explicitly being saved via a project action
      const hasFa7 = fs.existsSync(path.join(projPath, '.fa7'));
      const isSystemRoot = [require('os').homedir(), '/Users', '/'].includes(projPath);
      if (isSystemRoot && !hasFa7) return;

      let recent = [];
      if (fs.existsSync(DEFAULT_RECENT_PATH)) recent = fs.readJsonSync(DEFAULT_RECENT_PATH);
      recent = [{ 
        path: projPath, 
        name: name || path.basename(projPath), 
        lastOpened: new Date().toISOString() 
      }, ...recent.filter((r) => r.path !== projPath)].slice(0, 10);
      fs.writeJsonSync(DEFAULT_RECENT_PATH, recent, { spaces: 2 });
    } catch (e) {
      console.error('[Recent] Failed to save project:', e);
    }
  }

  app.get('/api/v3/project/recent', (req, res) => {
    try {
      const recent = fs.existsSync(DEFAULT_RECENT_PATH) ? fs.readJsonSync(DEFAULT_RECENT_PATH) : [];
      res.json({ ok: true, projects: recent });
    } catch {
      res.json({ ok: true, projects: [] });
    }
  });

  // Save current project to recent on start ONLY if user already chose a project
  if (currentProjectRoot) {
    const hasFa7 = fs.existsSync(path.join(currentProjectRoot, '.fa7'));
    if (hasFa7) {
      saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));
    }
  }

  app.post('/api/v3/project/create', async (req, res) => {
    try {
      const { name, parentPath, template, goal } = req.body;
      if (!name || !parentPath) return res.status(400).json({ ok: false, error: 'name and parentPath required' });
      
      const projectPath = path.join(parentPath, name);
      console.log(`[Project Create] Creating project at: ${projectPath}`);
      
      await fs.ensureDir(projectPath);
      await ensureFa7Dir(projectPath);
      await initNotebook(projectPath);

      if (template === 'web') {
        await fs.writeFile(path.join(projectPath, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>${name}</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n`, 'utf8');
        await fs.writeFile(path.join(projectPath, 'style.css'), `/* ${name} styles */\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; padding: 20px; }\n`, 'utf8');
        await fs.writeFile(path.join(projectPath, 'app.js'), `// ${name} — main script\nconsole.log('${name} loaded');\n`, 'utf8');
      } else if (template === 'react') {
        await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), version: '0.1.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }, devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.0.0' } }, null, 2) + '\n', 'utf8');
        await fs.ensureDir(path.join(projectPath, 'src'));
        await fs.writeFile(path.join(projectPath, 'src/main.jsx'), `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n`, 'utf8');
        await fs.writeFile(path.join(projectPath, 'src/App.jsx'), `export default function App() {\n  return <div><h1>${name}</h1></div>;\n}\n`, 'utf8');
        await fs.writeFile(path.join(projectPath, 'index.html'), `<!DOCTYPE html>\n<html>\n<head><title>${name}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>\n`, 'utf8');
      } else if (template === 'node') {
        await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), version: '0.1.0', main: 'index.js', scripts: { start: 'node index.js', dev: 'nodemon index.js' } }, null, 2) + '\n', 'utf8');
        await fs.writeFile(path.join(projectPath, 'index.js'), `const http = require('http');\n\nconst server = http.createServer((req, res) => {\n  res.end('${name} is running');\n});\n\nserver.listen(3000, () => console.log('Server on http://localhost:3000'));\n`, 'utf8');
      } else if (template === 'python') {
        await fs.writeFile(path.join(projectPath, 'main.py'), `# ${name}\n\ndef main():\n    print("${name} started")\n\nif __name__ == "__main__":\n    main()\n`, 'utf8');
        await fs.writeFile(path.join(projectPath, 'requirements.txt'), '# Add dependencies here\n', 'utf8');
      } else {
        await fs.writeFile(path.join(projectPath, 'README.md'), `# ${name}\n\nProject created with FA7 OS.\n`, 'utf8');
      }

      currentProjectRoot = projectPath;
      saveConfig();
      saveRecentProject(projectPath, name);
      
      indexer = new Indexer(currentProjectRoot);
      indexerRef = indexer;
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
      agentKernelRef = kernel;
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      
      initServices();

      // If goal provided, trigger kernel mission AFTER switching
      if (goal) {
        console.log(`[Project Create] Starting autonomous mission for new project: ${goal}`);
        // We run it asynchronously to not block the project creation response,
        // but we return ok: true so the frontend switches to the new project.
        kernel.executeAutonomousLoop(goal).catch(e => console.error('[Project Create] Goal execution failed:', e));
      }

      res.json({ ok: true, path: projectPath, name });
    } catch (e) {
      console.error('[Project Create] Error:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/v3/project/switch-v2', async (req, res) => {
    const { path: newPath } = req.body;
    if (!newPath || !fs.existsSync(newPath)) return res.status(400).json({ error: 'Valid path required' });
    try {
      currentProjectRoot = path.resolve(newPath);
      saveConfig();
      indexer = new Indexer(currentProjectRoot);
      indexerRef = indexer;
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
      agentKernelRef = kernel;
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      initServices();
      saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));
      res.json({ ok: true, path: currentProjectRoot });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  await loadFa7Plugins();

  // Optional: Hoosh extension host routes. Missing module must not crash the
  // companion (otherwise the local bridge never binds and aihoosh.com can't connect).
  try {
    const { mountHooshExtensionRoutes } = require('./lib/hooshExtensionHost');
    mountHooshExtensionRoutes(app, PORT);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND' && /hooshExtensionHost/.test(e.message)) {
      console.warn('[FA7 OS] hooshExtensionHost not present — skipping (core extension routes still active)');
    } else {
      throw e;
    }
  }

  // Packaged Electron loads the UI from companion so /assets/* resolve correctly (file:// breaks absolute paths).
  if (process.env.FA7_ELECTRON_MODE) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FA7 OS companion on http://localhost:${PORT}`);
    console.log(`Project Root: ${currentProjectRoot || '(none — select a project in the UI)'}`);
  });

  // Keep process alive
  setInterval(() => {}, 10000);
}

process.on('SIGINT', () => {
  companionOllama.stopManagedOllama();
  process.exit(0);
});
process.on('SIGTERM', () => {
  companionOllama.stopManagedOllama();
  process.exit(0);
});

if (require.main === module || process.env.FA7_ELECTRON_MODE) {
  main().catch((err) => {
    console.error('[FA7 OS] Fatal:', err);
    companionOllama.stopManagedOllama();
    process.exit(1);
  });
}
