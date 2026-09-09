/**
 * HTTP-side permission gate — same ToolApprovalManager the kernel uses.
 * Companion routes that execute side effects without going through
 * kernel.executeTool MUST call this before acting.
 *
 * Frontend is never the authority: this runs in the companion process.
 * While approval is pending, ApprovalModal polls /api/v3/approval/pending.
 */
async function ensureHttpToolAllowed(approvalManager, toolName, args = {}, opts = {}) {
  if (!approvalManager || typeof approvalManager.needsApproval !== 'function') {
    return { ok: true, skipped: true };
  }
  const tool = String(toolName || '').trim();
  if (!tool) return { ok: false, error: 'tool name required' };

  if (!approvalManager.needsApproval(tool, args || {})) {
    return { ok: true, autoApproved: true };
  }

  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 120000;
  const decision = await approvalManager.requestApproval(tool, args || {}, timeoutMs);
  if (!decision?.approved) {
    return {
      ok: false,
      denied: true,
      category: decision?.category || null,
      error: 'Permission denied'
    };
  }
  return { ok: true, approved: true, category: decision.category };
}

module.exports = { ensureHttpToolAllowed };
