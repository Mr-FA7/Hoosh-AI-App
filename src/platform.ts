/** Back-compat re-exports — prefer `runtimeEnv.ts` and `useRuntimeEnv()`. */
export {
  isElectron,
  isMobileWeb,
  isHostedWebApp,
  isLocalCompanionWeb,
  isLocalDevWeb,
  prefersBrowserFolderPicker,
  getRuntimeEnvSync,
  type RuntimeEnv,
  type RuntimeSurface,
} from './runtimeEnv';
