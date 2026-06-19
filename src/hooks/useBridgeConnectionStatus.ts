import { useCallback, useEffect, useRef, useState } from 'react';
import { checkBridgeSetup, resetCompanionProbeCache } from '../lib/companionProbe';
import { isHostedWebApp } from '../runtimeEnv';

export type BridgeHintKey = 'bridge.hintNoExtension' | 'bridge.hintNoCompanion' | 'bridge.hintRefreshPage';

export function useBridgeConnectionStatus(onConnected?: () => void) {
  const [extension, setExtension] = useState(false);
  const [companion, setCompanion] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hintKey, setHintKey] = useState<BridgeHintKey | undefined>();
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const refresh = useCallback(async (showChecking = false) => {
    if (!isHostedWebApp()) return;
    if (showChecking) setChecking(true);
    resetCompanionProbeCache();
    try {
      const status = await checkBridgeSetup();
      setExtension(status.extension);
      setCompanion(status.companion);
      setHintKey(status.hintKey);
      if (status.companion) onConnectedRef.current?.();
    } finally {
      if (showChecking) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!isHostedWebApp()) return;
    let cancelled = false;
    const run = async (showChecking: boolean) => {
      if (cancelled) return;
      await refresh(showChecking);
    };
    void run(true);
    const id = window.setInterval(() => void run(false), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  const manualRefresh = useCallback(async () => {
    setChecking(true);
    resetCompanionProbeCache();
    try {
      const status = await checkBridgeSetup();
      setExtension(status.extension);
      setCompanion(status.companion);
      setHintKey(status.hintKey);
      if (status.companion) onConnectedRef.current?.();
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    extension,
    companion,
    connected: companion,
    checking,
    hintKey,
    refresh: manualRefresh,
  };
}
