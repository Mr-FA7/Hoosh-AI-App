/**
 * Summarize long chat histories to fit context window (Continue/Cline pattern).
 */
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 3.5);
}

function compactMessages(messages, options = {}) {
  const maxTokens = options.maxTokens || 12000;
  const keepRecent = options.keepRecent || 6;

  const total = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  if (total <= maxTokens) {
    return { messages, compacted: false, removed: 0 };
  }

  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  const recent = rest.slice(-keepRecent);
  const older = rest.slice(0, -keepRecent);

  if (older.length === 0) {
    return { messages, compacted: false, removed: 0 };
  }

  const summaryLines = older.map((m) => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    const body = String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    return `- ${role}: ${body}`;
  });

  const summaryBlock = {
    role: 'system',
    content: `## Compacted conversation summary (${older.length} earlier messages)\n${summaryLines.join('\n')}\n\n(Continue from recent messages below.)`
  };

  return {
    messages: [...system, summaryBlock, ...recent],
    compacted: true,
    removed: older.length
  };
}

async function compactWithLlm(messages, llmGenerate, options = {}) {
  const { messages: compacted, compacted: didLocal } = compactMessages(messages, options);
  if (!didLocal || !llmGenerate) return { messages: compacted, compacted: didLocal };

  const older = messages.filter((m) => m.role !== 'system').slice(0, -6);
  const transcript = older
    .map((m) => `${m.role}: ${String(m.content || '').slice(0, 800)}`)
    .join('\n');

  try {
    const summary = await llmGenerate({
      prompt: `Summarize this coding assistant conversation in 8-15 bullet points. Preserve: goals, files touched, decisions, errors.\n\n${transcript}`,
      role: 'chat',
      options: { num_predict: 600 }
    });
    const system = messages.find((m) => m.role === 'system');
    const recent = messages.filter((m) => m.role !== 'system').slice(-6);
    return {
      messages: [
        ...(system ? [system] : []),
        { role: 'system', content: `## LLM-compacted history\n${summary}` },
        ...recent
      ],
      compacted: true,
      removed: older.length
    };
  } catch {
    return { messages: compacted, compacted: true };
  }
}

module.exports = { compactMessages, compactWithLlm, estimateTokens };
