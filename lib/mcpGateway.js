/**
 * VS Code-style MCP gateway — unified tools/resources/prompts surface.
 */
class McpGateway {
  constructor(mcpManager) {
    this.mcp = mcpManager;
  }

  status() {
    return { ...this.mcp.getStatus(), gateway: 'hoosh-mcp-gateway-v1' };
  }

  listTools() {
    return this.mcp.listTools().map((t) => ({
      ...t,
      gatewayId: t.id,
      invoke: { method: 'POST', path: '/api/v3/mcp/gateway/invoke', body: { toolId: t.id } }
    }));
  }

  listResources() {
    return this.mcp.listResources();
  }

  readResource(uri) {
    return this.mcp.readResource(uri);
  }

  listPrompts() {
    return this.mcp.listPrompts();
  }

  getPrompt(name, args) {
    return this.mcp.getPrompt(name, args);
  }

  invoke(toolId, args = {}) {
    return this.mcp.callTool(toolId, args);
  }

  async catalog() {
    const [tools, resources, prompts] = await Promise.all([
      Promise.resolve(this.listTools()),
      this.listResources().catch(() => []),
      this.listPrompts().catch(() => [])
    ]);
    return { tools, resources, prompts, status: this.status() };
  }
}

module.exports = { McpGateway };
