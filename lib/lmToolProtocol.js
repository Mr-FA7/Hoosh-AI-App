/**
 * Language Model Tool protocol (VS Code / Continue-inspired).
 * Unifies kernel tools + MCP into model-facing schemas.
 */
const { PLATFORM_KERNEL_TOOLS } = require('./platformAgentTools');
const { MEDIA_KERNEL_TOOLS } = require('./mediaAgentTools');

const KERNEL_TOOLS = [
  {
    name: 'readFile',
    description: 'Read a project-relative file',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'writeFile',
    description: 'Write full file content',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
  },
  {
    name: 'patchFile',
    description: 'Patch file via search/replace or instruction',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        search: { type: 'string' },
        replace: { type: 'string' },
        instruction: { type: 'string' }
      },
      required: ['path']
    }
  },
  {
    name: 'executeCommand',
    description: 'Run shell command in project root',
    inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }
  },
  ...PLATFORM_KERNEL_TOOLS,
  ...MEDIA_KERNEL_TOOLS,
  {
    name: 'webSearch',
    description: 'Search the web for information',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'browserAgent',
    description: 'Autonomous browser task via Playwright (Kavosh policy)',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        url: { type: 'string' },
        maxSteps: { type: 'number' }
      },
      required: ['goal']
    }
  },
  {
    name: 'mcpTool',
    description: 'Invoke an MCP tool by gateway id (server:tool)',
    inputSchema: {
      type: 'object',
      properties: {
        toolId: { type: 'string' },
        arguments: { type: 'object' }
      },
      required: ['toolId']
    }
  }
];

function toOpenAIFunctions(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} }
    },
    _hooshId: t.name
  }));
}

function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64),
    description: t.description || '',
    input_schema: t.inputSchema || { type: 'object', properties: {} },
    _hooshId: t.name
  }));
}

function collectTools(mcpManager) {
  const tools = [...KERNEL_TOOLS];
  if (mcpManager?.listTools) {
    for (const t of mcpManager.listTools()) {
      tools.push({
        name: `mcp_${t.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        description: `[MCP ${t.server}] ${t.description || t.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
        mcpToolId: t.id
      });
    }
  }
  return tools;
}

async function invokeTool(name, args, ctx = {}) {
  const raw = String(name || '');
  if (raw.startsWith('mcp_') && ctx.mcpManager) {
    const mcpEntry = collectTools(ctx.mcpManager).find((t) => t.name === raw);
    const toolId = mcpEntry?.mcpToolId || raw.replace(/^mcp_/, '').replace(/_/g, ':');
    return ctx.kernel.executeTool('mcpTool', { toolId, arguments: args }, ctx.emit);
  }
  const kernelName = raw.replace(/_/g, '');
  const aliases = {
    readfile: 'readFile',
    writefile: 'writeFile',
    patchfile: 'patchFile',
    executecommand: 'executeCommand',
    websearch: 'webSearch',
    browseragent: 'browserAgent',
    mcptool: 'mcpTool'
  };
  const tool = aliases[kernelName.toLowerCase()] || raw;
  if (!ctx.kernel?.executeTool) return { ok: false, error: 'Kernel not available' };
  const text = await ctx.kernel.executeTool(tool, args, ctx.emit);
  return { ok: !/error|denied|blocked/i.test(String(text)), result: text };
}

module.exports = {
  KERNEL_TOOLS,
  collectTools,
  toOpenAIFunctions,
  toAnthropicTools,
  invokeTool
};
