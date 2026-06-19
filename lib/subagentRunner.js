/**
 * Parallel read-only subagents for codebase research (Cline-inspired pattern).
 */
const path = require('path');

const READ_ONLY_TOOLS = new Set(['readFile', 'webSearch', 'changeDirectory']);

class SubagentRunner {
  constructor(kernel) {
    this.kernel = kernel;
  }

  async runParallel(goal, contextStr, options = {}) {
    const { count = 3, onEvent } = options;
    const emit = (type, data) => onEvent && onEvent({ type, ...data });

    const angles = [
      { id: 'structure', focus: 'Project structure, entry points, and main modules' },
      { id: 'deps', focus: 'Dependencies, imports, and external integrations' },
      { id: 'patterns', focus: 'Coding patterns, conventions, and test setup' }
    ].slice(0, count);

    emit('subagents_start', { count: angles.length });

    const prevMode = this.kernel.agentMode;
    this.kernel.setAgentMode('plan');

    const tasks = angles.map(async (angle) => {
      emit('subagent_start', { id: angle.id, focus: angle.focus });
      const prompt = `Research task (READ ONLY — no file writes):\nGoal: ${goal}\nFocus: ${angle.focus}\n\nContext:\n${contextStr.slice(0, 6000)}\n\nSummarize findings in 5-10 bullet points. Use readFile only if needed.`;
      try {
        const result = await this.kernel.runAgentTask('coder', prompt, {
          lang: 'en',
          priority: 'low'
        });
        emit('subagent_complete', { id: angle.id, result: String(result).slice(0, 3000) });
        return { id: angle.id, focus: angle.focus, result: String(result).slice(0, 3000) };
      } catch (e) {
        emit('subagent_error', { id: angle.id, error: e.message });
        return { id: angle.id, focus: angle.focus, result: `Error: ${e.message}` };
      }
    });

    const results = await Promise.all(tasks);
    this.kernel.setAgentMode(prevMode);
    emit('subagents_complete', { results });

    const merged = results
      .map((r) => `## Subagent [${r.id}]: ${r.focus}\n${r.result}`)
      .join('\n\n');
    return merged;
  }
}

module.exports = { SubagentRunner, READ_ONLY_TOOLS };
