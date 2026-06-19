/**
 * Human-in-the-loop workflow graph (AgentCloud-inspired).
 */
const { randomUUID } = require('crypto');

class HitlGraph {
  constructor() {
    /** @type {Map<string, any>} */
    this.workflows = new Map();
  }

  create(name, steps) {
    const id = randomUUID();
    const wf = {
      id,
      name,
      steps: (steps || []).map((s, i) => ({
        id: s.id || `step-${i}`,
        label: s.label || `Step ${i + 1}`,
        type: s.type || 'agent',
        prompt: s.prompt || '',
        requiresApproval: s.requiresApproval !== false,
        status: 'pending'
      })),
      current: 0,
      status: 'running',
      createdAt: new Date().toISOString()
    };
    this.workflows.set(id, wf);
    return wf;
  }

  get(id) {
    return this.workflows.get(id) || null;
  }

  currentStep(id) {
    const wf = this.get(id);
    if (!wf || wf.status !== 'running') return null;
    return wf.steps[wf.current] || null;
  }

  approve(id, approved = true) {
    const wf = this.get(id);
    if (!wf) return null;
    const step = wf.steps[wf.current];
    if (!step) return wf;
    if (!approved) {
      wf.status = 'rejected';
      step.status = 'rejected';
      return wf;
    }
    step.status = 'approved';
    wf.current += 1;
    if (wf.current >= wf.steps.length) {
      wf.status = 'completed';
    } else {
      wf.steps[wf.current].status = 'active';
    }
    return wf;
  }

  completeStep(id, result = '') {
    const wf = this.get(id);
    if (!wf) return null;
    const step = wf.steps[wf.current];
    if (step) {
      step.result = result;
      step.status = 'done';
    }
    return wf;
  }

  list() {
    return Array.from(this.workflows.values());
  }
}

module.exports = { HitlGraph };
