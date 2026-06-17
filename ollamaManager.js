const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

class OllamaManager {
    constructor(projectRoot, ollamaApiBase) {
        this.projectRoot = projectRoot;
        this.binDir = path.join(projectRoot, '.gira', 'bin');
        this.modelsDir = path.join(projectRoot, '.gira', 'models');
        this.ollamaPath = path.join(this.binDir, 'ollama');
        /** پایهٔ HTTP فعال (هم‌راستا با companionOllamaRuntime / Fard) */
        this.ollamaApiBase = (ollamaApiBase || 'http://127.0.0.1:11434').replace(/\/$/, '');
    }

    setOllamaApiBase(base) {
        const b = String(base || '').trim().replace(/\/$/, '');
        if (b) this.ollamaApiBase = b;
    }

    async init() {
        await fs.mkdir(this.binDir, { recursive: true });
        await fs.mkdir(this.modelsDir, { recursive: true });
    }

    async downloadOllama() {
        console.log("[Gira] Preparing local Ollama binary...");
        // In a real scenario, we'd detect OS and download the correct binary.
        // For this demo, we assume checking if it exists or symbolic linking it from the system.
        try {
            await fs.access(this.ollamaPath);
            return "Ollama already localized.";
        } catch (e) {
            // Simulated localization: link system ollama if available
            return new Promise((resolve) => {
                exec('which ollama', (err, stdout) => {
                    if (!err && stdout.trim()) {
                        fs.symlink(stdout.trim(), this.ollamaPath).then(() => resolve("Ollama localized via symlink."));
                    } else {
                        resolve("Ollama not found on system. Please install manually or use cloud fallback.");
                    }
                });
            });
        }
    }

    async pullModel(modelName) {
        console.log(`[Gira] Pulling model: ${modelName}...`);
        try {
            const res = await axios.post(`${this.ollamaApiBase}/api/pull`, { name: modelName }, { responseType: 'stream' });
            return `Started pulling ${modelName}`;
        } catch (err) {
            return `Failed to pull ${modelName}: ${err.message}`;
        }
    }

    async getStatus() {
        return {
            bin: this.ollamaPath,
            modelsDir: this.modelsDir,
            ollamaApiBase: this.ollamaApiBase,
            isReady: !!(await fs.access(this.ollamaPath).catch(() => false))
        };
    }
}

module.exports = OllamaManager;
