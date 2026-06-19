import { useCallback, useEffect, useState } from 'react';
import { getRuntimeEnv, resetCompanionProbeCache } from '../lib/companionProbe';
import { getRuntimeEnvSync, isHostedWebApp, type RuntimeEnv } from '../runtimeEnv';

export function useRuntimeEnv(): RuntimeEnv & { refresh: () => void } {
  const [env, setEnv] = useState<RuntimeEnv>(() => getRuntimeEnvSync());

  const refresh = useCallback(() => {
    resetCompanionProbeCache();
    void getRuntimeEnv().then(setEnv);
  }, []);

  useEffect(() => {
    refresh();
    if (!isHostedWebApp()) return undefined;
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { ...env, refresh };
}
