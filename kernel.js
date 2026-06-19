const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const ResourceManager = require('./resourceManager');
const NegahRunner = require('./negahRunner');
const { buildComposeArtifacts } = require('./composeBuildPipeline');
const { CheckpointManager } = require('./lib/checkpointManager');
const { SubagentRunner } = require('./lib/subagentRunner');
const { runPostEditChecks } = require('./lib/lintRunner');
const { runLintHealLoop, applyHealPatch } = require('./lib/lintHealLoop');
const { categorizeTool } = require('./lib/toolApproval');
const { applyEdit } = require('./lib/editFormats');
const { normalizeAgentResponse } = require('./lib/toolNormalizer');
const { compactWithLlm } = require('./lib/contextCompaction');
const { scanForSecrets, redactSecrets } = require('./lib/secretScanner');
const { recallFacts, upsertFact, upsertPattern } = require('./lib/memoryRecall');
const { deepResearch, fetchReadable } = require('./lib/deepResearch');
const { spawn, execSync } = require('child_process');

/** Industrial-Strength JSON Extractor (State Machine) */
function extractRobustJSON(text) {
    if (!text) return null;
    try {
        // Handle common ```json markers
        let clean = text.replace(/```json\s*([\s\S]*?)\s*```/ig, '$1');
        let start = clean.indexOf('{');
        if (start === -1) return null;
        
        let braceCount = 0;
        let inString = false;
        let escape = false;
        
        for (let i = start; i < clean.length; i++) {
            const ch = clean[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            
            if (!inString) {
                if (ch === '{') braceCount++;
                else if (ch === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        return JSON.parse(clean.substring(start, i + 1));
                    }
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

/** Extract first TOOL:{...} or bare tool JSON from agent text. */
function extractToolFromAgentResponse(text) {
    if (!text) return null;
    const { tool } = normalizeAgentResponse(text);
    return tool;
}

function extractAskFromAgentResponse(text) {
    const m = String(text || '').match(/\[ask\]\s*([\s\S]*?)(?=\[(?:thinking|executing|done|error)\]|$)/i);
    return m ? m[1].trim() : null;
}

class AgentKernel {
    constructor(projectRoot, ollamaUrl, indexer) {
        this.projectRoot = projectRoot;
        this.ollamaUrl = String(ollamaUrl || '').replace(/\/$/, '') || 'http://127.0.0.1:11434';
        this.indexer = indexer;
        this.memoryPath = path.join(projectRoot, '.fa7', 'memory.json');
        this.memory = { tasks: [], decisions: [], agents: {}, facts: [], learned_patterns: [] };
        this.vaultPath = path.join(require('os').homedir(), '.hoosh-os', 'tool_vault.json');
        this.vault = {};
        const SystemHealth = require('./systemHealth');
        this.sysHealth = new SystemHealth({ systemDir: path.join(projectRoot, '.fa7') });
        this.resManager = new ResourceManager();
        this.mcpManager = null;
        this.agentMode = 'agent';
        this.checkpointManager = new CheckpointManager(projectRoot);
        this.approvalManager = null;
        this.onApprovalRequired = null;
        this.sandboxRunner = null;
        this.llmGateway = null;
        this.autoCommit = true;
        this.dualModelEdits = true;
        this.deferWrites = true;
        this.missionResume = null;
        this.missionPausedExecution = null;
        this.MAX_TOOL_ROUNDS = 10;
        this.skillPrompts = ''; // injected system prompts from active Skills (S1)
        this._platformCtx = {};
    }

    setPlatformContext(ctx = {}) {
        this._platformCtx = { ...this._platformCtx, ...ctx };
    }

    /** Set the combined system-prompt block contributed by active Skills. */
    setSkillPrompts(text) {
        this.skillPrompts = String(text || '');
    }

    setDeferWrites(enabled) {
        this.deferWrites = !!enabled;
    }

    _emitDiffzone(emit, relPath, original, proposed) {
        if (!emit) return;
        emit('diffzone_start', { path: relPath, original });
        const step = Math.max(1200, Math.floor(proposed.length / 10));
        for (let i = 0; i < proposed.length; i += step) {
            emit('diffzone_update', { path: relPath, proposed: proposed.slice(0, i + step) });
        }
        emit('diffzone_complete', { path: relPath });
    }

    async _commitFileWrite(relPath, content, toolName, options = {}) {
        const fullPath = path.join(this.projectRoot, relPath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content);
        if (this.indexer?.trackRecentEdit) this.indexer.trackRecentEdit(relPath);
        if (this.onToolCall) this.onToolCall(toolName, { path: relPath, content });
        if (this.autoCommit) {
            try {
                gitWorkspace.stageFiles(this.projectRoot, [relPath]);
                gitWorkspace.commit(this.projectRoot, `hoosh: ${toolName} ${relPath}`);
            } catch { /* non-fatal */ }
        }
        const emit = options.emit;
        const lang = options.lang || 'en';
        if (options.runLint === false) return { written: true };
        const loop = await this.healFileWithLintLoop(relPath, lang, emit);
        return { written: true, lintLoop: loop };
    }

    async healFileWithLintLoop(relPath, lang = 'en', emit) {
        return runLintHealLoop({
            projectRoot: this.projectRoot,
            relPath,
            maxRetries: 2,
            emit,
            healFn: async ({ feedback }) => {
                try {
                    const full = path.join(this.projectRoot, relPath);
                    const content = await fs.readFile(full, 'utf8');
                    const repair = await this.runAgentTask(
                        'medic',
                        `Fix lint/test issues in ${relPath}.\n\nIssues:\n${feedback}\n\nCurrent file:\n${content.slice(0, 14000)}\n\nReply with TOOL: {"name":"writeFile"|"patchFile",...} or a single code fence with the full fixed file.`,
                        { lang }
                    );
                    const applied = await applyHealPatch(this.projectRoot, relPath, repair);
                    if (applied.ok) {
                        // 🧠 Learn from the fix: record symptom -> solution for next time.
                        const symptom = String(feedback || '').split('\n').find((l) => l.trim()) || feedback;
                        await this.rememberError(symptom, `Auto-healed in ${relPath} (${applied.method || 'patch'}).`)
                            .catch(() => {});
                    }
                    if (!applied.ok && this.llmGateway) {
                        const dual = await this.architectEditorPatch(relPath, `Fix: ${feedback.slice(0, 2000)}`, content);
                        if (dual?.patch) {
                            const result = applyEdit(dual.patch, content);
                            if (result.ok) {
                                await fs.writeFile(full, result.content, 'utf8');
                                return { ok: true };
                            }
                        }
                    }
                    return applied;
                } catch (e) {
                    return { ok: false, error: e.message };
                }
            }
        });
    }

    setLlmGateway(gw) {
        this.llmGateway = gw;
    }

    setWorkspaceManager(wm) {
        this.workspaceManager = wm || null;
        this.checkpointManager = new CheckpointManager(this.projectRoot, wm || null);
    }

    setAutoCommit(enabled) {
        this.autoCommit = !!enabled;
    }

    setSandboxRunner(runner) {
        this.sandboxRunner = runner;
    }

    setApprovalManager(mgr) {
        this.approvalManager = mgr;
    }

    setOnApprovalRequired(fn) {
        this.onApprovalRequired = fn;
    }

    buildMcpToolsBlock() {
        if (!this.mcpManager) return '';
        const tools = this.mcpManager.listTools();
        if (!tools.length) return '';
        const lines = tools.map((t) => `- ${t.id}: ${t.description || t.name}`).join('\n');
        return `\n[MCP TOOLS — call via TOOL: {"name":"mcpTool","args":{"toolId":"<id>","arguments":{...}}}]\n${lines}`;
    }

    setMcpManager(mgr) {
        this.mcpManager = mgr;
    }

    setAgentMode(mode) {
        this.agentMode = mode || 'agent';
    }

    beginCancelScope() {
        try {
            this.cancelController?.abort();
        } catch { /* ignore */ }
        this.cancelController = new AbortController();
        return this.cancelController.signal;
    }

    abortActiveMission() {
        try {
            this.cancelController?.abort();
        } catch { /* ignore */ }
    }

    isMissionAborted() {
        return !!this.cancelController?.signal?.aborted;
    }

    /** 🧠 FA7 Cognitive Persona Builder */
    buildSystemPrompt(role, extra = '') {
        const vaultKeys = Object.keys(this.vault).join(', ');
        const vaultHint = vaultKeys ? `\n\nVAULT ASSETS: You have access to saved scripts: [${vaultKeys}]. To run them, use command 'hoosh:vault:<name>'` : '';
        const voiceRules = `\n[VOICE RULES]: 1. Phonetic forgiveness. 2. Natural, concise speech. 3. No grammar policing.`;

        // Web Intelligence Directive
        const webHint = `\n[WEB INTELLIGENCE]: You have 'webSearch' (quick snippets) and 'deepResearch' (args: {query, maxPages?}) which fetches full pages from multiple sources and returns cited excerpts [n]. For library/API/version questions or anything you're unsure about, prefer 'deepResearch' and cite sources by [n] in your answer. Never trust stale memory for fast-changing facts.`;

        const memoryHint = `\n[PROJECT MEMORY]: You have 'remember' (args: {text, tags?}) to persist durable project facts/decisions, and 'recall' (args: {query}) to retrieve them. Remember conventions, gotchas, and decisions so future tasks don't repeat mistakes.`;

        // Base Cognitive Rules (Always Applied)
        const baseRules = `CRITICAL: Omit verbose explanations. Use cognitive tags ([thinking], [executing], etc.) on new lines. Output exactly: TOOL: { "name": "...", "args": {...} } if modifying code. RESPOND ONLY IN THE USER'S INPUT LANGUAGE.`;

        // 🧠 Inject Learned Patterns from Memory
        let learnedContext = "";
        if (this.memory.learned_patterns && this.memory.learned_patterns.length > 0) {
            learnedContext = "\n\n[KNOWN ISSUES & SOLUTIONS]:\n" + this.memory.learned_patterns
                .map(p => `- ISSUE: ${p.issue}\n  SOLUTION: ${p.solution}`)
                .join("\n");
        }

        const skillBlock = this.skillPrompts ? `\n\n${this.skillPrompts}` : '';
        const { PLATFORM_TOOLS_DOC } = require('./lib/platformAgentTools');
        const { MEDIA_TOOLS_DOC } = require('./lib/mediaAgentTools');
        const platformBlock = `\n\n${PLATFORM_TOOLS_DOC}\n\n${MEDIA_TOOLS_DOC}`;
        return `${baseRules}${learnedContext}${skillBlock}${platformBlock}${this.buildMcpToolsBlock()}\n\nROLE: ${role}\n${extra}${vaultHint}${voiceRules}${webHint}${memoryHint}`;
    }

    setOllamaUrl(url) {
        const u = String(url || '').trim().replace(/\/$/, '');
        if (u) this.ollamaUrl = u;
    }

    async resolveLocalModelName(preferredModel) {
        const aliasMap = {
            'mistral:7b': 'mistral:latest',
            'mistral': 'mistral:latest',
            'codellama:13b': 'codellama:latest',
            'deepseek-coder:6.7b': 'deepseek-coder:33b',
            'phi3:mini': 'qwen2.5:0.5b',
            'qwen2.5:32b': 'qwen2.5:0.5b'
        };
        const requested = aliasMap[preferredModel] || preferredModel;
        const fastPreference = [
            'qwen2.5:0.5b',
            'qwen:0.5b',
            'gemma3:1b',
            'mistral:latest',
            'mistral:7b',
            'llama3.2',
            'deepseek-coder:33b'
        ];
        try {
            const tags = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2500 });
            const models = Array.isArray(tags.data?.models) ? tags.data.models.map(m => m.name) : [];
            const ramFree = this.resManager?.getHardwareStats?.()?.hardware?.ram?.free || 99999;
            const heavyModels = ['deepseek-coder:33b', 'qwen2.5:32b', 'gemma3:27b', 'qwen3:30b'];
            const pool = ramFree < 4096
                ? models.filter((m) => !heavyModels.some((h) => m === h || m.startsWith(h.split(':')[0] + ':')))
                : models;
            const pickFrom = pool.length ? pool : models;
            if (pickFrom.includes(requested)) return requested;
            if (pickFrom.includes(preferredModel)) return preferredModel;
            for (const candidate of fastPreference) {
                if (pickFrom.includes(candidate)) return candidate;
            }
            return pickFrom[0] || requested;
        } catch (_) {
            return requested;
        }
    }

    async init() {
        try {
            await fs.mkdir(this.projectRoot, { recursive: true });
            await fs.mkdir(path.join(this.projectRoot, '.fa7'), { recursive: true });
            try {
                const data = await fs.readFile(this.memoryPath, 'utf8');
                const loaded = JSON.parse(data);
                this.memory = { tasks: [], decisions: [], agents: {}, facts: [], learned_patterns: [], ...loaded };
                if (!Array.isArray(this.memory.facts)) this.memory.facts = [];
                if (!Array.isArray(this.memory.learned_patterns)) this.memory.learned_patterns = [];
            } catch (e) { await this.saveMemory(); }
            
            // 🔒 Load Vault
            try {
                const vaultData = await fs.readFile(this.vaultPath, 'utf8');
                this.vault = JSON.parse(vaultData);
            } catch (e) { /* Vault does not exist yet */ }

            await this.sysHealth.init();
        } catch (e) {
            console.error("[Kernel] Initialization failed:", e.message);
        }
    }

    /** 🩺 Aivon Medic: Full-Body Scan */
    async runGlobalDiagnostics() {
        const health = await this.sysHealth.checkAll();
        const score = health.filter(t => t.status === 'installed').length / (health.length || 1);
        
        // 🧠 Proactive Pattern Discovery
        const environmentalFriction = [];
        if (this.memory.learned_patterns) {
            for (const pattern of this.memory.learned_patterns) {
                if (pattern.category === 'environment') {
                    environmentalFriction.push({
                        id: 'mem_pattern_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        type: 'memory_match',
                        title: pattern.issue,
                        severity: pattern.severity,
                        solution: pattern.solution,
                        can_self_heal: true
                    });
                }
            }
        }

        return {
            timestamp: Date.now(),
            score: Math.round(score * 100),
            subsystems: {
                infrastructure: health,
                workspace: environmentalFriction,
                neural: {
                    model_routing: 'active',
                    context_window: 4096,
                    memory_load: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB'
                }
            }
        };
    }

    /** 🏥 Aivon Medic: Surgical Repair */
    async applySurgicalRepair(diagnosticId) {
        if (diagnosticId.startsWith('mem_pattern_')) {
            const rootProps = path.join(this.projectRoot, 'gradle.properties');
            const fix = "# Neural Core Repair: Gradle JAVA_HOME Mitigation\norg.gradle.java.home_FIXED=true\n";
            await fs.writeFile(rootProps, fix);
            return { ok: true, message: 'Environmental friction resolved via memory-pattern patch.' };
        }
        return { ok: false, message: 'Unknown diagnostic ID.' };
    }

    async saveToVault(key, value) {
        this.vault[key] = value;
        try {
            await fs.mkdir(path.dirname(this.vaultPath), { recursive: true });
            await fs.writeFile(this.vaultPath, JSON.stringify(this.vault, null, 2));
            console.log(`[Vault] Script '${key}' saved successfully.`);
        } catch (e) {
            console.error(`[Vault] Failed to save script: ${e.message}`);
        }
    }

    async reloadVaultFromDisk() {
        try {
            const vaultData = await fs.readFile(this.vaultPath, 'utf8');
            this.vault = JSON.parse(vaultData);
        } catch {
            this.vault = {};
        }
    }

    async saveMemory() {
        await fs.writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2));
    }

    /** ContextEngine.remember — persist a durable project fact (deduped). */
    async rememberFact(text, { scope = 'project', tags = [] } = {}) {
        const t = String(text || '').trim();
        if (!t) return { ok: false, error: 'empty fact' };
        if (!Array.isArray(this.memory.facts)) this.memory.facts = [];
        this.memory.facts = upsertFact(this.memory.facts, { text: t, scope, tags });
        if (this.memory.facts.length > 500) this.memory.facts = this.memory.facts.slice(-500);
        await this.saveMemory();
        return { ok: true, count: this.memory.facts.length };
    }

    /** ContextEngine.recall — retrieve the most relevant project facts. */
    recallProjectFacts(query, limit = 5) {
        return recallFacts(this.memory.facts || [], query, limit);
    }

    /** Record a symptom -> fix learned pattern (deduped). Used by the heal loop. */
    async rememberError(issue, solution, { category = 'code', severity = 'medium' } = {}) {
        const i = String(issue || '').trim();
        if (!i) return { ok: false };
        if (!Array.isArray(this.memory.learned_patterns)) this.memory.learned_patterns = [];
        this.memory.learned_patterns = upsertPattern(this.memory.learned_patterns, {
            issue: i.slice(0, 400),
            solution: String(solution || '').slice(0, 400),
            category,
            severity
        });
        if (this.memory.learned_patterns.length > 300) this.memory.learned_patterns = this.memory.learned_patterns.slice(-300);
        await this.saveMemory();
        return { ok: true };
    }

    detectLanguage(text) {
        const s = String(text || '');
        if (/[\u0600-\u06FF]/.test(s)) return 'fa';
        return 'en';
    }

    t(_lang, _fa, en) {
        return en;
    }

    isLikelyPlaceholderPath(relPath) {
        const p = String(relPath || '').toLowerCase().trim();
        if (!p) return true;
        const base = path.basename(p);
        if (['file.txt', 'code.txt', 'output.txt', 'result.txt', 'newfile.txt', 'temp.txt'].includes(base)) return true;
        if (base === 'main.txt' || base === 'app.txt') return true;
        if (/\b(todo|notes?)\.(txt|md)$/.test(base)) return true;
        return false;
    }

    async collectProjectHints(root) {
        const out = [];
        const allowedExt = new Set(['.js', '.ts', '.tsx', '.py', '.css', '.html', '.json', '.md', '.java', '.go', '.rs']);
        const skipDir = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.venv', 'venv']);
        const walk = async (dir, depth = 0) => {
            if (out.length > 140 || depth > 4) return;
            let entries = [];
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (out.length > 140) break;
                const full = path.join(dir, entry.name);
                const rel = path.relative(root, full);
                if (!rel || rel.startsWith('..')) continue;
                if (entry.isDirectory()) {
                    if (skipDir.has(entry.name)) continue;
                    await walk(full, depth + 1);
                    continue;
                }
                if (!allowedExt.has(path.extname(entry.name))) continue;
                out.push(rel);
            }
        };
        await walk(root, 0);
        return out;
    }

    /** Securely execute shell commands using spawn */
    async safeRunCommand(command, cwd = this.projectRoot, env = process.env) {
        return new Promise((resolve) => {
            const isWin = process.platform === 'win32';
            const shell = isWin ? 'cmd.exe' : '/bin/bash';
            const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];
            
            const child = spawn(shell, args, { cwd, env, shell: false });
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            
            child.on('close', (code) => {
                if (code === 0) resolve(stdout || "Executed successfully.");
                else resolve(`Execution Error (Code ${code}): ${stderr || stdout || "Unknown error"}`);
            });

            child.on('error', (err) => {
                resolve(`Spawning Error: ${err.message}`);
            });
        });
    }

    async executeTool(name, args, emit) {
        const safeArgs = args || {};
        const toolName = String(name || '').trim();

        if (this.approvalManager?.needsApproval(toolName, safeArgs)) {
            const cat = categorizeTool(toolName);
            if (emit) emit('approval_required', { tool: toolName, args: safeArgs, category: cat });
            if (this.onApprovalRequired) {
                this.onApprovalRequired({ tool: toolName, args: safeArgs, category: cat });
            }
            const decision = await this.approvalManager.requestApproval(toolName, safeArgs);
            if (!decision.approved) {
                return 'Tool execution denied by user.';
            }
        }

        // Plan/Ask/Gather mode: read-only tools only
        const writeTools = new Set(['writeFile', 'patchFile', 'deleteFile', 'createDir', 'executeCommand', 'mcpTool']);
        if ((this.agentMode === 'plan' || this.agentMode === 'ask' || this.agentMode === 'gather') && writeTools.has(toolName)) {
            return `Blocked: ${toolName} is not allowed in ${this.agentMode} mode. Switch to agent mode to apply changes.`;
        }

        const normalizedTool = ({
            cd: 'changeDirectory',
            chdir: 'changeDirectory',
            cwd: 'changeDirectory',
            runCommand: 'executeCommand',
            shell: 'executeCommand',
            terminal: 'executeCommand',
            openFile: 'readFile',
            loadFile: 'readFile',
            saveFile: 'writeFile',
            updateFile: 'patchFile',
            editFile: 'patchFile',
            modifyFile: 'patchFile',
            webSearch: 'webSearch',
            search: 'webSearch',
            google: 'webSearch',
            googleSearch: 'webSearch',
            deepResearch: 'deepResearch',
            research: 'deepResearch',
            fetchUrl: 'fetchUrl',
            fetch: 'fetchUrl',
            remember: 'remember',
            recall: 'recall',
            memory: 'recall'
        })[toolName] || toolName;

        const requestedPath = String(safeArgs.path || '');
        if (requestedPath) {
            if (path.isAbsolute(requestedPath) || requestedPath.includes('..')) {
                return "Security Error: Path must be relative to project root.";
            }
        }
        const fullPath = path.join(this.projectRoot, requestedPath);
        console.log(`[Kernel] Executing tool: ${normalizedTool} on ${fullPath}`);

        try {
            if (normalizedTool === 'changeDirectory') {
                // Kernel already runs tools relative to projectRoot.
                return `Working directory is ${this.projectRoot}`;
            }
            if (normalizedTool === 'createDir') {
                await fs.mkdir(fullPath, { recursive: true });
                return `Directory created: ${safeArgs.path}`;
            }
            if (normalizedTool === 'writeFile') {
                let original = '';
                try { original = await fs.readFile(fullPath, 'utf8'); } catch { /* new file */ }
                const proposed = String(safeArgs.content || '');
                this._emitDiffzone(emit, safeArgs.path, original, proposed);
                if (this.deferWrites) {
                    if (emit) emit('proposed_write', { path: safeArgs.path, original, proposed, op: 'write' });
                    return `Proposal ready for ${safeArgs.path} (apply in editor to save).`;
                }
                await this._commitFileWrite(safeArgs.path, proposed, 'writeFile', { emit, lang: 'en' });
                return `File written: ${safeArgs.path}`;
            }
            if (normalizedTool === 'patchFile') {
                const existing = await fs.readFile(fullPath, 'utf8');
                let patchArgs = { ...safeArgs };

                if (this.dualModelEdits && this.llmGateway && !safeArgs.search && safeArgs.instruction) {
                    const dual = await this.architectEditorPatch(safeArgs.path, safeArgs.instruction, existing);
                    if (dual?.patch) patchArgs = { ...patchArgs, ...dual.patch, format: dual.patch.format || 'search_replace' };
                }

                const result = applyEdit(patchArgs, existing);
                if (!result.ok) return `Error: ${result.error}`;

                const proposed = String(result.content || '');
                this._emitDiffzone(emit, safeArgs.path, existing, proposed);
                if (this.deferWrites) {
                    if (emit) emit('proposed_write', { path: safeArgs.path, original: existing, proposed, op: 'patch' });
                    return `Patch proposal ready for ${safeArgs.path} (apply in editor to save).`;
                }
                await this._commitFileWrite(safeArgs.path, proposed, 'patchFile', { emit, lang: 'en' });
                return `File ${safeArgs.path} patched successfully.`;
            }
            if (normalizedTool === 'deleteFile') {
                await fs.unlink(fullPath);
                return `File deleted: ${safeArgs.path}`;
            }
            if (normalizedTool === 'readFile') {
                const content = await fs.readFile(fullPath, 'utf8');
                return content;
            }
            if (normalizedTool === 'webSearch') {
                let q = String(safeArgs.query || '');
                if (!q) return "Tool Error: webSearch requires a 'query' argument.";
                // Guardrail: never leak secrets to a third-party search service.
                const leaks = scanForSecrets(q);
                if (leaks.length) {
                    q = redactSecrets(q);
                    if (emit) emit('status', { message: `Redacted ${leaks.length} secret(s) from web search query.` });
                    console.warn(`[Security] Redacted ${leaks.length} secret(s) from webSearch query`);
                }
                console.log(`[Kernel] Independent Research: ${q}`);

                try {
                    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
                    const r = await axios.get(url, { timeout: 10000 });
                    const data = r.data || {};
                    const results = [];
                    
                    if (data.AbstractText) results.push(`[SUMMARY]: ${data.AbstractText}`);
                    
                    const topics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics.slice(0, 5) : [];
                    topics.forEach(t => {
                        if (t.Text) results.push(`[SOURCE]: ${t.Text} (URL: ${t.FirstURL || 'N/A'})`);
                    });

                    if (results.length === 0) {
                        // Fall back to a real SERP + page fetch when Instant Answer is empty.
                        const deep = await deepResearch(q, { maxPages: 3 }).catch(() => null);
                        if (deep?.ok && deep.text) {
                            return "SEARCH RESULTS (web pages, cited):\n" + deep.text;
                        }
                        return "No immediate web results found. Try a broader search term.";
                    }
                    return "SEARCH RESULTS (Snippets):\n" + results.join('\n');
                } catch (e) {
                    return `Web Search Connectivity Issue: ${e.message}`;
                }
            }

            if (normalizedTool === 'deepResearch') {
                let q = String(safeArgs.query || safeArgs.text || '');
                if (!q) return "Tool Error: deepResearch requires a 'query' argument.";
                const leaks = scanForSecrets(q);
                if (leaks.length) { q = redactSecrets(q); console.warn(`[Security] Redacted ${leaks.length} secret(s) from research query`); }
                if (emit) emit('status', { message: `Researching: ${q}` });
                const deep = await deepResearch(q, {
                    maxPages: Math.min(Number(safeArgs.maxPages) || 3, 5)
                }).catch((e) => ({ ok: false, error: e.message }));
                if (!deep.ok) return `Research failed: ${deep.error || 'no results'}`;
                return `DEEP RESEARCH (cite sources by [n] in your answer):\n${deep.text}`;
            }

            if (normalizedTool === 'fetchUrl') {
                const url = String(safeArgs.url || '');
                if (!/^https?:\/\//.test(url)) return "Tool Error: fetchUrl requires an http(s) url.";
                const text = await fetchReadable(url, Number(safeArgs.maxChars) || 2000).catch((e) => '');
                return text ? `PAGE (${url}):\n${text}` : `Could not fetch ${url}`;
            }
            if (normalizedTool === 'remember') {
                const text = String(safeArgs.text || safeArgs.fact || safeArgs.content || '').trim();
                if (!text) return "Tool Error: remember requires a 'text' argument.";
                const tags = Array.isArray(safeArgs.tags) ? safeArgs.tags : [];
                const r = await this.rememberFact(text, { scope: safeArgs.scope || 'project', tags });
                return r.ok ? `Remembered (project memory now holds ${r.count} facts).` : `Could not remember: ${r.error}`;
            }
            if (normalizedTool === 'recall') {
                const query = String(safeArgs.query || safeArgs.text || '').trim();
                if (!query) return "Tool Error: recall requires a 'query' argument.";
                const facts = this.recallProjectFacts(query, safeArgs.limit || 5);
                if (!facts.length) return "No relevant project memory found.";
                return "PROJECT MEMORY:\n" + facts.map((f) => `- ${f.text}`).join('\n');
            }
            if (normalizedTool === 'mcpTool') {
                if (!this.mcpManager) return 'MCP not available. Add servers to .fa7/mcp.json';
                const toolId = String(safeArgs.toolId || safeArgs.id || '');
                const toolArgs = safeArgs.arguments || safeArgs.args || {};
                try {
                    const result = await this.mcpManager.callTool(toolId, toolArgs);
                    return result.text || JSON.stringify(result.raw);
                } catch (e) {
                    return `MCP Error: ${e.message}`;
                }
            }

            if (normalizedTool === 'browserAgent') {
                const { runBrowserAgent } = require('./lib/browserAgentLoop');
                const { emitAgentVisualAction } = require('./lib/agentActionHub');
                const goal = String(safeArgs.goal || safeArgs.query || '').trim();
                if (!goal) return 'Tool Error: browserAgent requires goal';
                try {
                    const result = await runBrowserAgent(this.projectRoot, {
                        goal,
                        url: safeArgs.url,
                        maxSteps: safeArgs.maxSteps,
                        sandbox: this.sandboxRunner?.isEnabled?.(),
                        kavosh: null,
                        llmGenerate: this.llmGateway ? (p) => this.llmGateway.generate(p) : null,
                        onVisualAction: (action) => {
                            emitAgentVisualAction(action);
                            if (emit) emit('ui_action', action);
                        }
                    });
                    return JSON.stringify(result, null, 2);
                } catch (e) {
                    return `Browser agent error: ${e.message}`;
                }
            }

            if (normalizedTool === 'executeCommand') {
                let command = String(safeArgs.command || '').trim();
                
                // 🔒 Vault Interception
                if (command.startsWith('hoosh:vault:')) {
                    const scriptName = command.substring(12);
                    if (this.vault[scriptName]) {
                        console.log(`[Vault] Executing pre-approved script: ${scriptName}`);
                        return await this.safeRunCommand(this.vault[scriptName]);
                    }
                    return `Vault Error: Script '${scriptName}' not found in safe storage.`;
                }

                // Advanced security: command blacklist
                const blacklist = [
                    /rm\s+-rf\s+\//, /sudo\s+/, /chmod\s+777/, 
                    /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*:/, // fork bomb
                    /mkfs/, /dd\s+if=/, /format\s+/
                ];
                if (blacklist.some(p => p.test(command))) {
                    console.error(`[Security] Blocked dangerous command: ${command}`);
                    return "Security Error: Dangerous command blocked by Hoosh OS.";
                }

                if (this.sandboxRunner?.isEnabled()) {
                    const boxed = await this.sandboxRunner.run(command);
                    if (boxed) {
                        return boxed.ok
                            ? (boxed.stdout || 'Executed in sandbox.')
                            : `Sandbox Error: ${boxed.stderr || boxed.stdout || 'failed'}`;
                    }
                }

                if (command.includes('gradlew') && (command.includes('build') || command.includes('package'))) {
                    console.log("[Kernel] Intercepted Gradle build command.");
                    const isWin = process.platform === 'win32';
                    const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
                    const buildTask = ':desktop:packageDistributionForCurrentOS';
                    const fullCommand = `${gradleCmd} ${buildTask} --no-daemon`;

                    const buildEnv = Object.assign({}, process.env, { SKIP_ANDROID_BUILD: 'true' });
                    if (process.platform === 'darwin') {
                        try {
                            buildEnv.JAVA_HOME = execSync('/usr/libexec/java_home -v 17').toString().trim();
                        } catch {}
                    }
                    return await this.safeRunCommand(fullCommand, this.projectRoot, buildEnv);
                }

                return await this.safeRunCommand(command);
            }
            if (normalizedTool === 'buildCompose' || normalizedTool === 'buildComposeArtifacts') {
                const result = await buildComposeArtifacts({
                    projectRoot: this.projectRoot,
                    tasks: safeArgs.tasks,
                    dry_run: !!safeArgs.dry_run,
                    timeoutMs: safeArgs.timeoutMs
                });
                return JSON.stringify(result);
            }

            const { isPlatformTool, executePlatformTool } = require('./lib/platformAgentTools');
            if (isPlatformTool(normalizedTool)) {
                return executePlatformTool(normalizedTool, safeArgs, {
                    projectRoot: this.projectRoot,
                    kernel: this,
                    flowEngine: this._platformCtx?.flowEngine,
                    agentAutomation: this._platformCtx?.agentAutomation,
                    hitlGraph: this._platformCtx?.hitlGraph
                });
            }

            const { isMediaTool, executeMediaTool } = require('./lib/mediaAgentTools');
            if (isMediaTool(normalizedTool)) {
                return executeMediaTool(normalizedTool, safeArgs, {
                    projectRoot: this.projectRoot,
                    kernel: this
                });
            }

            return "Unknown tool";
        } catch (err) {
            return `Tool error: ${err.message}`;
        }
    }

    async runAgentTask(agentType, prompt, context = {}) {
        const onToken = context.onToken;
        const routingTask = {
            type: (['planner', 'architect'].includes(agentType)) ? 'reasoning' : 'coding',
            priority: context.priority || 'medium',
            latency_sensitive: !!context.latencySensitive
        };
        const routing = this.resManager.getRoutingDecision(routingTask);
        const routingDecision = routing?.routing_decision || {
            execution_mode: 'local_gpu',
            selected_model: 'mistral:latest',
            allocated_context_window: 4096
        };
        const stats = this.resManager.getHardwareStats();
        const hwContext = `[Hardware: ${stats.hardware.ram.total}MB RAM, OS: ${process.platform}]`;
        
        // 🔒 Dependency Check
        const feature = agentType === 'negah' ? 'negah' : (routingTask.type === 'voice' ? 'voice' : null);
        if (feature) {
            const missing = this.resManager.getMissingDependencies(feature);
            if (missing.length) {
                return JSON.stringify({
                    agent_resolution: {
                        status: "dependencies_missing",
                        action_required: "trigger_internal_downloader",
                        packages_to_install: missing.map(m => ({ type: m.type, names: [m.name] })),
                        message_to_user: `Downloading ${feature} tools...`
                    }
                });
            }
        }

        let selectedModel = await this.resolveLocalModelName(routingDecision.selected_model || 'mistral:latest');
        let targetUrl = this.ollamaUrl;
        const headers = {};

        // ☁️ Ollama Cloud Header Logic
        if (routingDecision.execution_mode === 'cloud') {
            targetUrl = 'https://ollama.com';
            if (process.env.OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
            else { 
                targetUrl = this.ollamaUrl; 
                selectedModel = await this.resolveLocalModelName(routingDecision.selected_model || 'mistral:latest');
            }
        }

        const systemPrompts = {
            product_manager: this.buildSystemPrompt('FA7 CEO (PM)', 'Break vision into requirements. JSON ONLY.'),
            architect: this.buildSystemPrompt('FA7 Architect', 'Plan projects. Output JSON plan: { "steps": [...] }.'),
            coder: this.buildSystemPrompt('FA7 Senior Engineer', 'Implement logic accurately. TOOL CALL ONLY.'),
            qa_engineer: this.buildSystemPrompt('QA specialist', 'Check for bugs and regressions.'),
            forensics_agent: this.buildSystemPrompt('FA7 Forensics', 'Analyze error log. IDENTIFY root cause (Syntax|Type|Missing|Logic).'),
            medic: this.buildSystemPrompt('FA7 Medic', `${hwContext} Apply fix suggested by forensics using TOOLS. TOOL CALL ONLY.`),
            devops_engineer: this.buildSystemPrompt('DevOps Engineer', 'Handle builds and packaging.')
        };

        const execute = async (p) => {
            const response = await axios.post(`${targetUrl}/api/generate`, {
                model: selectedModel,
                system: systemPrompts[agentType] || this.buildSystemPrompt('FA7 Agent'),
                prompt: p,
                stream: !!onToken,
                options: { num_ctx: routingDecision.allocated_context_window || 4096 }
            }, { headers, responseType: !!onToken ? 'stream' : 'json' });

            if (!!onToken) {
                let full = '';
                return new Promise((resolve) => {
                    response.data.on('data', c => {
                        const lines = c.toString().split('\n').filter(Boolean);
                        for (const l of lines) {
                            try {
                                const j = JSON.parse(l);
                                if (j.response) { full += j.response; onToken(j.response); }
                                if (j.done) resolve(full);
                            } catch {}
                        }
                    });
                });
            }
            return response.data.response;
        };

        // 👁️ Visual Logic: Negah Agent Loop
        if (agentType === 'negah') {
            const NegahAgent = require('./negahAgent');
            const { emitAgentVisualAction } = require('./lib/agentActionHub');
            const n = new NegahAgent(this.ollamaUrl);
            const runner = new (require('./negahRunner'))(this.projectRoot);
            let state = {
                trigger: context.trigger || 'manual',
                last_action_message: prompt,
                current_screen_base64: context.screen || "",
                elapsed_time_sec: 0
            };
            const started = Date.now();
            for (let i = 0; i < 5; i++) {
                if ((Date.now() - started) > 60000) break;
                const negahRes = await n.process(state);
                if (negahRes.agent_resolution) return JSON.stringify(negahRes);
                const cmdRes = await runner.runCommands(negahRes?.agent_action?.commands || [], {
                    cwd: this.projectRoot,
                    onVisual: emitAgentVisualAction
                });
                state.last_action_status = cmdRes.status;
                state.last_action_message = cmdRes.summary;
                if (cmdRes.screen_base64) state.current_screen_base64 = cmdRes.screen_base64;
            }
            return JSON.stringify({ agent_resolution: { status: 'aborted' } });
        }

        let result = await execute(prompt);

        // 🧠 Memory Cap (Prevent Leak)
        this.memory.tasks.push({ agent: agentType, timestamp: Date.now() });
        if (this.memory.tasks.length > 100) this.memory.tasks.shift();
        
        return result;
    }

    /** Phase 1: Planning - Convert goal to actionable steps */
    async _planningPhase(goal, notebookContext, contextStr, lang, emit) {
        if (this.isMissionAborted()) return { steps: [{ id: 1, task: goal, assignee: 'coder' }] };
        emit('status', { message: this.t(lang, `در حال طراحی معماری برای مأموریت...`, `Designing architecture for mission...`) });
        const planPrompt = `Goal: ${goal}\nRules & Context: ${notebookContext}\nProject Skeleton:\n${contextStr}\nProvide a JSON plan: { "steps": [{ "id": 1, "task": "...", "assignee": "frontend_engineer|backend_engineer|coder|devops" }] }`;
        
        let planStr;
        try {
            planStr = await this.runAgentTask('architect', planPrompt, { 
                lang,
                onToken: (t) => emit('token', { token: t, section: 'plan' })
            });
        } catch (e) {
            return { steps: [{ id: 1, task: `Implement the goal safely: ${goal}`, assignee: 'coder' }] };
        }

        const plan = extractRobustJSON(planStr);
        if (plan && Array.isArray(plan.steps)) {
            return { steps: plan.steps.slice(0, 7) }; // Cap steps for stability
        }
        return { steps: [{ id: 1, task: `Implement the goal: ${goal}`, assignee: 'coder' }] };
    }

    /** Phase 2: Execution - Loop through steps and manage state */
    async _executionPhase(goal, plan, missionRoot, contextStr, lang, emit) {
        const results = [];
        const startIdx = this.missionPausedExecution?.stepIndex ?? 0;
        const steps = plan.steps || [];
        for (let i = startIdx; i < steps.length; i++) {
            const step = steps[i];
            if (this.cancelController?.signal.aborted) break;

            emit('step_start', step);
            emit('status', { message: this.t(lang, `مرحله ${step.id} شروع شد: ${step.task}`, `Step ${step.id} started: ${step.task}`) });

            const stepResult = await this._stepProcess(step, goal, contextStr, results, lang, emit);
            results.push({ step: step.id, task: step.task, result: stepResult });

            if (stepResult?.paused) {
                this.missionPausedExecution = { goal, plan, missionRoot, contextStr, lang, results, stepIndex: i };
                return { paused: true, results };
            }

            emit('step_complete', { id: step.id, result: stepResult });

            emit('status', { message: this.t(lang, "در حال بازبینی کیفیت...", "QA Agent reviewing quality...") });
            await this.runAgentTask('qa_engineer', `Review result: ${JSON.stringify(stepResult)}`, { lang });
        }
        this.missionPausedExecution = null;
        return results;
    }

    /** Phase 3: Single Step Process — multi-turn tool loop */
    async _stepProcess(step, goal, contextStr, previousResults, lang, emit) {
        const assignee = step.assignee || 'coder';
        const generatePrompt = (extra = '') =>
            `Step: ${step.task}\nGoal: ${goal}\nContext: ${contextStr}\nPrevious Results: ${JSON.stringify(previousResults.slice(-2))}${extra}`;

        let toolContext = '';
        let lastModelText = '';

        for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
            if (this.isMissionAborted()) break;

            const result = await this.runAgentTask(assignee, generatePrompt(toolContext), {
                lang,
                onToken: (t) => emit('token', { token: t, stepId: step.id })
            });
            lastModelText = result;

            const askQ = extractAskFromAgentResponse(result);
            if (askQ) {
                this.missionResume = {
                    step, goal, contextStr, previousResults, lang, assignee, toolContext, question: askQ
                };
                emit('ask', { question: askQ, stepId: step.id });
                return { paused: true, question: askQ };
            }

            const toolCall = extractToolFromAgentResponse(result);
            if (!toolCall) {
                return toolContext ? `${toolContext}\n\n${result}` : result;
            }

            const toolResult = await this._toolCycle(toolCall, step, () => generatePrompt(toolContext), lang, emit);
            toolContext += `\n\n[TOOL ${toolCall.name} RESULT]\n${toolResult}`;

            if (toolContext.length > 14000) {
                emit('status', { message: this.t(lang, 'فشرده‌سازی context ابزار...', 'Compacting tool context...') });
                toolContext = await this._compactToolContext(toolContext, lang);
            }

            if (/denied by user/i.test(String(toolResult))) break;
        }

        return toolContext || lastModelText || 'Step completed.';
    }

    async implementPendingPlan(onEvent) {
        const exec = this.missionPausedExecution;
        if (!exec?.planOnly || !exec.plan) {
            return { ok: false, error: 'No pending plan to implement' };
        }
        this.setAgentMode('agent');
        exec.planOnly = false;
        this.missionPausedExecution = exec;
        const emit = (type, data) => onEvent && onEvent({ type, ...data });
        const lang = exec.lang || 'en';
        emit('status', { message: this.t(lang, 'اجرای طرح...', 'Implementing plan...') });
        const results = await this._executionPhase(exec.goal, exec.plan, exec.missionRoot, exec.contextStr, lang, emit);
        if (results?.paused) {
            return { ok: true, paused: true, plan: exec.plan, results };
        }
        const nbPath = path.join(exec.missionRoot, '.fa7', 'notebook.md');
        try {
            await fs.appendFile(nbPath, `\n### Implemented plan @ ${new Date().toLocaleString()}\n`);
        } catch { /* ignore */ }
        this.missionPausedExecution = null;
        emit('finish', { message: this.t(lang, 'اجرای طرح کامل شد.', 'Plan implementation complete.') });
        return { ok: true, plan: exec.plan, results };
    }

    async resumeMission(reply, onEvent) {
        const ctx = this.missionResume;
        if (!ctx) return { ok: false, error: 'No paused mission' };
        this.missionResume = null;
        const emit = (type, data) => onEvent && onEvent({ type, ...data });
        const lang = ctx.lang;
        const extra = `${ctx.toolContext || ''}\n\n[USER REPLY TO: ${ctx.question}]\n${reply}\n\nContinue the step. Use TOOL: if more work is needed.`;
        let toolContext = extra;
        let lastModelText = '';

        for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
            if (this.isMissionAborted()) break;
            const prompt = `Step: ${ctx.step.task}\nGoal: ${ctx.goal}\nContext: ${ctx.contextStr}\nPrevious Results: ${JSON.stringify((ctx.previousResults || []).slice(-2))}${toolContext}`;
            const result = await this.runAgentTask(ctx.assignee || 'coder', prompt, { lang, onToken: (t) => emit('token', { token: t, stepId: ctx.step.id }) });
            lastModelText = result;

            const askQ = extractAskFromAgentResponse(result);
            if (askQ) {
                this.missionResume = { ...ctx, toolContext, question: askQ };
                emit('ask', { question: askQ, stepId: ctx.step.id });
                return { ok: true, paused: true, question: askQ };
            }

            const toolCall = extractToolFromAgentResponse(result);
            if (!toolCall) {
                const stepResult = toolContext ? `${toolContext}\n\n${result}` : result;
                const exec = this.missionPausedExecution;
                if (exec) {
                    exec.results.push({ step: ctx.step.id, task: ctx.step.task, result: stepResult });
                    emit('step_complete', { id: ctx.step.id, result: stepResult });
                    emit('status', { message: this.t(lang, "در حال بازبینی کیفیت...", "QA Agent reviewing quality...") });
                    await this.runAgentTask('qa_engineer', `Review result: ${JSON.stringify(stepResult)}`, { lang });
                    exec.stepIndex = (exec.stepIndex ?? 0) + 1;
                    this.missionPausedExecution = exec;
                    const remaining = await this._executionPhase(exec.goal, exec.plan, exec.missionRoot, exec.contextStr, exec.lang, emit);
                    if (remaining?.paused) return { ok: true, paused: true };
                    const missionRoot = exec.missionRoot;
                    const nbPath = path.join(missionRoot, '.fa7', 'notebook.md');
                    try {
                        await fs.appendFile(nbPath, `\n### Resumed mission @ ${new Date().toLocaleString()}\n`);
                    } catch { /* ignore */ }
                    emit('finish', { message: this.t(lang, `مأموریت با موفقیت به پایان رسید.`, `Mission completed successfully.`) });
                    return { ok: true, result: stepResult, results: remaining };
                }
                return { ok: true, result: stepResult };
            }

            const toolResult = await this._toolCycle(toolCall, ctx.step, () => prompt, lang, emit);
            toolContext += `\n\n[TOOL ${toolCall.name} RESULT]\n${toolResult}`;
            if (/denied by user/i.test(String(toolResult))) break;
        }

        return { ok: true, result: toolContext || lastModelText || 'Step resumed.' };
    }

    /** Phase 4: Internal Tool Execution & Self-Healing Cycle */
    async _compactToolContext(toolContext, lang) {
        if (!toolContext || toolContext.length <= 14000) return toolContext;
        const chunks = toolContext.split(/\n\n\[TOOL /).filter(Boolean);
        const pseudo = chunks.map((c, i) => ({
            role: i % 2 === 0 ? 'assistant' : 'user',
            content: (i === 0 ? c : `[TOOL ${c}`).slice(0, 4000)
        }));
        if (this.llmGateway?.generate) {
            try {
                const llmGenerate = async ({ prompt, options }) => this.llmGateway.generate({
                    prompt,
                    role: 'chat',
                    options
                });
                const { messages } = await compactWithLlm(pseudo, llmGenerate, { keepRecent: 4 });
                const summary = messages.find((m) => m.role === 'system' && String(m.content).includes('LLM-compacted'));
                if (summary) {
                    return `## Compacted tool history\n${summary.content}\n\n${toolContext.slice(-8000)}`;
                }
            } catch { /* fallback below */ }
        }
        return '[... earlier tool output truncated ...]\n' + toolContext.slice(-12000);
    }

    async _toolCycle(toolCall, step, promptFactory, lang, emit, retryCount = 0) {
        if (this.isMissionAborted()) return 'Mission aborted';
        if (!toolCall || !toolCall.name) return 'No tool call';

        emit('status', { message: this.t(lang, `در حال اجرای ${toolCall.name}...`, `Executing ${toolCall.name}...`) });
        
        // 🛡 Checkpoint before write (inspired by Cline/Void)
        if (['writeFile', 'patchFile', 'deleteFile'].includes(toolCall.name)) {
            let files = [toolCall.args.path];
            if (this.workspaceManager && toolCall.args?.path) {
                const resolved = this.workspaceManager.resolveFile(toolCall.args.path);
                if (resolved) {
                    const ref = this.workspaceManager.toCheckpointRef(resolved.abs);
                    if (ref) files = [ref];
                }
            }
            const cp = await this.checkpointManager.create(`before-${toolCall.name}`, files);
            if (emit && cp?.id) {
                emit('checkpoint', { id: cp.id, label: cp.label, files: cp.files || [], tool: toolCall.name });
            }
        }

        const toolResult = await this.executeTool(toolCall.name, toolCall.args, emit);
        
        // Check for failure
        const isError = /error|fail|invalid/i.test(String(toolResult));
        if (isError && retryCount < 2) {
            emit('status', { message: this.t(lang, `تحلیل خطا و ترمیم خودکار...`, `Analyzing error and self-healing...`) });
            
            const forensics = await this.runAgentTask('forensics_agent', `Error: ${toolResult}\nTask: ${step.task}`, { lang });
            const repair = await this.runAgentTask('medic', `${promptFactory(`\n[REPAIR] Error: ${toolResult}`)}\nForensics: ${forensics}`, { lang });
            const nextTool = extractToolFromAgentResponse(repair);
            if (nextTool) return await this._toolCycle(nextTool, step, promptFactory, lang, emit, retryCount + 1);
            return toolResult;
        }
        
        if (['writeFile', 'patchFile'].includes(toolCall.name)) {
            emit('rescan', { path: toolCall.args.path });
        }
        return toolResult;
    }

    async architectEditorPatch(filePath, instruction, existingContent) {
        if (!this.llmGateway) return null;
        try {
            const plan = await this.llmGateway.generate({
                prompt: `File: ${filePath}\nInstruction: ${instruction}\n\nCurrent file (truncated):\n${String(existingContent).slice(0, 4000)}\n\nOutput ONLY JSON: {"format":"search_replace","search":"exact text","replace":"new text"}`,
                role: 'plan',
                options: { num_predict: 500 }
            });
            const patch = extractRobustJSON(plan);
            if (!patch?.search) return null;
            await this.llmGateway.generate({
                prompt: `Review patch for ${filePath}. Reply OK or FIX:\n${JSON.stringify(patch)}`,
                role: 'code',
                options: { num_predict: 80 }
            });
            return { patch };
        } catch {
            return null;
        }
    }

    async _createBackup(relPath) {
        if (!relPath) return;
        const backupDir = path.join(this.projectRoot, '.fa7', 'backups', Date.now().toString());
        await fs.mkdir(backupDir, { recursive: true });
        try {
            const src = path.resolve(this.projectRoot, relPath);
            await fs.copyFile(src, path.join(backupDir, path.basename(relPath)));
        } catch (e) {}
    }

    async executeAutonomousLoop(goal, options = {}) {
        const { onEvent, projectName: providedProjectName, modeInstructions, mode } = options;
        if (mode) this.setAgentMode(mode);
        this.beginCancelScope();
        const emit = (type, data) => onEvent && onEvent({ type, ...data });
        const lang = this.detectLanguage(goal);

        if (this.isMissionAborted()) {
            emit('error', { message: this.t(lang, 'مأموریت لغو شد.', 'Mission aborted.') });
            return { ok: false, aborted: true };
        }

        let missionRoot = this.projectRoot;
        if (providedProjectName) {
            missionRoot = path.join(this.projectRoot, providedProjectName);
            await fs.mkdir(missionRoot, { recursive: true });
        }

        const nbPath = path.join(missionRoot, '.fa7', 'notebook.md');
        await fs.mkdir(path.dirname(nbPath), { recursive: true });

        // 1. Prepare Context & Fast-Path
        let notebookContext = "";
        try { notebookContext = await fs.readFile(nbPath, 'utf8'); } catch (e) {}

        // 2. AI Mission Naming
        let missionName = "Agent Mission";
        try {
            const namePrompt = `Create a concise 2-3 word mission name for: ${goal.substring(0, 300)}. Output ONLY name.`;
            if (this.llmGateway?.generate) {
                const named = await this.llmGateway.generate({ prompt: goal, system: namePrompt, role: 'plan' });
                missionName = String(named || '').trim().replace(/['"]/g, '') || missionName;
            } else {
                const nameRes = await axios.post(`${this.ollamaUrl}/api/generate`, {
                    model: await this.resolveLocalModelName('mistral'),
                    system: namePrompt,
                    prompt: goal,
                    stream: false
                }, { timeout: 8000 });
                missionName = nameRes.data.response.trim().replace(/['"]/g, '') || "New Mission";
            }
        } catch (e) {}
        emit('mission_name', { name: missionName });
        emit('status', { message: this.t(lang, `مأموریت «${missionName}» شروع شد.`, `Mission "${missionName}" started.`) });

        const projectHints = await this.collectProjectHints(missionRoot);
        let contextStr = this.indexer ? this.indexer.getRelevantContext(goal) : projectHints.slice(0, 120).join(', ');
        if (this.indexer?.getRepoMap) {
            contextStr += '\n\n' + this.indexer.getRepoMap(goal, { maxChars: 6000 });
        }

        // Parallel read-only subagents for complex missions (Cline-inspired)
        if (goal.length > 50) {
            emit('status', { message: this.t(lang, 'ساب‌ایجنت‌ها در حال تحقیق...', 'Subagents researching codebase...') });
            const subRunner = new SubagentRunner(this);
            const subFindings = await subRunner.runParallel(goal, contextStr, {
                count: 3,
                onEvent: (ev) => onEvent && onEvent(ev)
            });
            contextStr += '\n\n## Subagent Research\n' + subFindings;
        }

        // 3. Planning Phase
        const plan = await this._planningPhase(goal, notebookContext, contextStr, lang, emit);
        emit('plan', plan);

        // Plan mode: stop after planning (VS Code / Cline Plan→Implement handoff)
        if (this.agentMode === 'plan') {
            this.missionPausedExecution = {
                goal, plan, missionRoot, contextStr, lang, results: [], stepIndex: 0, planOnly: true
            };
            emit('paused', { planOnly: true, message: this.t(lang, 'طرح آماده است.', 'Plan ready.') });
            emit('finish', {
                message: this.t(
                    lang,
                    'طرح آماده است. برای اجرای گام‌ها دکمه Implement را بزنید.',
                    'Plan ready. Press Implement to execute the steps.'
                )
            });
            return { ok: true, planOnly: true, paused: true, plan };
        }

        // 4. Execution Phase
        const results = await this._executionPhase(goal, plan, missionRoot, contextStr, lang, emit);
        if (results?.paused) {
            return { ok: true, paused: true, plan, results: results.results || results };
        }

        // 5. Finalize
        emit('status', { message: this.t(lang, `به‌روزرسانی دفترچه...`, `Updating notebook...`) });
        try {
            const summary = `\n### Mission: ${missionName} @ ${new Date().toLocaleString()}\nGoal: ${goal}\n`;
            await fs.appendFile(nbPath, summary);
        } catch (e) {}

        emit('finish', { message: this.t(lang, `مأموریت با موفقیت به پایان رسید.`, `Mission completed successfully.`) });
        return { ok: true, plan, results };
    }
}

module.exports = AgentKernel;
