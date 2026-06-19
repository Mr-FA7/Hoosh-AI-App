/**
 * Cron/webhook automation for agents (OpenHands-inspired).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { scheduleCron } = require('./simpleCron');

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

  _scheduleJob(job) {
    if (!job.enabled) return;
    if (job.type === 'interval' && job.intervalMs > 0) {
      const t = setInterval(() => this.fire(job), job.intervalMs);
      this.timers.set(job.id, t);
      return;
    }
    if (job.type === 'cron' && job.cron) {
      const cancel = scheduleCron(job.cron, () => this.fire(job));
      this.timers.set(job.id, cancel);
    }
  }

  startAll() {
    this.stopAll();
    for (const job of this.jobs) this._scheduleJob(job);
  }

  stopAll() {
    for (const t of this.timers.values()) {
      if (typeof t === 'function') t();
      else clearInterval(t);
    }
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
      enabled: job.enabled !== false,
      type: job.type || 'webhook',
      prompt: job.prompt || '',
      intervalMs: job.intervalMs || 0,
      cron: job.cron || '',
      webhookSecret: job.webhookSecret || randomUUID().slice(0, 16),
      createdAt: new Date().toISOString()
    };
    this.jobs.push(entry);
    this.save();
    this._scheduleJob(entry);
    return entry;
  }

  update(id, patch = {}) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch);
    this.save();
    if (this.timers.has(id)) {
      const t = this.timers.get(id);
      if (typeof t === 'function') t();
      else clearInterval(t);
      this.timers.delete(id);
    }
    this._scheduleJob(job);
    return job;
  }

  remove(id) {
    if (this.timers.has(id)) {
      const t = this.timers.get(id);
      if (typeof t === 'function') t();
      else clearInterval(t);
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
