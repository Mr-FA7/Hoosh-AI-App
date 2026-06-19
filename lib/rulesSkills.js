const fs = require('fs-extra');
const path = require('path');

const RULES_DIR = 'rules';
const SKILLS_DIR = 'skills';

function fa7Dir(projectRoot) {
  return path.join(projectRoot, '.fa7');
}

async function listMarkdownFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (e.isFile() && /\.(md|mdc|txt)$/i.test(e.name)) {
        files.push(path.join(dir, e.name));
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

function parseRuleFrontmatter(raw) {
  const text = String(raw || '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { alwaysApply: undefined, globs: [], description: '', body: text.trim() };
  }
  const fm = match[1];
  const body = (match[2] || '').trim();
  let alwaysApply;
  let description = '';
  const globs = [];
  for (const line of fm.split('\n')) {
    const aa = line.match(/^alwaysApply:\s*(true|false)/i);
    if (aa) alwaysApply = aa[1].toLowerCase() === 'true';
    const desc = line.match(/^description:\s*(.+)$/i);
    if (desc) description = desc[1].trim().replace(/^["']|["']$/g, '');
    const g = line.match(/^globs:\s*\[(.*)\]$/i);
    if (g) {
      globs.push(...g[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
    }
    const g2 = line.match(/^globs?:\s*(.+)$/i);
    if (g2 && !g) {
      globs.push(g2[1].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return { alwaysApply, globs, description, body };
}

function globMatchesFile(globs, activeFile) {
  if (!globs?.length || !activeFile) return false;
  const f = String(activeFile).replace(/^\.\//, '');
  return globs.some((pattern) => {
    const p = String(pattern).replace(/^\.\//, '');
    if (p.includes('*')) {
      const re = new RegExp(`^${p.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`);
      return re.test(f);
    }
    return f === p || f.endsWith(`/${p}`) || f.includes(p);
  });
}

async function loadRules(projectRoot) {
  const dir = path.join(fa7Dir(projectRoot), RULES_DIR);
  const files = await listMarkdownFiles(dir);
  const rules = [];
  for (const f of files) {
    try {
      const raw = (await fs.readFile(f, 'utf8')).trim();
      if (!raw) continue;
      const meta = parseRuleFrontmatter(raw);
      rules.push({
        name: path.basename(f, path.extname(f)),
        path: path.relative(projectRoot, f),
        content: meta.body || raw,
        alwaysApply: meta.alwaysApply,
        globs: meta.globs || [],
        description: meta.description || ''
      });
    } catch {
      /* skip */
    }
  }
  return rules;
}

function selectRulesForContext(rules, { activeFile = '', query = '' } = {}) {
  const q = String(query || '').toLowerCase();
  const file = String(activeFile || '').replace(/^\.\//, '');
  const selected = [];
  for (const r of rules) {
    const always = r.alwaysApply === true || (r.alwaysApply === undefined && !r.globs?.length && !r.description);
    if (always) {
      selected.push(r);
      continue;
    }
    if (file && r.globs?.length && globMatchesFile(r.globs, file)) {
      selected.push(r);
      continue;
    }
    if (r.description && q && r.description.toLowerCase().split(/\s+/).some((w) => w.length > 3 && q.includes(w))) {
      selected.push(r);
    }
  }
  const seen = new Set();
  return selected.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

async function loadSkills(projectRoot) {
  const base = path.join(fa7Dir(projectRoot), SKILLS_DIR);
  const skills = [];
  let entries = [];
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillDir = path.join(base, e.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const altFile = path.join(skillDir, 'skill.md');
    let target = null;
    if (await fs.pathExists(skillFile)) target = skillFile;
    else if (await fs.pathExists(altFile)) target = altFile;
    if (!target) continue;

    try {
      const raw = await fs.readFile(target, 'utf8');
      const { description, keywords, body } = parseSkillFrontmatter(raw);
      skills.push({
        id: e.name,
        name: e.name,
        description,
        keywords: keywords || [],
        path: path.relative(projectRoot, target),
        content: body.trim()
      });
    } catch {
      /* skip */
    }
  }
  return skills;
}

function parseSkillFrontmatter(raw) {
  const text = String(raw || '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { description: '', keywords: [], body: text };
  }
  const fm = match[1];
  const body = match[2] || '';
  let description = '';
  const keywords = [];
  for (const line of fm.split('\n')) {
    const d = line.match(/^description:\s*(.+)$/i);
    if (d) description = d[1].trim().replace(/^["']|["']$/g, '');
    const k = line.match(/^keywords:\s*\[(.*)\]$/i);
    if (k) {
      keywords.push(
        ...k[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      );
    }
    const k2 = line.match(/^triggers?:\s*(.+)$/i);
    if (k2) {
      keywords.push(...k2[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
    }
  }
  return { description, keywords, body };
}

function matchSkillsForQuery(skills, query) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  return skills.filter((s) => {
    if (s.id.toLowerCase().includes(q)) return true;
    if (s.description && s.description.toLowerCase().includes(q)) return true;
    return (s.keywords || []).some((kw) => q.includes(String(kw).toLowerCase()));
  });
}

function buildRulesPrompt(rules) {
  if (!rules.length) return '';
  return `## Project Rules (MUST follow):\n${rules.map((r, i) => {
    const meta = [];
    if (r.alwaysApply) meta.push('always');
    if (r.globs?.length) meta.push(`globs: ${r.globs.join(', ')}`);
    const head = meta.length ? ` [${meta.join(' · ')}]` : '';
    return `${i + 1}. [${r.name}]${head}\n${r.content}`;
  }).join('\n\n')}`;
}

function buildSkillsPrompt(skills) {
  if (!skills.length) return '';
  return `## Active Skills:\n${skills.map((s) => `### ${s.name}\n${s.description ? s.description + '\n' : ''}${s.content}`).join('\n\n')}`;
}

async function ensureDefaults(projectRoot) {
  const rulesDir = path.join(fa7Dir(projectRoot), RULES_DIR);
  const skillsDir = path.join(fa7Dir(projectRoot), SKILLS_DIR);
  await fs.ensureDir(rulesDir);
  await fs.ensureDir(skillsDir);
  const exampleRule = path.join(rulesDir, 'example.md');
  if (!(await fs.pathExists(exampleRule))) {
    await fs.writeFile(
      exampleRule,
      `---\nalwaysApply: true\ndescription: Default project behavior\n---\n\n- Always reply in the user's language.\n- Prefer minimal, focused diffs.\n- Run tests after code changes when a test script exists.\n`
    );
  }
  const mcpExample = path.join(fa7Dir(projectRoot), 'mcp.json.example');
  if (!(await fs.pathExists(mcpExample))) {
    await fs.writeFile(
      mcpExample,
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', projectRoot],
            disabled: true
          }
        }
      }, null, 2)
    );
  }
}

module.exports = {
  loadRules,
  selectRulesForContext,
  loadSkills,
  matchSkillsForQuery,
  buildRulesPrompt,
  buildSkillsPrompt,
  ensureDefaults,
  parseRuleFrontmatter,
  globMatchesFile
};
