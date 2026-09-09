/**
 * Permission presets — UX bundles for sandbox + approval policy.
 * Maps onto ToolApprovalManager autoApprove / yolo without replacing the engine.
 */
const PRESETS = {
  safe: {
    id: 'safe',
    labelKey: 'permission.presetSafe',
    sandbox: 'workspace-write',
    approval: 'ask',
    privacy: 'local-only',
    yolo: false,
    autoApprove: {
      read: true,
      write: false,
      terminal: false,
      browser: false,
      mcp: false
    }
  },
  full: {
    id: 'full',
    labelKey: 'permission.presetFull',
    sandbox: 'danger-full-access',
    approval: 'never',
    privacy: 'hybrid',
    yolo: true,
    autoApprove: {
      read: true,
      write: true,
      terminal: true,
      browser: true,
      mcp: true
    }
  }
};

function detectPreset(config = {}) {
  if (config.yolo) return 'full';
  const aa = config.autoApprove || {};
  const safe = PRESETS.safe.autoApprove;
  const matchesSafe =
    !!aa.read === safe.read &&
    !!aa.write === safe.write &&
    !!aa.terminal === safe.terminal &&
    !!aa.browser === safe.browser &&
    !!aa.mcp === safe.mcp &&
    !config.yolo;
  if (matchesSafe) return 'safe';
  const full = PRESETS.full.autoApprove;
  const matchesFull =
    !!aa.read === full.read &&
    !!aa.write === full.write &&
    !!aa.terminal === full.terminal &&
    !!aa.browser === full.browser &&
    !!aa.mcp === full.mcp &&
    !!config.yolo;
  if (matchesFull) return 'full';
  return 'custom';
}

function applyPreset(approvalManager, presetId) {
  const id = String(presetId || '').toLowerCase();
  const preset = PRESETS[id];
  if (!preset || !approvalManager) {
    return { ok: false, error: 'unknown preset' };
  }
  const updated = approvalManager.save({
    yolo: preset.yolo,
    autoApprove: { ...preset.autoApprove },
    permissionPreset: preset.id,
    sandboxMode: preset.sandbox,
    approvalPolicy: preset.approval,
    privacyMode: preset.privacy
  });
  return {
    ok: true,
    preset: preset.id,
    sandbox: preset.sandbox,
    approval: preset.approval,
    privacy: preset.privacy,
    config: updated
  };
}

function describeCurrent(approvalManager) {
  const config = approvalManager?.getConfig?.() || {};
  const preset = config.permissionPreset && PRESETS[config.permissionPreset]
    ? config.permissionPreset
    : detectPreset(config);
  const def = PRESETS[preset] || null;
  return {
    preset,
    sandbox: config.sandboxMode || def?.sandbox || 'workspace-write',
    approval: config.approvalPolicy || (config.yolo ? 'never' : 'ask'),
    privacy: config.privacyMode || def?.privacy || 'hybrid',
    yolo: !!config.yolo,
    autoApprove: { ...(config.autoApprove || {}) },
    presets: Object.values(PRESETS).map((p) => ({
      id: p.id,
      sandbox: p.sandbox,
      approval: p.approval,
      privacy: p.privacy
    }))
  };
}

module.exports = {
  PRESETS,
  detectPreset,
  applyPreset,
  describeCurrent
};
