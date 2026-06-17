const { exec, execFile } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SystemHealth {
    constructor(options = {}) {
        this.systemDir = options.systemDir || path.join(os.homedir(), '.aivon-os');
        this.customToolsPath = path.join(this.systemDir, 'custom-tools.json');
        this.customTools = [];
        this.baseTools = [
            { name: 'Node.js', cmd: 'node -v' },
            { name: 'Python', cmd: 'python3 --version' },
            { name: 'C / C++', cmd: 'g++ --version' },
            { name: 'C# / .NET', cmd: 'dotnet --version' },
            { name: 'Java (JDK)', cmd: 'javac -version' },
            { name: 'PHP', cmd: 'php -v' },
            { name: 'Flutter', cmd: 'flutter --version' },
            { name: 'Dart', cmd: 'dart --version' },
            { name: 'Homebrew', cmd: 'brew -v' },
            { name: 'Go', cmd: 'go version' },
            { name: 'Rust', cmd: 'rustc --version' },
            { name: 'Ruby', cmd: 'ruby -v' },
            { name: 'Kotlin', cmd: 'kotlin -version' },
            { name: 'Swift', cmd: 'swift --version' },
            { name: 'R', cmd: 'R --version' },
            { name: 'SQL (MySQL)', cmd: 'mysql --version' },
            { name: 'Git', cmd: 'git --version' },
            { name: 'Ollama', cmd: 'ollama -v' },
            { name: 'Xcode Select', cmd: 'xcode-select -v' }
        ];
        this.installCommands = {
            'Node.js': {
                win32: 'winget install OpenJS.NodeJS',
                darwin: 'brew install node',
                linux: 'sudo apt install -y nodejs npm'
            },
            'Python': {
                win32: 'winget install Python.Python.3',
                darwin: 'brew install python',
                linux: 'sudo apt install -y python3 python3-pip'
            },
            'C / C++': {
                win32: 'winget install MSYS2.MSYS2',
                darwin: 'xcode-select --install',
                linux: 'sudo apt install -y build-essential'
            },
            'C# / .NET': {
                win32: 'winget install Microsoft.dotnet.SDK.8',
                darwin: 'brew install --cask dotnet-sdk',
                linux: 'sudo apt install -y dotnet-sdk-8.0'
            },
            'Java (JDK)': {
                win32: 'winget install Microsoft.OpenJDK.21',
                darwin: 'brew install openjdk',
                linux: 'sudo apt install -y default-jdk'
            },
            'PHP': {
                win32: 'winget install PHP.PHP',
                darwin: 'brew install php',
                linux: 'sudo apt install -y php'
            },
            'Flutter': {
                win32: 'winget install Google.Flutter',
                darwin: 'brew install --cask flutter',
                linux: 'sudo snap install flutter --classic'
            },
            'Dart': {
                win32: 'winget install Dart.Dart-SDK',
                darwin: 'brew tap dart-lang/dart && brew install dart',
                linux: 'sudo apt install -y apt-transport-https && sudo apt install -y dart'
            },
            'Go': {
                win32: 'winget install GoLang.Go',
                darwin: 'brew install go',
                linux: 'sudo apt install -y golang-go'
            },
            'Rust': {
                win32: 'winget install Rustlang.Rustup',
                darwin: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
                linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
            },
            'Ruby': {
                win32: 'winget install RubyInstallerTeam.Ruby',
                darwin: 'brew install ruby',
                linux: 'sudo apt install -y ruby-full'
            },
            'Kotlin': {
                win32: 'winget install JetBrains.Kotlin',
                darwin: 'brew install kotlin',
                linux: 'sudo snap install kotlin --classic'
            },
            'Swift': {
                win32: 'winget install Apple.Swift',
                darwin: 'xcode-select --install',
                linux: 'sudo apt install -y swiftlang'
            },
            'R': {
                win32: 'winget install RProject.R',
                darwin: 'brew install r',
                linux: 'sudo apt install -y r-base'
            },
            'SQL (MySQL)': {
                win32: 'winget install Oracle.MySQL',
                darwin: 'brew install mysql',
                linux: 'sudo apt install -y mysql-server'
            },
            'Homebrew': {
                darwin: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            },
            'Git': {
                win32: 'winget install Git.Git',
                darwin: 'brew install git',
                linux: 'sudo apt install -y git'
            }
        };
        this.uninstallCommands = {
            'Node.js': {
                win32: 'winget uninstall OpenJS.NodeJS',
                darwin: 'brew uninstall --ignore-dependencies node',
                linux: 'sudo apt remove -y nodejs npm'
            },
            'Python': {
                win32: 'winget uninstall Python.Python.3',
                darwin: 'brew uninstall --ignore-dependencies python',
                linux: 'sudo apt remove -y python3 python3-pip'
            },
            'C / C++': {
                win32: 'winget uninstall MSYS2.MSYS2',
                darwin: '',
                linux: 'sudo apt remove -y build-essential'
            },
            'C# / .NET': {
                win32: 'winget uninstall Microsoft.dotnet.SDK.8',
                darwin: 'brew uninstall --cask dotnet-sdk',
                linux: 'sudo apt remove -y dotnet-sdk-8.0'
            },
            'Java (JDK)': {
                win32: 'winget uninstall Microsoft.OpenJDK.21',
                darwin: 'brew uninstall --ignore-dependencies openjdk',
                linux: 'sudo apt remove -y default-jdk'
            },
            'PHP': {
                win32: 'winget uninstall PHP.PHP',
                darwin: 'brew uninstall --ignore-dependencies php',
                linux: 'sudo apt remove -y php'
            },
            'Flutter': {
                win32: 'winget uninstall Google.Flutter',
                darwin: 'brew uninstall --cask flutter',
                linux: 'sudo snap remove flutter'
            },
            'Dart': {
                win32: 'winget uninstall Dart.Dart-SDK',
                darwin: 'brew uninstall --ignore-dependencies dart',
                linux: 'sudo apt remove -y dart'
            },
            'Go': {
                win32: 'winget uninstall GoLang.Go',
                darwin: 'brew uninstall --ignore-dependencies go',
                linux: 'sudo apt remove -y golang-go'
            },
            'Rust': {
                win32: 'rustup self uninstall -y',
                darwin: 'rustup self uninstall -y',
                linux: 'rustup self uninstall -y'
            },
            'Ruby': {
                win32: 'winget uninstall RubyInstallerTeam.Ruby',
                darwin: 'brew uninstall --ignore-dependencies ruby',
                linux: 'sudo apt remove -y ruby-full'
            },
            'Kotlin': {
                win32: 'winget uninstall JetBrains.Kotlin',
                darwin: 'brew uninstall --ignore-dependencies kotlin',
                linux: 'sudo snap remove kotlin'
            },
            'Swift': {
                win32: 'winget uninstall Apple.Swift',
                darwin: '',
                linux: 'sudo apt remove -y swiftlang'
            },
            'R': {
                win32: 'winget uninstall RProject.R',
                darwin: 'brew uninstall --ignore-dependencies r',
                linux: 'sudo apt remove -y r-base'
            },
            'SQL (MySQL)': {
                win32: 'winget uninstall Oracle.MySQL',
                darwin: 'brew uninstall --ignore-dependencies mysql',
                linux: 'sudo apt remove -y mysql-server'
            },
            'Git': {
                win32: 'winget uninstall Git.Git',
                darwin: 'brew uninstall --ignore-dependencies git',
                linux: 'sudo apt remove -y git'
            },
            'Homebrew': {
                darwin: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"'
            }
        };
    }

    async init() {
        await fs.ensureDir(this.systemDir);
        try {
            if (await fs.pathExists(this.customToolsPath)) {
                const data = await fs.readJson(this.customToolsPath);
                this.customTools = Array.isArray(data?.tools) ? data.tools : [];
            }
        } catch {
            this.customTools = [];
        }
    }

    async persistCustomTools() {
        await fs.ensureDir(this.systemDir);
        await fs.writeJson(this.customToolsPath, { tools: this.customTools }, { spaces: 2 });
    }

    normalizeCustomTool(raw = {}) {
        const name = String(raw.name || '').trim();
        const check_cmd = String(raw.check_cmd || raw.checkCmd || '').trim();
        const install_cmd = String(raw.install_cmd || raw.installCmd || '').trim();
        const uninstall_cmd = String(raw.uninstall_cmd || raw.uninstallCmd || '').trim();
        return { name, check_cmd, install_cmd, uninstall_cmd };
    }

    getAllTools() {
        const customMapped = this.customTools.map((t) => ({
            name: t.name,
            cmd: t.check_cmd || `${t.name} --version`,
            is_custom: true
        }));
        return [...this.baseTools, ...customMapped];
    }

    async getCustomTools() {
        return [...this.customTools];
    }

    async addCustomTool(raw) {
        const tool = this.normalizeCustomTool(raw);
        if (!tool.name) return { ok: false, error: 'name is required' };
        if (!tool.install_cmd) return { ok: false, error: 'install_cmd is required' };
        const exists = this.customTools.find((t) => t.name.toLowerCase() === tool.name.toLowerCase());
        if (exists) {
            Object.assign(exists, tool);
        } else {
            this.customTools.push(tool);
        }
        await this.persistCustomTools();
        return { ok: true, tool };
    }

    async removeCustomTool(name) {
        const key = String(name || '').trim().toLowerCase();
        const before = this.customTools.length;
        this.customTools = this.customTools.filter((t) => t.name.toLowerCase() !== key);
        const removed = this.customTools.length !== before;
        if (removed) await this.persistCustomTools();
        return { ok: true, removed };
    }

    commandLooksDangerous(cmd) {
        const s = String(cmd || '').toLowerCase();
        const blocked = [
            /rm\s+-rf\s+\//,
            /mkfs/,
            /\bdd\s+if=/,
            /\bshutdown\b/,
            /\breboot\b/,
            /:\(\)\s*\{\s*:\|:&\s*\};:/
        ];
        return blocked.some((re) => re.test(s));
    }

    resolvePlatformCommand(spec) {
        if (!spec) return '';
        if (typeof spec === 'string') return spec;
        if (typeof spec !== 'object') return '';
        return spec[process.platform] || '';
    }

    escapeAppleScriptString(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    /**
     * Some installs on macOS need a real interactive terminal (password prompts, PATH init, etc).
     * This opens Terminal.app and runs the command in a login shell.
     */
    openMacTerminalAndRun(command, cwd) {
        return new Promise((resolve) => {
            const dir = cwd && typeof cwd === 'string' ? cwd : os.homedir();
            const cmdLine = `cd "${dir.replace(/"/g, '\\"')}" && clear && ${String(command || '').trim()}`;
            const script = `tell application "Terminal" to do script "${this.escapeAppleScriptString(cmdLine)}"`;
            execFile('osascript', ['-e', script], (err) => {
                resolve({ ok: !err, error: err ? String(err.message || err) : null });
            });
        });
    }

    shouldRunInMacTerminal(cmd) {
        const s = String(cmd || '').toLowerCase();
        // Anything that likely needs prompts or profile initialization.
        return (
            /\bbrew\b/.test(s) ||
            /\bxcode-select\s+--install\b/.test(s) ||
            /\bcurl\b/.test(s) ||
            /\brustup\b/.test(s) ||
            /\binstall\.sh\b/.test(s)
        );
    }

    runCommand(cmd) {
        return new Promise((resolve) => {
            exec(cmd, (err, stdout, stderr) => {
                resolve({
                    ok: !err,
                    stdout: String(stdout || ''),
                    stderr: String(stderr || ''),
                    code: err && Number.isInteger(err.code) ? err.code : 0
                });
            });
        });
    }

    async checkAll() {
        const brewBacked = {
            'Node.js': 'node',
            'Python': 'python',
            'Java (JDK)': 'openjdk',
            'PHP': 'php',
            'Dart': 'dart',
            'Go': 'go',
            'Ruby': 'ruby',
            'Kotlin': 'kotlin',
            'R': 'r',
            'SQL (MySQL)': 'mysql',
            'Git': 'git'
        };

        const tools = this.getAllTools();
        const results = await Promise.all(tools.map(async (tool) => {
            let status = 'missing';
            let version = null;

            const brewPkg = brewBacked[tool.name];
            if (brewPkg) {
                // For brew-managed tools, status should follow brew package presence.
                // This keeps UI consistent after "Remove" even if another global binary exists.
                const hasBrew = await this.runCommand('command -v brew');
                if (hasBrew.ok && hasBrew.stdout.trim()) {
                    const probe = await this.runCommand(`brew list --versions ${brewPkg}`);
                    if (probe.ok && probe.stdout.trim()) {
                        status = 'installed';
                        version = probe.stdout.trim();
                    }
                }
            } else {
                const probe = await this.runCommand(tool.cmd);
                status = probe.ok ? 'installed' : 'missing';
                const versionText = `${probe.stdout || ''}\n${probe.stderr || ''}`.trim();
                version = probe.ok && versionText ? versionText.split('\n')[0] : null;
            }

            return {
                name: tool.name,
                status,
                version,
                can_install: !!this.installCommands[tool.name] || !!this.customTools.find((t) => t.name === tool.name)?.install_cmd,
                can_uninstall: !!this.uninstallCommands[tool.name] || !!this.customTools.find((t) => t.name === tool.name)?.uninstall_cmd,
                is_custom: !!tool.is_custom
            };
        }));
        return results;
    }

    async installTool(name) {
        const custom = this.customTools.find((t) => t.name === name);
        const cmd = custom?.install_cmd || this.resolvePlatformCommand(this.installCommands[name]);
        if (!cmd) return { error: `No install command for ${name}` };
        if (this.commandLooksDangerous(cmd)) return { error: 'Blocked dangerous install command.' };

        // On macOS, run interactive installs in Terminal.app so prompts work.
        if (process.platform === 'darwin' && this.shouldRunInMacTerminal(cmd)) {
            // For brew-based tools, ensure Homebrew is bootstrapped first (also in Terminal).
            if (name !== 'Homebrew' && /\bbrew\b/.test(cmd)) {
                const brewProbe = await this.runCommand('command -v brew');
                if (!brewProbe.ok || !brewProbe.stdout.trim()) {
                    const brewInstall = this.resolvePlatformCommand(this.installCommands['Homebrew']);
                    const opened = await this.openMacTerminalAndRun(brewInstall, os.homedir());
                    if (!opened.ok) {
                        return { error: 'Failed to open Terminal for Homebrew install.', details: opened.error || '' };
                    }
                    return {
                        status: 'started',
                        interactive: true,
                        message: 'Opened Terminal to install Homebrew. Complete the prompts, then retry the install.',
                        command: brewInstall
                    };
                }
            }

            const opened = await this.openMacTerminalAndRun(cmd, os.homedir());
            if (!opened.ok) {
                return { error: 'Failed to open Terminal for install.', details: opened.error || '' };
            }
            return {
                status: 'started',
                interactive: true,
                message: 'Opened Terminal to run the install. Follow any prompts in Terminal, then refresh health.',
                command: cmd
            };
        }

        // On macOS, many installs rely on Homebrew. Bootstrap it once if missing.
        if (
            process.platform === 'darwin' &&
            name !== 'Homebrew' &&
            /\bbrew\b/.test(cmd)
        ) {
            const brewProbe = await this.runCommand('command -v brew');
            if (!brewProbe.ok || !brewProbe.stdout.trim()) {
                const brewInstall = this.resolvePlatformCommand(this.installCommands['Homebrew']);
                const boot = await this.runCommand(brewInstall);
                if (!boot.ok) {
                    return {
                        error: 'Homebrew is required but could not be installed automatically.',
                        details: (boot.stderr || boot.stdout || '').trim()
                    };
                }
            }
        }

        const out = await this.runCommand(cmd);
        if (!out.ok) {
            const msg = `${out.stderr}\n${out.stdout}`.toLowerCase();
            if (msg.includes('already installed') || msg.includes('is already installed') || msg.includes('already present')) {
                return { status: 'success', skipped: true, message: `${name} is already installed.` };
            }
            if (name === 'C / C++' || name === 'Swift') {
                if (msg.includes('already installed')) {
                    return { status: 'success', skipped: true, message: `${name} requirements are already installed.` };
                }
            }
            return { error: out.stderr || out.stdout || `Failed to install ${name}` };
        }

        return { status: 'success', output: out.stdout };
    }

    async uninstallTool(name) {
        const custom = this.customTools.find((t) => t.name === name);
        const cmd = custom?.uninstall_cmd || this.resolvePlatformCommand(this.uninstallCommands[name]);
        if (!cmd) return { error: `No uninstall command for ${name}` };
        if (this.commandLooksDangerous(cmd)) return { error: 'Blocked dangerous uninstall command.' };
        const uninstallChecks = {
            'Node.js': 'brew list --versions node',
            'Python': 'brew list --versions python',
            'Go': 'brew list --versions go',
            'Git': 'brew list --versions git',
            'Homebrew': 'command -v brew',
            'Rust': 'command -v rustup'
        };

        const checkCmd = uninstallChecks[name];
        if (checkCmd) {
            const probe = await this.runCommand(checkCmd);
            if (!probe.ok || !probe.stdout.trim()) {
                return {
                    status: 'success',
                    skipped: true,
                    message: `${name} is already absent.`
                };
            }
        }

        const out = await this.runCommand(cmd);
        if (!out.ok) {
            const msg = `${out.stderr}\n${out.stdout}`.toLowerCase();
            if (msg.includes('no such keg') || msg.includes('not installed')) {
                return {
                    status: 'success',
                    skipped: true,
                    message: `${name} is already absent.`
                };
            }
            return { error: out.stderr || out.stdout || `Failed to uninstall ${name}` };
        }
        return { status: 'success', output: out.stdout };
    }

    async runInstallCommand(command, opts = {}) {
        const cmd = String(command || '').trim();
        if (!cmd) return { ok: false, error: 'command is required' };
        if (this.commandLooksDangerous(cmd)) return { ok: false, error: 'Blocked dangerous install command.' };
        const out = await this.runCommand(cmd);
        if (!out.ok) {
            return { ok: false, error: out.stderr || out.stdout || 'Command failed' };
        }
        return {
            ok: true,
            output: out.stdout,
            source: opts.source || 'manual'
        };
    }
}

module.exports = SystemHealth;
