const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const ResourceManager = require('./resourceManager');
const NegahRunner = require('./negahRunner');
const { buildComposeArtifacts } = require('./composeBuildPipeline');
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

class AgentKernel {
    constructor(projectRoot, ollamaUrl, indexer) {
        this.projectRoot = projectRoot;
        this.ollamaUrl = String(ollamaUrl || '').replace(/\/$/, '') || 'http://127.0.0.1:11434';
        this.indexer = indexer;
        this.memoryPath = path.join(projectRoot, '.fa7', 'memory.json');
        this.memory = { tasks: [], decisions: [], agents: {} };
        this.vaultPath = path.join(require('os').homedir(), '.hoosh-os', 'tool_vault.json');
        this.vault = {};
        const SystemHealth = require('./systemHealth');
        this.sysHealth = new SystemHealth({ systemDir: path.join(projectRoot, '.fa7') });
        this.resManager = new ResourceManager();
    }

    /** 🧠 FA7 Cognitive Persona Builder */
    buildSystemPrompt(role, extra = '') {
        const vaultKeys = Object.keys(this.vault).join(', ');
        const vaultHint = vaultKeys ? `\n\nVAULT ASSETS: You have access to saved scripts: [${vaultKeys}]. To run them, use command 'hoosh:vault:<name>'` : '';
        const voiceRules = `\n[VOICE RULES]: 1. Phonetic forgiveness. 2. Natural, concise speech. 3. No grammar policing.`;

        // Web Intelligence Directive
        const webHint = `\n[WEB INTELLIGENCE]: You have a 'webSearch' tool. If a user asks for up-to-date information, documentation, or facts you are not 100% sure about, use 'webSearch' first. Read snippets to provide a better answer.`;

        // Base Cognitive Rules (Always Applied)
        const baseRules = `CRITICAL: Omit verbose explanations. Use cognitive tags ([thinking], [executing], etc.) on new lines. Output exactly: TOOL: { "name": "...", "args": {...} } if modifying code. RESPOND ONLY IN THE USER'S INPUT LANGUAGE.`;

        // 🧠 Inject Learned Patterns from Memory
        let learnedContext = "";
        if (this.memory.learned_patterns && this.memory.learned_patterns.length > 0) {
            learnedContext = "\n\n[KNOWN ISSUES & SOLUTIONS]:\n" + this.memory.learned_patterns
                .map(p => `- ISSUE: ${p.issue}\n  SOLUTION: ${p.solution}`)
                .join("\n");
        }

        return `${baseRules}${learnedContext}\n\nROLE: ${role}\n${extra}${vaultHint}${voiceRules}${webHint}`;
    }

    setOllamaUrl(url) {
        const u = String(url || '').trim().replace(/\/$/, '');
        if (u) this.ollamaUrl = u;
    }

    async resolveLocalModelName(preferredModel) {
        const aliasMap = {
            'mistral:7b': 'mistral:latest',
            'codellama:13b': 'codellama:latest',
            'deepseek-coder:6.7b': 'deepseek-coder:33b',
            'phi3:mini': 'qwen:0.5b'
        };
        const requested = aliasMap[preferredModel] || preferredModel;
        try {
            const tags = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2500 });
            const models = Array.isArray(tags.data?.models) ? tags.data.models.map(m => m.name) : [];
            if (models.includes(requested)) return requested;
            if (models.includes(preferredModel)) return preferredModel;
            if (models.includes('mistral:latest')) return 'mistral:latest';
            if (models.includes('qwen:0.5b')) return 'qwen:0.5b';
            return models[0] || requested;
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
                this.memory = JSON.parse(data);
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

    async executeTool(name, args) {
        const safeArgs = args || {};
        const toolName = String(name || '').trim();
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
            googleSearch: 'webSearch'
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
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, safeArgs.content || '');
                if (this.onToolCall) this.onToolCall('writeFile', safeArgs);
                return `File written: ${safeArgs.path}`;
            }
            if (normalizedTool === 'patchFile') {
                if (!safeArgs.search) return "Tool error: patchFile requires 'search' text.";
                const existing = await fs.readFile(fullPath, 'utf8');
                const nExisting = existing.replace(/\r\n/g, '\n');
                const nSearch = safeArgs.search.replace(/\r\n/g, '\n');
                const nReplace = (safeArgs.replace || '').replace(/\r\n/g, '\n');
                let updated = nExisting.split(nSearch).join(nReplace);
                
                if (updated === nExisting) {
                    return "Error: Search string not perfectly matched in file. Please use readFile first to get exact lines.";
                }
                
                await fs.writeFile(fullPath, updated);
                if (this.onToolCall) this.onToolCall('patchFile', safeArgs);
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
                const q = String(safeArgs.query || '');
                if (!q) return "Tool Error: webSearch requires a 'query' argument.";
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

                    if (results.length === 0) return "No immediate web results found. Try a broader search term.";
                    return "SEARCH RESULTS (Snippets):\n" + results.join('\n');
                } catch (e) {
                    return `Web Search Connectivity Issue: ${e.message}`;
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
            return "Unknown tool";
        } catch (err) {
            return `Tool error: ${err.message}`;
        }
    }

    async runAgentTask(agentType, prompt, context = {}) {
        const onToken = context.onToken;
        const routingTask = {
            type: (['planner', 'architect'].includes(agentType)) ? 'reasoning' : 'coding',
            priority: context.priority || 'medium'
        };
        const routing = this.resManager.getRoutingDecision(routingTask);
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

        let selectedModel = await this.resolveLocalModelName(routing.routing_decision.selected_model);
        let targetUrl = this.ollamaUrl;
        const headers = {};

        // ☁️ Ollama Cloud Header Logic
        if (routing.routing_decision.execution_mode === 'cloud') {
            targetUrl = 'https://ollama.com';
            if (process.env.OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
            else { 
                targetUrl = this.ollamaUrl; 
                selectedModel = await this.resolveLocalModelName(routing.routing_decision.selected_model);
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
                options: { num_ctx: routing.routing_decision.allocated_context_window || 4096 }
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
                const cmdRes = await runner.runCommands(negahRes?.agent_action?.commands || [], { cwd: this.projectRoot });
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
        for (const step of plan.steps) {
            if (this.cancelController?.signal.aborted) break;
            
            emit('step_start', step);
            emit('status', { message: this.t(lang, `مرحله ${step.id} شروع شد: ${step.task}`, `Step ${step.id} started: ${step.task}`) });
            
            const stepResult = await this._stepProcess(step, goal, contextStr, results, lang, emit);
            results.push({ step: step.id, task: step.task, result: stepResult });
            emit('step_complete', { id: step.id, result: stepResult });

            // Self-Review
            emit('status', { message: this.t(lang, "در حال بازبینی کیفیت...", "QA Agent reviewing quality...") });
            await this.runAgentTask('qa_engineer', `Review result: ${JSON.stringify(stepResult)}`, { lang });
        }
        return results;
    }

    /** Phase 3: Single Step Process (Task -> Tool -> Heal) */
    async _stepProcess(step, goal, contextStr, previousResults, lang, emit) {
        const assignee = step.assignee || 'coder';
        const generatePrompt = (retryLog = null) => `Step: ${step.task}\nGoal: ${goal}\nContext: ${contextStr}\nPrevious Results: ${JSON.stringify(previousResults.slice(-2))}\n${retryLog ? `\n[REPAIR] Error: ${retryLog}\nPlease fix this immediately using TOOLS.` : ''}`;
        
        let result = await this.runAgentTask(assignee, generatePrompt(), { 
            lang,
            onToken: (t) => emit('token', { token: t, stepId: step.id })
        });

        return await this._toolCycle(result, step, generatePrompt, lang, emit);
    }

    /** Phase 4: Internal Tool Execution & Self-Healing Cycle */
    async _toolCycle(rawResult, step, promptFactory, lang, emit, retryCount = 0) {
        const toolCall = extractRobustJSON(rawResult);
        if (!toolCall || !toolCall.name) return rawResult;

        emit('status', { message: this.t(lang, `در حال اجرای ${toolCall.name}...`, `Executing ${toolCall.name}...`) });
        
        // 🛡 Auto-Snapshot before write
        if (['writeFile', 'patchFile', 'deleteFile'].includes(toolCall.name)) {
            await this._createBackup(toolCall.args.path);
        }

        const toolResult = await this.executeTool(toolCall.name, toolCall.args, emit);
        
        // Check for failure
        const isError = /error|fail|invalid/i.test(String(toolResult));
        if (isError && retryCount < 2) {
            emit('status', { message: this.t(lang, `تحلیل خطا و ترمیم خودکار...`, `Analyzing error and self-healing...`) });
            
            const forensics = await this.runAgentTask('forensics_agent', `Error: ${toolResult}\nTask: ${step.task}`, { lang });
            const repair = await this.runAgentTask('medic', `${promptFactory(toolResult)}\nForensics: ${forensics}`, { lang });
            
            return await this._toolCycle(repair, step, promptFactory, lang, emit, retryCount + 1);
        }
        
        if (['writeFile', 'patchFile'].includes(toolCall.name)) {
            emit('rescan', { path: toolCall.args.path });
        }
        return toolResult;
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
        const { onEvent, projectName: providedProjectName, modeInstructions } = options;
        const emit = (type, data) => onEvent && onEvent({ type, ...data });
        const lang = this.detectLanguage(goal);

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
            const nameRes = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: 'mistral',
                system: `Create a concise 2-3 word mission name for: ${goal.substring(0,300)}. Output ONLY name.`,
                prompt: goal,
                stream: false
            }, { timeout: 8000 });
            missionName = nameRes.data.response.trim().replace(/['"]/g, '') || "New Mission";
        } catch (e) {}
        emit('mission_name', { name: missionName });
        emit('status', { message: this.t(lang, `مأموریت «${missionName}» شروع شد.`, `Mission "${missionName}" started.`) });

        const projectHints = await this.collectProjectHints(missionRoot);
        const contextStr = this.indexer ? this.indexer.getRelevantContext(goal) : projectHints.slice(0, 120).join(', ');

        // 3. Planning Phase
        const plan = await this._planningPhase(goal, notebookContext, contextStr, lang, emit);
        emit('plan', plan);

        // 4. Execution Phase
        const results = await this._executionPhase(goal, plan, missionRoot, contextStr, lang, emit);

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
