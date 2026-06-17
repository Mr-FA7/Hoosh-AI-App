/**
 * JSDoc typedefs (documentation only; no runtime export required).
 */

/**
 * @typedef {object} OSProfile
 * @property {'win32'|'darwin'|'linux'} platform
 * @property {string} osName
 * @property {string} arch
 * @property {string} hostname
 * @property {string} release
 * @property {{ id: string, path: string, args: string[] }[]} shells
 * @property {string} defaultShellId
 * @property {{ id: string, cli: string }[]} packageManagers
 * @property {string} preferredPackageManager
 * @property {{ home: string, sep: string }} paths
 * @property {string} [distroId]
 * @property {string} [distroFamily]
 */

/**
 * @typedef {object} UnifiedExecResult
 * @property {string} stdout
 * @property {string} stderr
 * @property {number|null} exitCode
 * @property {string} shellId
 * @property {number} durationMs
 * @property {string} [error]
 */

export {};
