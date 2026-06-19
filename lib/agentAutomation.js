/**
 * Cron/webhook automation for agents (OpenHands-inspired).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const CONFIG_PATH = path.join(os.homedir(), '.aivon-os', 'agent-automation.json');

class AgentAutomation {
  constructor() {
    this.jobs = [];
    this.timers = new Map();
    this.onTrigger = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        this.jobs = fs.readJsonSync(CONFIG_PATH).jobs || [];
      }
    } catch {
      this.jobs = [];
    }
    return this.jobs;
  }

  save() {
    fs.ensureDirSync(path.dirname(CONFIG_PATH));
    fs.writeJsonSync(CONFIG_PATH, { jobs: this.jobs }, { spaces: 2 });
    return this.jobs;
  }

  setTriggerHandler(fn) {
    this.onTrigger = fn;
  }

  startAll() {
    this.stopAll();
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      if (job.type === 'interval' && job.intervalMs > 0) {
        const t = setInterval(() => this.fire(job), job.intervalMs);
        this.timers.set(job.id, t);
      }
    }
  }

  stopAll() {
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
  }

  async fire(job) {
    if (this.onTrigger) {
      await this.onTrigger(job);
    }
    job.lastRun = new Date().toISOString();
    this.save();
  }

  list() {
    return this.jobs;
  }

  add(job) {
    const entry = {
      id: randomUUID(),
      enabled: true,
      type: job.type || 'webhook',
      prompt: job.prompt || '',
      intervalMs: job.intervalMs || 0,
      webhookSecret: job.webhookSecret || randomUUID().slice(0, 16),
      createdAt: new Date().toISOString()
    };
    this.jobs.push(entry);
    this.save();
    if (entry.type === 'interval' && entry.enabled) {
      const t = setInterval(() => this.fire(entry), entry.intervalMs);
      this.timers.set(entry.id, t);
    }
    return entry;
  }

  remove(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.save();
  }

  findByWebhookSecret(secret) {
    return this.jobs.find((j) => j.type === 'webhook' && j.webhookSecret === secret && j.enabled);
  }
}

module.exports = { AgentAutomation, CONFIG_PATH };
