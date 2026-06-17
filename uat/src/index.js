/**
 * Public API surface for embedding (Electron, VS Code, etc.)
 */

export { getOSProfile, pickShell } from './core/os-detector.js';
export { executeCommand } from './core/shell-engine.js';
export { resolveIntent, listIntents } from './core/unified-commands.js';
export { classifyInput, routeAndExecute } from './core/command-router.js';
export { evaluateCommand, isSandboxMode } from './safety/policy.js';
export { logExecution, getUatHome } from './safety/logger.js';
export { naturalLanguageToCommand } from './ai/command-intelligence.js';
export { fetchSecure } from './connectivity/http-client.js';
export { detectProjects } from './runtime/package-managers.js';
export { getInstallRecipe, listSupportedRuntimes } from './runtime/runtime-manager.js';
export { checkForUpdate, downloadAndVerify } from './update/self-update.js';
export { loadPlugins, registerPlugins } from './plugins/loader.js';
