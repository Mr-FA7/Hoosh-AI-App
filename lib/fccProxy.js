/**
 * FCC-style drop-in proxy (free-claude-code inspired).
 * Translates Anthropic /v1/messages and OpenAI /v1/chat/completions to local LlmGateway.
 */
function mountFccProxyRoutes(app, getLlmGateway) {
  async function generateText(messages, options = {}) {
    const gw = getLlmGateway?.();
    if (!gw?.generate) throw new Error('LLM gateway not configured');

    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const convo = messages.filter((m) => m.role !== 'system');
    const prompt = convo.map((m) => `${m.role}: ${m.content}`).join('\n\n');

    const text = await gw.generate({
      prompt,
      system: system || undefined,
      role: options.role || 'chat',
      options: { num_predict: options.max_tokens || 2048 }
    });
    return String(text || '');
  }

  app.post('/v1/messages', async (req, res) => {
    try {
      const body = req.body || {};
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const mapped = messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }));
      const text = await generateText(mapped, { max_tokens: body.max_tokens, role: 'chat' });
      res.json({
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text }],
        model: body.model || 'hoosh-local',
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 }
      });
    } catch (e) {
      res.status(502).json({ type: 'error', error: { type: 'api_error', message: e.message } });
    }
  });

  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const body = req.body || {};
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const text = await generateText(messages, { max_tokens: body.max_tokens, role: 'code' });
      res.json({
        id: `chatcmpl_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model || 'hoosh-local',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    } catch (e) {
      res.status(502).json({ error: { message: e.message, type: 'server_error' } });
    }
  });

  app.get('/v1/models', (req, res) => {
    res.json({
      object: 'list',
      data: [{ id: 'hoosh-local', object: 'model', owned_by: 'hoosh' }]
    });
  });

  app.get('/api/v3/fcc/status', (req, res) => {
    const gw = getLlmGateway?.();
    res.json({
      ok: true,
      enabled: !!gw,
      endpoints: ['/v1/messages', '/v1/chat/completions', '/v1/models']
    });
  });
}

module.exports = { mountFccProxyRoutes };
