/**
 * Parallel agent chat sessions (VS Code-inspired).
 */
const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('crypto');

class AgentSessions {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.dir = projectRoot ? path.join(projectRoot, '.fa7', 'agent-sessions') : null;
    /** @type {Map<string, any>} */
    this.active = new Map();
  }

  setProjectRoot(root) {
    this.projectRoot = root;
    this.dir = root ? path.join(root, '.fa7', 'agent-sessions') : null;
  }

  async list() {
    if (!this.dir || !(await fs.pathExists(this.dir))) return [];
    const files = await fs.readdir(this.dir);
    const sessions = [];
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      try {
        const s = await fs.readJson(path.join(this.dir, f));
        sessions.push(s);
      } catch { /* skip */ }
    }
    return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async get(id) {
    if (this.active.has(id)) return this.active.get(id);
    if (!this.dir) return null;
    const p = path.join(this.dir, `${id}.json`);
    if (!(await fs.pathExists(p))) return null;
    const s = await fs.readJson(p);
    this.active.set(id, s);
    return s;
  }

  async create(title = 'New session') {
    const id = randomUUID();
    const session = {
      id,
      title: String(title).slice(0, 120),
      messages: [],
      mode: 'agent',
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.save(session);
    this.active.set(id, session);
    return session;
  }

  async save(session) {
    if (!this.dir) return session;
    await fs.ensureDir(this.dir);
    session.updatedAt = new Date().toISOString();
    await fs.writeJson(path.join(this.dir, `${session.id}.json`), session, { spaces: 2 });
    this.active.set(session.id, session);
    return session;
  }

  async appendMessage(id, message) {
    const s = await this.get(id);
    if (!s) throw new Error('Session not found');
    s.messages.push(message);
    return this.save(s);
  }

  async setStatus(id, status) {
    const s = await this.get(id);
    if (!s) return null;
    s.status = status;
    return this.save(s);
  }

  async remove(id) {
    this.active.delete(id);
    if (!this.dir) return;
    const p = path.join(this.dir, `${id}.json`);
    if (await fs.pathExists(p)) await fs.remove(p);
  }
}

module.exports = { AgentSessions };
