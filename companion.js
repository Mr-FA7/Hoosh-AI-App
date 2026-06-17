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
const { downloadOllamaRuntimeIntoUserData } = require('./companionOllamaRuntimeDownload');
const { loadFa7Plugins } = require('./companionFa7Plugins');
const { KavoshBrowserKernel } = require('./kavoshBrowserKernel');
const { GiraBdtmKernel } = require('./giraBdtmKernel');

const PORT = 3001;
const PTY_WS_PORT = Number(process.env.FA7_PTY_PORT) || 3002;
const SYSTEM_DIR = path.join(require('os').homedir(), '.aivon-os');
const CONFIG_PATH = path.join(SYSTEM_DIR, 'fa7_config.json');
const RECENT_PATH = path.join(SYSTEM_DIR, 'recent-projects.json');

// Ensure System directory exists
fs.ensureDirSync(SYSTEM_DIR);

let currentProjectRoot = process.env.FA7_PROJECT_ROOT || process.cwd();
let notebookPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');

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

// Persistence Loader
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const config = fs.readJsonSync(CONFIG_PATH);
    if (config.projectRoot && fs.existsSync(config.projectRoot)) {
      currentProjectRoot = config.projectRoot;
    }
  } catch (e) {
    console.error('[Config] Failed to load config.json', e);
  }
}

function saveConfig() {
  try {
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
  app.use(cors());
  app.use(bodyParser.json({ limit: '5mb' }));

  mountStudioRoutes(app, { getActiveProjectRoot: () => currentProjectRoot });
  mountOllamaPullRoutes(app);
  mountOllamaApiProxyRoutes(app);
  mountUatRoutes(app);
  mountVmLabRoutes(app);

  const { port: resolvedPtyPort } = await companionShellPty.startPtyWebSocketServer({
    port: PTY_WS_PORT,
    defaultCwd: currentProjectRoot
  });
  companionShellPty.updateDefaultCwd(currentProjectRoot);
  console.log('[FA7 OS] Fard Terminal PTY WebSocket: ws://127.0.0.1:' + resolvedPtyPort);

  let indexer = new Indexer(currentProjectRoot);
  let kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
  let engine = new OllamaManager(currentProjectRoot, ollamaHttp());
  const negah = new NegahAgent(ollamaHttp());
  const negahRunner = new NegahRunner(currentProjectRoot);
  const github = new GitHubManager({
    systemDir: SYSTEM_DIR,
    getProjectRoot: () => currentProjectRoot
  });
  const health = new SystemHealth({ systemDir: SYSTEM_DIR });
  const resManager = new ResourceManager();
  const kavoshKernel = new KavoshBrowserKernel();
  const giraKernel = new GiraBdtmKernel();
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
    kernel.init().then(() => console.log('[Kernel] Ready'));
    indexer.scan();
  };

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
        const directRun = await negahRunner.runCommands(req.body.commands, { cwd: currentProjectRoot });
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

        const runnerResult = await negahRunner.runCommands(commands, { cwd: currentProjectRoot });
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
  app.get('/api/v3/project/path', (req, res) => {
    res.json({ path: currentProjectRoot, name: path.basename(currentProjectRoot) });
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
      saveConfig();
      saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));

      // Re-initialize services
      indexer = new Indexer(currentProjectRoot);
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      negahRunner.setProjectRoot(currentProjectRoot);
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      
      initServices();
      
      console.log(`[FA7 OS] Switched project root to: ${currentProjectRoot}`);
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
    const d = cwd && fs.existsSync(cwd) ? cwd : currentProjectRoot;
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
      exec(command, { cwd: currentProjectRoot, timeout: 120000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
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

  app.post('/api/ai/complete', async (req, res) => {
    try {
      const { prefix, suffix, fileName } = req.body;
      const prompt = `<file>${fileName}</file>\n${prefix}<cursor>${suffix}\nExtract only the next few lines of code to complete the cursor position. Be extremely concise.`;

      const response = await axios.post(`${ollamaHttp()}/api/generate`, {
        model: 'mistral',
        prompt: prompt,
        stream: false,
        options: { num_predict: 50, stop: ['\n\n', '```'] }
      });

      res.json({ suggestion: response.data.response });
    } catch (err) {
      res.status(500).json({ error: err.message });
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
      const dir = req.query.path ? path.join(currentProjectRoot, req.query.path) : currentProjectRoot;
      const files = await fs.readdir(dir);
      const result = [];
      
      for (const file of files) {
        // Filter hidden files
        if (file.startsWith('.') && !file.startsWith('.fa7/extensions')) continue;
        if (['node_modules', '.git', 'dist', '.DS_Store'].includes(file)) continue;

        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        result.push({
          name: file,
          isDirectory: stats.isDirectory(),
          path: path.relative(currentProjectRoot, filePath)
        });
      }
      res.json(result);
    } catch (err) {
      // Deleted project root, missing subfolder, or path no longer exists — show empty tree in UI
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
        return res.json([]);
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/file', '/api/v3/file'], async (req, res) => {
    try {
      const p = req.query.path;
      const filePath = path.isAbsolute(p) ? p : path.join(currentProjectRoot, p);
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
      currentProjectRoot = newPath;
      notebookPath = path.join(currentProjectRoot, '.fa7', 'notebook.md');
      await ensureFa7Dir(currentProjectRoot);
      await initNotebook(currentProjectRoot);
      indexer = new Indexer(currentProjectRoot);
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp());
      engine = new OllamaManager(currentProjectRoot, ollamaHttp());
      companionShellPty.updateDefaultCwd(currentProjectRoot);
      initServices();
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
      if (chatOnlyKeywords.some(kw => p.includes(kw)) && !/(build|create|fix|edit|change|research|search|download|نصب|ویرایش|تغییر|تحلیل)/.test(p)) {
          return 'chat';
      }

      // Heuristic bypass for common mission keywords
      const missionKeywords = [
          'build', 'create', 'make', 'refactor', 'save as', 
          'change', 'update', 'modify', 'patch', 'fix', 
          'verify', 'test', 'negah', 'check', 'add', 'remove',
          'research', 'analyze', 'analysis', 'internet', 'search web', 'download source',
          'تحقیق', 'تحلیل', 'بررسی', 'سرچ', 'دانلود', 'اینترنت', 'ترمینال', 'قابلیت'      ];
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

  function buildFriendlyChatSystemPrompt(_lang) {
    return [
      'You are a conversational assistant for FA7.',
      '**Language:** Always reply in the **same language as the user\'s latest message**. Only switch if they **explicitly** ask for another language (e.g. "answer in English"); then keep that until they ask otherwise. Stay consistent with this conversation\'s thread; a **new chat** has no prior language preference.',
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
    // Accept short greeting-like phrases such as "سلام خوبی؟"
    if (p.length <= 24 && /^(سلام|درود|hi|hello|hey)\b/.test(p)) return true;
    return false;
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

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, stream, model, mode, allowedModels } = req.body;
      const lastMessage = messages[messages.length - 1].content;
      const lang = detectLang(lastMessage);

      // Hard fast-path for short greetings to avoid accidental long generations.
      if (isSimpleGreeting(lastMessage)) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        writeJsonLine(res, {
          message: {
            content:
              'Hi 👋 I am here. Tell me exactly what you want and I will handle it step by step.'
          },
          agent_event: { type: 'done', message: 'Greeting handled directly.', done: true }
        });
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
      } else if (mode === 'ask') {
          intent = 'chat';
      }
      
      console.log(`[FA7 OS] Intent for "${lastMessage.substring(0, 30)}...": ${intent} (Mode: ${mode || 'default'})`);

      if (intent === 'mission') {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          
          try {
              const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
              await kernel.executeAutonomousLoop(lastMessage, { 
                  modeInstructions: systemPrompt,
                  onEvent: async (event) => {
                      if (event.type === 'rescan') {
                          console.log(`[FA7 OS] Task modified disk. Rescanning ${event.path}...`);
                          if (typeof indexer.scan === 'function') {
                              await indexer.scan();
                          }
                      }
                      writeJsonLine(res, { message: { content: '' }, agent_event: event });
                  }
              });
          } catch (e) {
              console.error("[FA7 OS] Mission Loop Error:", e);
              writeJsonLine(res, {
                message: { content: '' },
                agent_event: { type: 'error', message: e.message }
              });
          }
          
          return res.end();
      }

      const chatPayload = { ...req.body };
      if (Array.isArray(chatPayload.messages)) {
        const incoming = [...chatPayload.messages];
        const friendly = buildFriendlyChatSystemPrompt(lang);
        const firstSys = incoming.findIndex((m) => m && m.role === 'system');
        if (firstSys >= 0) {
          /** One merged system block so Ollama/local models do not ignore the IDE workspace prompt. */
          const merged = `${friendly}\n\n---\n${String(incoming[firstSys].content || '')}`;
          incoming[firstSys] = { ...incoming[firstSys], content: merged };
          chatPayload.messages = incoming;
        } else {
          chatPayload.messages = [{ role: 'system', content: friendly }, ...incoming];
        }
      }

      let selectedModel = chatPayload.model;
      let availableFallbacks = (allowedModels || []).filter(m => String(m).trim() !== String(selectedModel).trim());
      let response = null;
      let attemptError = null;

      const tryChat = async (mName) => {
        console.log(`[FA7 OS] Chat Route Invoking Model: ${mName}`);
        const finalPayload = { ...chatPayload, model: String(mName).trim() };
        return await axios.post(`${ollamaHttp()}/api/chat`, finalPayload, {
          responseType: 'stream',
          timeout: 45000 // reasonable timeout for network vs connection refused
        });
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

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!response) {
         writeJsonLine(res, { message: { content: '' }, agent_event: { type: 'error', message: `Model Connection Error. All selected models failed. (Last: ${attemptError})` } });
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
              return res.end();
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
        res.end();
      });
      response.data.on('error', (e) => {
        writeJsonLine(res, {
          message: { content: '' },
          agent_event: { type: 'error', message: sanitizeText(e?.message, 'Model stream error.') }
        });
        res.end();
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
      const response = await axios.get(`${ollamaHttp()}/api/tags`);
      res.json(response.data);
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
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await kernel.executeAutonomousLoop(goal, { 
          projectName: finalProjectName,
          onEvent: (event) => {
              writeJsonLine(res, { agent_event: event });
          }
      });
      res.end();
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

  // Save current project to recent on start ONLY if it's a valid project dir
  const hasFa7 = fs.existsSync(path.join(currentProjectRoot, '.fa7'));
  if (hasFa7) {
    saveRecentProject(currentProjectRoot, path.basename(currentProjectRoot));
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
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
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
      kernel = new AgentKernel(currentProjectRoot, ollamaHttp(), indexer);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FA7 OS companion on http://localhost:${PORT}`);
    console.log(`Project Root: ${currentProjectRoot}`);
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
