import { useCallback, useEffect, useState } from 'react';
import { checkBridgeSetup, resetCompanionProbeCache } from '../lib/companionProbe';
import { isHostedWebApp } from '../runtimeEnv';

export type BridgeHintKey = 'bridge.hintNoExtension' | 'bridge.hintNoCompanion' | 'bridge.hintRefreshPage';

export function useBridgeConnectionStatus(onConnected?: () => void) {
  const [extension, setExtension] = useState(false);
  const [companion, setCompanion] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hintKey, setHintKey] = useState<BridgeHintKey | undefined>();

  const refresh = useCallback(async () => {
    if (!isHostedWebApp()) return;
    setChecking(true);
    resetCompanionProbeCache();
    try {
      const status = await checkBridgeSetup();
      setExtension(status.extension);
      setCompanion(status.companion);
      setHintKey(status.hintKey);
      if (status.companion) onConnected?.();
    } finally {
      setChecking(false);
    }
  }, [onConnected]);

  useEffect(() => {
    if (!isHostedWebApp()) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return {
    extension,
    companion,
    connected: companion,
    checking,
    hintKey,
    refresh,
  };
}
