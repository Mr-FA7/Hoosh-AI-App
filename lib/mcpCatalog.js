/**
 * Suggested MCP servers (awesome-local-llm / OpenHands inspired).
 * Original catalog — not copied from any project.
 */
const MCP_CATALOG = [
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser automation for testing and scraping',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    tags: ['browser', 'testing']
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Issues, PRs, and repo operations',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    tags: ['git', 'ci']
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Scoped file read/write via MCP',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    tags: ['files']
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value memory for agents',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    tags: ['memory']
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'HTTP fetch for web content',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    tags: ['web']
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query local SQLite databases',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
    tags: ['database']
  }
];

function toMcpServerEntry(item, projectRoot = '.') {
  const args = (item.args || []).map((a) => (a === '.' ? projectRoot : a));
  return {
    command: item.command,
    args,
    env: item.env ? Object.fromEntries(item.env.map((k) => [k, ''])) : undefined
  };
}

function listCatalog() {
  return MCP_CATALOG.map(({ id, name, description, transport, tags, env }) => ({
    id, name, description, transport, tags, requiresEnv: env || []
  }));
}

function getCatalogItem(id) {
  return MCP_CATALOG.find((c) => c.id === id) || null;
}

function applyCatalogToConfig(config, catalogId, projectRoot) {
  const item = getCatalogItem(catalogId);
  if (!item) return null;
  const next = { ...(config || {}), mcpServers: { ...(config?.mcpServers || {}) } };
  next.mcpServers[item.id] = toMcpServerEntry(item, projectRoot);
  return next;
}

module.exports = { MCP_CATALOG, listCatalog, getCatalogItem, applyCatalogToConfig, toMcpServerEntry };
