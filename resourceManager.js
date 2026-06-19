const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

class ResourceManager {
    constructor() {
        this.RAM_BUFFER_PERCENT = 0.25;
        this.VRAM_BUFFER_PERCENT = 0.20;
        this.OFFLINE_NEEDED_PATH = process.env.FA7_OFFLINE_NEEDED_PATH
            || process.env.FA7_EXAMPLE_ROOT
            || path.join(os.homedir(), 'Desktop', 'example');
    }

    getHardwareStats() {
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const ramUsagePercent = ((totalRam - freeRam) / totalRam) * 100;

        let cpuBrand = 'Generic CPU';
        let diskInfo = { total: 'Unknown', used: '0', free: '0' };

        if (process.platform === 'darwin') {
            try {
                cpuBrand = execSync('sysctl -n machdep.cpu.brand_string').toString().trim();
            } catch (e) { /* ignore */ }
            try {
                const totalOutput = execSync('diskutil info / | grep "Container Total Space"').toString();
                const freeOutput = execSync('diskutil info / | grep "Container Free Space"').toString();

                const totalBytes = parseInt(totalOutput.match(/\((\d+) Bytes\)/)?.[1] || '0');
                const freeBytes = parseInt(freeOutput.match(/\((\d+) Bytes\)/)?.[1] || '0');

                const df = execSync('df -k').toString().split('\n');
                let usedKB = 0;
                df.forEach(line => {
                    if (line.includes('/System/Volumes/Data') || (line.match(/\/dev\/disk\d+s\d+s\d+\s+.* \/$/))) {
                        const parts = line.trim().split(/\s+/);
                        if (parts[2]) usedKB += parseInt(parts[2]);
                    }
                });

                const totalGB = (totalBytes / 1e9).toFixed(2);
                const freeGB = (freeBytes / 1e9).toFixed(2);
                const usedGB = (usedKB * 1024 / 1e9).toFixed(2);

                diskInfo = {
                    total: parseFloat(totalGB) > 950 ? '1TB' : `${totalGB} GB`,
                    used: `${usedGB} GB`,
                    free: `${freeGB} GB`
                };
            } catch (e) { /* ignore */ }
        } else {
            try {
                const model = os.cpus()[0]?.model?.trim();
                if (model) cpuBrand = model;
            } catch (e) { /* ignore */ }
        }

        let gpuCores = 0;
        if (process.platform === 'darwin') {
            try {
                const sp = execSync('system_profiler SPDisplaysDataType -json', {
                    encoding: 'utf8',
                    maxBuffer: 4 * 1024 * 1024
                });
                const j = JSON.parse(sp);
                const displays = j.SPDisplaysDataType || [];
                for (const d of displays) {
                    const raw = d.sppci_cores;
                    if (raw == null || raw === '') continue;
                    const n = parseInt(String(raw).trim(), 10);
                    if (!isNaN(n) && n > 0) {
                        gpuCores = n;
                        break;
                    }
                }
            } catch (e) { /* ignore */ }
        } else if (process.platform === 'linux') {
            try {
                const out = execSync(
                    'nvidia-smi --query-gpu=cuda_cores --format=csv,noheader,nounits 2>/dev/null',
                    { encoding: 'utf8', timeout: 8000 }
                ).trim();
                const first = out.split('\n')[0];
                const n = parseInt(first, 10);
                if (!isNaN(n) && n > 0) gpuCores = n;
            } catch (e) { /* ignore */ }
        }

        const gpuInfo = {
            vendor: cpuBrand.toLowerCase().includes('apple') ? 'apple' : 'none',
            total_vram: Math.floor(totalRam / (1024 * 1024)),
            free_vram: Math.floor(freeRam / (1024 * 1024)),
            compute_api: cpuBrand.toLowerCase().includes('apple') ? 'metal' : 'none',
            cores: gpuCores
        };

        const cpus = os.cpus();
        let logicalCpus = cpus.length;
        let physicalCpus = logicalCpus;
        let speedMhz = cpus[0]?.speed || 0;

        if (process.platform === 'darwin') {
            try {
                const p = parseInt(execSync('sysctl -n hw.physicalcpu').toString().trim(), 10);
                if (p > 0) physicalCpus = p;
            } catch (e) { /* ignore */ }
            try {
                const l = parseInt(execSync('sysctl -n hw.logicalcpu').toString().trim(), 10);
                if (l > 0) logicalCpus = l;
            } catch (e) { /* ignore */ }
            if (!speedMhz) {
                try {
                    const hz = parseInt(execSync('sysctl -n hw.cpufrequency_max 2>/dev/null').toString().trim(), 10);
                    if (!isNaN(hz) && hz > 0) speedMhz = Math.round(hz / 1e6);
                } catch (e) { /* ignore */ }
            }
        }

        const load = os.loadavg()[0];

        return {
            hardware: {
                gpu: gpuInfo,
                npu: { available: cpuBrand.includes('M'), capability: 'medium' },
                ram: {
                    total: Math.floor(totalRam / (1024 * 1024)),
                    free: Math.floor(freeRam / (1024 * 1024)),
                    memory_pressure: ramUsagePercent > 75 ? 'high' : (ramUsagePercent > 50 ? 'medium' : 'low'),
                    swap_usage: 0
                },
                cpu: {
                    cores: physicalCpus,
                    threads: logicalCpus,
                    load: load,
                    brand: cpuBrand,
                    speed_mhz: speedMhz
                },
                storage: diskInfo,
                cpu_brand: cpuBrand
            },
            system_load: {
                vram_usage_percent: gpuInfo.total_vram > 0 ? ((gpuInfo.total_vram - gpuInfo.free_vram) / gpuInfo.total_vram) * 100 : 0,
                ram_usage_percent: ramUsagePercent,
                cpu_load_percent: logicalCpus > 0 ? (load / logicalCpus) * 100 : 0
            }
        };
    }

    checkLocalNeeded(name) {
        try {
            const fs = require('fs');
            const path = require('path');
            const neededDirs = fs.readdirSync(this.OFFLINE_NEEDED_PATH);
            return neededDirs.some(d => d.toLowerCase().includes(name.toLowerCase()));
        } catch (e) {
            return false;
        }
    }

    checkDependency(type, name) {
        try {
            if (type === 'python_pip') {
                try {
                    execSync(`pip show ${name}`, { stdio: 'ignore' });
                    return true;
                } catch (e) {
                    // Fallback: check if we have the source in /needed
                    return this.checkLocalNeeded(name);
                }
            } else if (type === 'ollama_model') {
                const models = execSync('ollama list').toString();
                return models.includes(name);
            } else if (type === 'huggingface_model') {
                return this.checkLocalNeeded(name);
            } else if (type === 'cli') {
                try {
                    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
                    execSync(cmd, { stdio: 'ignore' });
                    return true;
                } catch (e) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    getRequiredDependencies(feature) {
        const deps = {
            'voice': [
                { type: 'python_pip', name: 'faster-whisper' },
                { type: 'python_pip', name: 'SpeechRecognition' },
                { type: 'python_pip', name: 'pyaudio' },
                { type: 'huggingface_model', name: 'Systran/faster-whisper-large-v3' }
            ],
            'negah': [
                { type: 'ollama_model', name: 'llava' } // Ensure vision model is present
            ],
            'media-whisper': [
                { type: 'python_pip', name: 'openai-whisper' },
                { type: 'cli', name: 'whisper' }
            ],
            'media-tts': [
                { type: 'python_pip', name: 'TTS' },
                { type: 'cli', name: 'piper' }
            ],
            'media-ocr': [
                { type: 'python_pip', name: 'paddleocr' },
                { type: 'cli', name: 'paddleocr' }
            ],
            'media-separate': [
                { type: 'python_pip', name: 'demucs' },
                { type: 'cli', name: 'demucs' }
            ]
        };
        return deps[feature] || [];
    }

    getMissingDependencies(feature) {
        const required = this.getRequiredDependencies(feature);
        return required.filter(d => !this.checkDependency(d.type, d.name));
    }

    static invalidInput() {
        return {
            error: {
                code: 'INVALID_INPUT',
                message: 'Missing or malformed input data.'
            }
        };
    }

    isFiniteNumber(v) {
        return typeof v === 'number' && Number.isFinite(v);
    }

    isOneOf(value, allowed) {
        return allowed.includes(value);
    }

    buildInputFromTask(task) {
        const safeTask = task && typeof task === 'object' ? task : {};
        const normalizedTask = {
            ...safeTask,
            priority: safeTask.priority || 'medium',
            latency_sensitive: typeof safeTask.latency_sensitive === 'boolean' ? safeTask.latency_sensitive : false
        };
        const stats = this.getHardwareStats();
        return {
            task: normalizedTask,
            hardware: stats.hardware,
            system_load: stats.system_load
        };
    }

    validateInputContract(input) {
        if (!input || typeof input !== 'object') return false;
        const { task, hardware, system_load } = input;
        if (!task || !hardware || !system_load) return false;
        if (!this.isOneOf(task.type, ['chat', 'coding', 'reasoning', 'summarization', 'background'])) return false;
        if (!this.isOneOf(task.priority, ['low', 'medium', 'high'])) return false;
        if (typeof task.latency_sensitive !== 'boolean') return false;

        if (!hardware.gpu || !hardware.npu || !hardware.ram || !hardware.cpu) return false;
        if (!this.isOneOf(hardware.gpu.vendor, ['nvidia', 'amd', 'apple', 'intel', 'none'])) return false;
        if (!this.isOneOf(hardware.gpu.compute_api, ['cuda', 'metal', 'rocm', 'none'])) return false;
        if (!this.isFiniteNumber(hardware.gpu.total_vram) || !this.isFiniteNumber(hardware.gpu.free_vram)) return false;

        if (typeof hardware.npu.available !== 'boolean') return false;
        if (!this.isOneOf(hardware.npu.capability, ['low', 'medium', 'high'])) return false;

        if (!this.isFiniteNumber(hardware.ram.total) || !this.isFiniteNumber(hardware.ram.free) || !this.isFiniteNumber(hardware.ram.swap_usage)) return false;
        if (!this.isOneOf(hardware.ram.memory_pressure, ['low', 'medium', 'high'])) return false;

        if (!this.isFiniteNumber(hardware.cpu.cores) || !this.isFiniteNumber(hardware.cpu.threads) || !this.isFiniteNumber(hardware.cpu.load)) return false;

        if (!this.isFiniteNumber(system_load.vram_usage_percent) || !this.isFiniteNumber(system_load.ram_usage_percent) || !this.isFiniteNumber(system_load.cpu_load_percent)) return false;
        return true;
    }

    getResourceTier(input) {
        const { hardware, system_load } = input;
        if (
            system_load.ram_usage_percent >= 75 ||
            system_load.vram_usage_percent >= 80 ||
            hardware.ram.free <= hardware.ram.total * 0.30
        ) return 'low';
        if (
            system_load.ram_usage_percent < 50 &&
            system_load.vram_usage_percent < 50 &&
            hardware.ram.free >= hardware.ram.total * 0.50
        ) return 'high';
        return 'medium';
    }

    getModelCandidates(task) {
        const compact = [
            { name: 'qwen:0.5b', scale: '1b', ram_gb: 1.2, vram_gb: 0.8 },
            { name: 'llama3.2:latest', scale: '3b', ram_gb: 2.6, vram_gb: 1.6 }
        ];
        const interactive = [
            { name: 'mistral:latest', scale: '7b', ram_gb: 8.0, vram_gb: 5.8 }
        ];
        const coding = [
            { name: 'codellama:13b', scale: '13b', ram_gb: 14.0, vram_gb: 10.0 },
            { name: 'deepseek-coder:33b', scale: '34b', ram_gb: 31.0, vram_gb: 21.0 },
            { name: 'mistral:latest', scale: '7b', ram_gb: 8.0, vram_gb: 5.8 }
        ];
        const heavyCloud = [{ name: 'gpt-oss:120b-cloud', scale: '70b+', cloud_only: true, ram_gb: 0.5, vram_gb: 0.2 }];

        if (task.type === 'chat') return interactive;
        if (task.type === 'coding') return coding;
        if (task.type === 'reasoning') {
            if (task.priority === 'high') return heavyCloud.concat(coding);
            return coding;
        }
        if (task.type === 'summarization' || task.type === 'background') return compact;
        return interactive;
    }

    getContextWindow(input, tier, reduceContext) {
        if (reduceContext || tier === 'low') return 2048;
        if (tier === 'high') return 8192;
        return 4096;
    }

    getConcurrentLimit(tier) {
        if (tier === 'low') return 1;
        if (tier === 'high') return 4;
        return 2;
    }

    quantizationFor(input, candidate, latencySensitive) {
        if (latencySensitive) return 'Q4_K_M';
        const freeRamRatio = input.hardware.ram.total > 0 ? input.hardware.ram.free / input.hardware.ram.total : 0;
        const freeVramRatio = input.hardware.gpu.total_vram > 0 ? input.hardware.gpu.free_vram / input.hardware.gpu.total_vram : 0;
        if (
            (candidate.scale === '7b' || candidate.scale === '13b') &&
            freeRamRatio > 0.55 &&
            freeVramRatio > 0.55
        ) return 'Q5_K_M';
        if (
            input.hardware.gpu.total_vram >= 24000 &&
            freeVramRatio > 0.70 &&
            input.system_load.vram_usage_percent < 40 &&
            (candidate.scale === '7b' || candidate.scale === '13b')
        ) return 'Q8_0';
        return 'Q4_K_M';
    }

    estimateFootprint(candidate, quantization, contextWindow) {
        const quantMultiplier = quantization === 'Q8_0' ? 1.8 : quantization === 'Q5_K_M' ? 1.2 : 1.0;
        const kvCacheGb = contextWindow >= 8192 ? 2.0 : contextWindow >= 4096 ? 1.0 : 0.5;
        const runtimeOverheadRamGb = 1.0;
        const runtimeOverheadVramGb = 0.5;
        return {
            ram_gb: candidate.ram_gb * quantMultiplier + kvCacheGb + runtimeOverheadRamGb,
            vram_gb: candidate.vram_gb * quantMultiplier + runtimeOverheadVramGb
        };
    }

    canRunLocal(input, mode, footprint) {
        const { hardware, system_load } = input;
        const projectedRamPercent = system_load.ram_usage_percent + (footprint.ram_gb * 1024 / Math.max(hardware.ram.total, 1)) * 100;
        if (projectedRamPercent > 75) return false;

        const ramReserved = hardware.ram.total * this.RAM_BUFFER_PERCENT;
        if (hardware.ram.free <= ramReserved) return false;

        if (mode === 'local_gpu') {
            const gpuUsable = hardware.gpu.vendor !== 'none' && this.isOneOf(hardware.gpu.compute_api, ['cuda', 'metal', 'rocm']);
            if (!gpuUsable) return false;
            const projectedVramPercent = system_load.vram_usage_percent + (footprint.vram_gb * 1024 / Math.max(hardware.gpu.total_vram, 1)) * 100;
            if (projectedVramPercent > 80) return false;
            const vramReserved = hardware.gpu.total_vram * this.VRAM_BUFFER_PERCENT;
            if (hardware.gpu.free_vram <= vramReserved) return false;
        }
        return true;
    }

    getRoutingDecision(rawInput) {
        const input = (rawInput && rawInput.task && rawInput.hardware && rawInput.system_load)
            ? rawInput
            : this.buildInputFromTask(rawInput);

        if (!this.validateInputContract(input)) {
            return ResourceManager.invalidInput();
        }

        const { task, hardware, system_load } = input;
        const level1 = system_load.ram_usage_percent >= 75 || system_load.vram_usage_percent >= 80;
        const level2 = system_load.ram_usage_percent >= 90 || system_load.vram_usage_percent >= 90;
        const tier = this.getResourceTier(input);

        const safety_actions = {
            compress_history: level1,
            reduce_context: level1,
            unload_background_models: level1 || task.latency_sensitive || level2,
            switch_to_cloud: level2
        };

        const allocated_context_window = this.getContextWindow(input, tier, safety_actions.reduce_context);
        const max_concurrent_agents = this.getConcurrentLimit(tier);
        const candidates = this.getModelCandidates(task);

        // NPU route for lightweight workloads only.
        if (
            (task.type === 'summarization' || task.type === 'background') &&
            hardware.npu.available &&
            this.isOneOf(hardware.npu.capability, ['medium', 'high']) &&
            !level2
        ) {
            return {
                routing_decision: {
                    execution_mode: 'local_npu',
                    selected_model: 'qwen:0.5b',
                    quantization: 'Q4_K_M',
                    allocated_context_window,
                    max_concurrent_agents
                },
                safety_actions,
                reasoning: 'Lightweight background/summarization routed to NPU for power-efficient local execution.'
            };
        }

        // Enforce cloud fallback under critical throttling.
        if (level2) {
            return {
                routing_decision: {
                    execution_mode: 'cloud',
                    selected_model: 'gpt-oss:120b-cloud',
                    quantization: 'Q4_K_M',
                    allocated_context_window: 2048,
                    max_concurrent_agents: 1
                },
                safety_actions,
                reasoning: 'Critical load detected (Level 2); forcing cloud fallback for stability.'
            };
        }

        // Latency-sensitive requests prefer smaller, already lightweight models.
        const orderedCandidates = task.latency_sensitive
            ? candidates.slice().sort((a, b) => a.ram_gb - b.ram_gb)
            : candidates;

        for (const candidate of orderedCandidates) {
            if (candidate.cloud_only) {
                return {
                    routing_decision: {
                        execution_mode: 'cloud',
                        selected_model: candidate.name,
                        quantization: 'Q4_K_M',
                        allocated_context_window,
                        max_concurrent_agents
                    },
                    safety_actions,
                    reasoning: 'Task demands heavy reasoning profile; cloud model selected.'
                };
            }

            const quantization = this.quantizationFor(input, candidate, task.latency_sensitive);
            const footprint = this.estimateFootprint(candidate, quantization, allocated_context_window);

            if (this.canRunLocal(input, 'local_gpu', footprint)) {
                return {
                    routing_decision: {
                        execution_mode: 'local_gpu',
                        selected_model: candidate.name,
                        quantization,
                        allocated_context_window,
                        max_concurrent_agents
                    },
                    safety_actions,
                    reasoning: `Local GPU selected with ${candidate.scale} profile under safe VRAM/RAM limits.`
                };
            }

            if (this.canRunLocal(input, 'local_cpu', footprint)) {
                return {
                    routing_decision: {
                        execution_mode: 'local_cpu',
                        selected_model: candidate.name,
                        quantization,
                        allocated_context_window,
                        max_concurrent_agents
                    },
                    safety_actions,
                    reasoning: `GPU path unsafe/unavailable; local CPU selected with quantized ${candidate.scale} model.`
                };
            }
        }

        return {
            routing_decision: {
                execution_mode: 'cloud',
                selected_model: 'gpt-oss:120b-cloud',
                quantization: 'Q4_K_M',
                allocated_context_window,
                max_concurrent_agents: 1
            },
            safety_actions: { ...safety_actions, switch_to_cloud: true },
            reasoning: 'No local candidate fits safety envelope (VRAM 80% / RAM 75% hard caps); routed to cloud.'
        };
    }
}

module.exports = ResourceManager;
