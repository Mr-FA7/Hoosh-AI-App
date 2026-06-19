/**
 * skillManager — discover / install / grant / activate Skills (S1 core).
 *
 * Discovers Skills from two roots:
 *   - built-in (first-party): <repo>/skills/<id>/skill.json
 *   - project:               <projectRoot>/.fa7/skills/<id>/(skill.json | SKILL.md)
 *
 * Install/grant state is per-user at ~/.aivon-os/skill-installs.json:
 *   { [skillId]: { version, granted, active, scope, installedAt } }
 *
 * Lifecycle: discover → install → grant(permissions) → activate → use → deactivate → uninstall.
 * Deny-by-default: nothing is granted until the user approves at grant time.
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { validateManifest, summarizePermissions } = require('./skillManifest');

const INSTALLS_PATH = path.join(os.homedir(), '.aivon-os', 'skill-installs.json');

class SkillManager {
  constructor({ builtinDir, projectRoot, installsPath } = {}) {
    this.builtinDir = builtinDir || path.join(__dirname, '..', 'skills');
    this.projectRoot = projectRoot || null;
    this.installsPath = installsPath || INSTALLS_PATH;
  }

  setProjectRoot(root) { this.projectRoot = root || null; }

  // ---- install state ----
  _loadInstalls() {
    try { return fs.readJsonSync(this.installsPath); } catch { return {}; }
  }
  _saveInstalls(state) {
    fs.ensureDirSync(path.dirname(this.installsPath));
    fs.writeJsonSync(this.installsPath, state, { spaces: 2 });
  }

  // ---- discovery ----
  async _readSkillDir(dir, source) {
    const out = [];
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const sdir = path.join(dir, e.name);
      const jsonPath = path.join(sdir, 'skill.json');
      if (await fs.pathExists(jsonPath)) {
        try {
          const raw = await fs.readJson(jsonPath);
          const { ok, errors, warnings, manifest } = validateManifest(raw);
          out.push({ source, dir: sdir, manifest, valid: ok, errors, warnings, promptOnly: false });
        } catch (err) {
          out.push({ source, dir: sdir, valid: false, errors: [`invalid skill.json: ${err.message}`] });
        }
        continue;
      }
      // back-compat: prompt-only SKILL.md (existing format)
      const md = (await fs.pathExists(path.join(sdir, 'SKILL.md'))) ? path.join(sdir, 'SKILL.md')
        : (await fs.pathExists(path.join(sdir, 'skill.md')) ? path.join(sdir, 'skill.md') : null);
      if (md) {
        out.push({
          source, dir: sdir, promptOnly: true, valid: true, errors: [],
          manifest: { id: e.name, name: e.name, version: '0.0.0', category: 'personal', permissions: { filesystem: 'none', shell: { allowlist: [] }, network: [], mcp: [], secrets: [] } }
        });
      }
    }
    return out;
  }

  /** All discoverable skills (built-in + project), annotated with install state. */
  async discover() {
    const builtin = await this._readSkillDir(this.builtinDir, 'builtin');
    const project = this.projectRoot ? await this._readSkillDir(path.join(this.projectRoot, '.fa7', 'skills'), 'project') : [];
    const installs = this._loadInstalls();
    const all = [...builtin, ...project].filter((s) => s.manifest?.id);
    return all.map((s) => {
      const inst = installs[s.manifest.id];
      return {
        id: s.manifest.id,
        name: s.manifest.name,
        version: s.manifest.version,
        category: s.manifest.category,
        summary: s.manifest.summary || '',
        source: s.source,
        promptOnly: !!s.promptOnly,
        valid: s.valid,
        errors: s.errors || [],
        permissions: s.manifest.permissions,
        permissionsSummary: summarizePermissions(s.manifest.permissions),
        elevated: !!s.manifest.elevated,
        installed: !!inst,
        active: !!inst?.active,
        granted: inst?.granted || null
      };
    });
  }

  async _findSkill(skillId) {
    const builtin = await this._readSkillDir(this.builtinDir, 'builtin');
    const project = this.projectRoot ? await this._readSkillDir(path.join(this.projectRoot, '.fa7', 'skills'), 'project') : [];
    return [...project, ...builtin].find((s) => s.manifest?.id === skillId) || null; // project overrides builtin
  }

  /** Inspect a skill (manifest + requested permissions) before install. */
  async inspect(skillId) {
    const s = await this._findSkill(skillId);
    if (!s) return { ok: false, error: 'Skill not found' };
    return { ok: true, manifest: s.manifest, permissionsSummary: summarizePermissions(s.manifest.permissions), source: s.source, promptOnly: !!s.promptOnly };
  }

  /** Record an install; permissions still need an explicit grant before activation. */
  async install(skillId) {
    const s = await this._findSkill(skillId);
    if (!s) return { ok: false, error: 'Skill not found' };
    if (!s.valid) return { ok: false, error: `Invalid manifest: ${(s.errors || []).join('; ')}` };
    const installs = this._loadInstalls();
    installs[skillId] = {
      version: s.manifest.version,
      granted: installs[skillId]?.granted || null,
      active: false,
      scope: s.manifest.memoryScope || 'project',
      installedAt: Date.now()
    };
    this._saveInstalls(installs);
    return { ok: true, requestedPermissions: s.manifest.permissions, permissionsSummary: summarizePermissions(s.manifest.permissions) };
  }

  /**
   * Grant a (possibly reduced) permission set the user approved. Granted
   * capabilities are clamped to what the manifest requested — a Skill can never
   * be granted more than it declared.
   */
  async grant(skillId, approved) {
    const s = await this._findSkill(skillId);
    if (!s) return { ok: false, error: 'Skill not found' };
    const installs = this._loadInstalls();
    if (!installs[skillId]) return { ok: false, error: 'Skill not installed' };
    const req = s.manifest.permissions;
    const a = approved || req; // default: grant exactly what was requested
    const clamp = {
      filesystem: a.filesystem && a.filesystem !== 'none' ? req.filesystem : 'none',
      shell: { allowlist: (a.shell?.allowlist || []).filter((c) => req.shell.allowlist.includes(c)) },
      network: (a.network || []).filter((h) => req.network.includes(h)),
      mcp: (a.mcp || []).filter((t) => req.mcp.includes(t)),
      secrets: (a.secrets || []).filter((x) => req.secrets.includes(x))
    };
    installs[skillId].granted = clamp;
    this._saveInstalls(installs);
    return { ok: true, granted: clamp, summary: summarizePermissions(clamp) };
  }

  async setActive(skillId, active) {
    const installs = this._loadInstalls();
    if (!installs[skillId]) return { ok: false, error: 'Skill not installed' };
    if (active && !installs[skillId].granted) return { ok: false, error: 'Grant permissions before activating' };
    installs[skillId].active = !!active;
    this._saveInstalls(installs);
    return { ok: true, active: !!active };
  }

  async uninstall(skillId) {
    const installs = this._loadInstalls();
    delete installs[skillId];
    this._saveInstalls(installs);
    return { ok: true };
  }

  /** Active skills' manifests + granted perms (for prompt injection / capability runtime). */
  async activeSkills() {
    const installs = this._loadInstalls();
    const activeIds = Object.keys(installs).filter((id) => installs[id].active);
    const result = [];
    for (const id of activeIds) {
      const s = await this._findSkill(id);
      if (s) result.push({ manifest: s.manifest, dir: s.dir, granted: installs[id].granted, promptOnly: !!s.promptOnly });
    }
    return result;
  }
}

module.exports = { SkillManager, INSTALLS_PATH };
