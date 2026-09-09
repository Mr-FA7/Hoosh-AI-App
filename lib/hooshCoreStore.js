/**
 * Local SQLite store for Architecture v2 core tables.
 * Optional: if node:sqlite is missing, open() returns null and callers no-op.
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { SCHEMA_SQL, SCHEMA_VERSION } = require('./coreSchema');

let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
  DatabaseSync = null;
}

function defaultDbPath() {
  return path.join(os.homedir(), '.aivon-os', 'hoosh-core.sqlite');
}

class HooshCoreStore {
  constructor(dbPath = defaultDbPath()) {
    this.dbPath = dbPath;
    this.db = null;
  }

  available() {
    return !!DatabaseSync;
  }

  open() {
    if (!DatabaseSync) return null;
    if (this.db) return this.db;
    fs.ensureDirSync(path.dirname(this.dbPath));
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(SCHEMA_SQL);
    try {
      this.db.exec(`ALTER TABLE devices ADD COLUMN status TEXT NOT NULL DEFAULT 'online'`);
    } catch { /* column exists */ }
    this.db.prepare(
      'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('schema_version', String(SCHEMA_VERSION));
    return this.db;
  }

  insertEvent(evt) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT OR REPLACE INTO events(id, type, at, run_id, device_id, payload_json)
       VALUES(?, ?, ?, ?, ?, ?)`
    ).run(
      evt.id,
      evt.type,
      evt.at,
      evt.runId || null,
      evt.deviceId || null,
      JSON.stringify(evt.payload || {})
    );
    return true;
  }

  upsertDevice(device) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO devices(id, name, os, runtime_version, paired_at, last_seen_at, capabilities_json, status)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         os = excluded.os,
         runtime_version = excluded.runtime_version,
         last_seen_at = excluded.last_seen_at,
         capabilities_json = excluded.capabilities_json,
         status = excluded.status`
    ).run(
      device.id,
      device.name || 'Hoosh Device',
      device.os || null,
      device.runtimeVersion || null,
      device.pairedAt || null,
      device.lastSeenAt || new Date().toISOString(),
      JSON.stringify(device.capabilities || {}),
      device.status || 'online'
    );
    return true;
  }

  listDevices() {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM devices ORDER BY last_seen_at DESC').all();
    } catch {
      return [];
    }
  }

  upsertRuntimeSession(session) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO runtime_sessions(id, device_id, label, client_name, created_at, expires_at, revoked_at, last_seen_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         revoked_at = excluded.revoked_at,
         last_seen_at = excluded.last_seen_at,
         expires_at = excluded.expires_at`
    ).run(
      session.id,
      session.deviceId,
      session.label || null,
      session.clientName || null,
      session.createdAt,
      session.expiresAt,
      session.revokedAt || null,
      session.lastSeenAt || null
    );
    return true;
  }

  upsertAgentRun(run) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO agent_runs(id, agent_id, thread_id, room_id, device_id, status, goal, created_at, updated_at, ended_at, error)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         updated_at = excluded.updated_at,
         ended_at = excluded.ended_at,
         error = excluded.error`
    ).run(
      run.id,
      run.agentId || null,
      run.threadId || null,
      run.roomId || null,
      run.deviceId || null,
      run.status,
      run.goal || null,
      run.createdAt,
      run.updatedAt,
      run.endedAt || null,
      run.error || null
    );
    return true;
  }

  listAgentRuns(limit = 30) {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM agent_runs ORDER BY updated_at DESC LIMIT ?').all(limit);
    } catch {
      return [];
    }
  }

  upsertTask(task) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO tasks(id, run_id, room_id, title, status, assignee_agent_id, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         status = excluded.status,
         assignee_agent_id = excluded.assignee_agent_id,
         updated_at = excluded.updated_at`
    ).run(
      task.id,
      task.runId || null,
      task.roomId || null,
      task.title,
      task.status,
      task.assigneeAgentId || null,
      task.createdAt,
      task.updatedAt
    );
    return true;
  }

  listTasks(limit = 50) {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC LIMIT ?').all(limit);
    } catch {
      return [];
    }
  }

  upsertRoom(room) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO rooms(id, name, mode, agent_ids_json, objective, device_id)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         mode = excluded.mode,
         agent_ids_json = excluded.agent_ids_json,
         objective = excluded.objective`
    ).run(
      room.id,
      room.name,
      room.mode,
      JSON.stringify(room.agentIds || []),
      room.objective || null,
      room.deviceId || null
    );
    return true;
  }

  listRooms() {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM rooms ORDER BY name').all();
    } catch {
      return [];
    }
  }

  insertRoomMessage(msg) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO room_messages(id, room_id, kind, from_agent_id, to_agent_id, body, at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`
    ).run(
      msg.id,
      msg.roomId,
      msg.kind,
      msg.fromAgentId || null,
      msg.toAgentId || null,
      msg.body,
      msg.at
    );
    return true;
  }

  listRoomMessages(roomId, limit = 100) {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare(
        'SELECT * FROM room_messages WHERE room_id = ? ORDER BY at DESC LIMIT ?'
      ).all(roomId, limit);
    } catch {
      return [];
    }
  }

  upsertArtifact(art) {
    const db = this.open();
    if (!db) return false;
    db.prepare(
      `INSERT INTO artifacts(id, kind, title, path, run_id, created_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, path = excluded.path`
    ).run(art.id, art.kind, art.title, art.path || null, art.runId || null, art.createdAt);
    return true;
  }

  listArtifacts(limit = 50) {
    const db = this.open();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM artifacts ORDER BY created_at DESC LIMIT ?').all(limit);
    } catch {
      return [];
    }
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
  }
}

module.exports = { HooshCoreStore, defaultDbPath };
