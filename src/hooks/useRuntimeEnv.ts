import { useEffect, useState } from 'react';
import { getRuntimeEnv } from '../lib/companionProbe';
import { getRuntimeEnvSync, type RuntimeEnv } from '../runtimeEnv';

export function useRuntimeEnv(): RuntimeEnv {
  const [env, setEnv] = useState<RuntimeEnv>(() => getRuntimeEnvSync());

  useEffect(() => {
    let alive = true;
    void getRuntimeEnv().then((next) => {
      if (alive) setEnv(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return env;
}
