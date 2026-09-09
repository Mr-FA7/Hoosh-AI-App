/**
 * SQLite schema for Architecture v2 core entities (Phase 0.5).
 * Applied under ~/.aivon-os/hoosh-core.sqlite when node:sqlite is available.
 */
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  os TEXT,
  runtime_version TEXT,
  paired_at TEXT,
  last_seen_at TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'online'
);

CREATE TABLE IF NOT EXISTS runtime_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  label TEXT,
  client_name TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT,
  model_json TEXT,
  tool_allowlist_json TEXT,
  skill_ids_json TEXT,
  permission_preset TEXT,
  device_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  thread_id TEXT,
  room_id TEXT,
  device_id TEXT,
  status TEXT NOT NULL,
  goal TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  room_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee_agent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  tool_name TEXT NOT NULL,
  args_summary TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS permission_requests (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  call_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  run_id TEXT,
  device_id TEXT,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  agent_ids_json TEXT NOT NULL,
  objective TEXT,
  device_id TEXT
);

CREATE TABLE IF NOT EXISTS room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  from_agent_id TEXT,
  to_agent_id TEXT,
  body TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  last_used_at TEXT,
  revokeable INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_events_type_at ON events(type, at);
CREATE INDEX IF NOT EXISTS idx_tool_exec_run ON tool_executions(run_id);
`;

module.exports = { SCHEMA_SQL, SCHEMA_VERSION: 2 };
