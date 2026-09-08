/**
 * Native function-calling schemas for the agent's tools.
 *
 * The agent originally asked models to emit `TOOL: {json}` inside free text,
 * which the kernel then brace-parsed. That is the single biggest source of
 * agent failures: models answer with a markdown code block instead, or embed
 * raw newlines in the JSON string so it won't parse, and the tool call is
 * silently lost. Real coding agents use structured tool calling instead.
 *
 * Ollama (/api/chat) and OpenAI-compatible servers (/chat/completions) accept
 * the same `tools: [{type:'function', function:{name, description, parameters}}]`
 * shape, so one definition serves both.
 */

const str = (description) => ({ type: 'string', description });

/** Tools every coding agent needs. Names match kernel.executeTool. */
const AGENT_TOOL_SCHEMAS = [
  {
    name: 'readFile',
    description: 'Read a file from the project. Use after glob/grep to inspect a specific file.',
    parameters: {
      type: 'object',
      properties: { path: str('Path relative to the project root.') },
      required: ['path']
    }
  },
  {
    name: 'writeFile',
    description: 'Create a file or overwrite it completely with new content.',
    parameters: {
      type: 'object',
      properties: {
        path: str('Path relative to the project root.'),
        content: str('The complete file contents.')
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'patchFile',
    description: 'Edit part of an existing file by replacing an exact snippet. Prefer this over writeFile for small changes.',
    parameters: {
      type: 'object',
      properties: {
        path: str('Path relative to the project root.'),
        search: str('Exact text to find, including indentation.'),
        replace: str('Text to replace it with.'),
        replace_all: { type: 'boolean', description: 'Replace every occurrence instead of the first.' }
      },
      required: ['path', 'search', 'replace']
    }
  },
  {
    name: 'glob',
    description: 'Find files by path pattern, e.g. "src/**/*.tsx". Use this instead of guessing a path.',
    parameters: {
      type: 'object',
      properties: { pattern: str('Glob pattern; ** spans directories.') },
      required: ['pattern']
    }
  },
  {
    name: 'grep',
    description: 'Search file CONTENTS by regular expression. Returns "path:line: text".',
    parameters: {
      type: 'object',
      properties: {
        pattern: str('Regular expression to search for.'),
        glob: str('Optional glob limiting which files are searched.'),
        maxResults: { type: 'number', description: 'Maximum matches to return.' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'createDir',
    description: 'Create a directory inside the project.',
    parameters: {
      type: 'object',
      properties: { path: str('Directory path relative to the project root.') },
      required: ['path']
    }
  },
  {
    name: 'deleteFile',
    description: 'Delete a file from the project.',
    parameters: {
      type: 'object',
      properties: { path: str('Path relative to the project root.') },
      required: ['path']
    }
  },
  {
    name: 'executeCommand',
    description: 'Run a shell command in the project directory (build, test, install). Dangerous commands still require user approval.',
    parameters: {
      type: 'object',
      properties: { command: str('The shell command to run.') },
      required: ['command']
    }
  },
  {
    name: 'webSearch',
    description: 'Quick web search returning short snippets.',
    parameters: {
      type: 'object',
      properties: { query: str('Search query.') },
      required: ['query']
    }
  },
  {
    name: 'deepResearch',
    description: 'Fetch and read multiple web pages, returning cited excerpts. Prefer this for library/API/version questions.',
    parameters: {
      type: 'object',
      properties: {
        query: str('Research question.'),
        maxPages: { type: 'number', description: 'How many pages to read.' }
      },
      required: ['query']
    }
  },
  {
    name: 'remember',
    description: 'Persist a durable project fact, decision or convention for future tasks.',
    parameters: {
      type: 'object',
      properties: {
        text: str('The fact to remember.'),
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' }
      },
      required: ['text']
    }
  },
  {
    name: 'recall',
    description: 'Retrieve previously remembered project facts.',
    parameters: {
      type: 'object',
      properties: { query: str('What to recall.') },
      required: ['query']
    }
  }
];

/** Wrap the schemas in the `tools` envelope both Ollama and OpenAI expect. */
function buildToolsPayload(names) {
  const allow = Array.isArray(names) && names.length ? new Set(names) : null;
  return AGENT_TOOL_SCHEMAS
    .filter((t) => !allow || allow.has(t.name))
    .map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
}

/**
 * Normalise a provider tool_call into the kernel's { name, args } shape.
 * Ollama returns arguments as an object; OpenAI returns a JSON string.
 */
function normalizeToolCall(raw) {
  const fn = raw?.function || raw;
  const name = String(fn?.name || '').trim();
  if (!name) return null;
  let args = fn?.arguments ?? fn?.args ?? {};
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { return null; }
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) args = {};
  return { name, args };
}

module.exports = { AGENT_TOOL_SCHEMAS, buildToolsPayload, normalizeToolCall };
