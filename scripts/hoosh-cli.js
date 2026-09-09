#!/usr/bin/env node
/**
 * Hoosh CLI — talk to Hoosh Local Runtime (companion).
 * Usage: node scripts/hoosh-cli.js doctor
 *        node scripts/hoosh-cli.js status
 *        node scripts/hoosh-cli.js mission "your goal here"
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const BASE = process.env.HOOSH_API || 'http://127.0.0.1:3001';
const AUTH_PATH = path.join(os.homedir(), '.aivon-os', 'runtime-auth.json');
const rawArgs = process.argv.slice(2);
const jsonMode = rawArgs.includes('--json') || rawArgs.includes('--ndjson');
const ndjsonMode = rawArgs.includes('--ndjson');
const ciMode = rawArgs.includes('--ci');
const args = rawArgs.filter((a) => !['--json', '--ndjson', '--ci'].includes(a));
const [cmd, ...rest] = args;
const text = rest.join(' ').trim();

const NO_TEXT_CMDS = new Set([
  'implement', 'checkpoints', 'doctor', 'status', 'login', 'health', 'help',
  'connect', 'disconnect', 'pair'
]);

function loadDeviceToken() {
  if (process.env.HOOSH_DEVICE_TOKEN) return String(process.env.HOOSH_DEVICE_TOKEN).trim();
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
    return data?.sessionToken || data?.deviceToken || null;
  } catch {
    return null;
  }
}

function api() {
  const token = loadDeviceToken();
  const headers = token ? { 'X-Hoosh-Device-Token': token } : {};
  return axios.create({ baseURL: BASE, headers, timeout: 15000 });
}

function printHelp() {
  console.log(`Hoosh CLI (talks to Local Runtime at ${BASE})

Runtime
  doctor               Run Hoosh Runtime diagnostics
  status               Runtime health + device id
  login                Print / cache bootstrap token (loopback)
  connect [code]       Start pairing or confirm a 6-digit code
  disconnect           Revoke all sessions and rotate device token
  pair                 Alias for connect (start)
  health               Alias for status

Agent
  mission <goal>       Run autonomous mission (agent mode)
  plan <goal>          Plan-only mission (no writes until implement)
  implement            Execute pending plan from last plan command
  chat <message>       Single chat turn (ask mode)
  gather <goal>        Read-only context gather

Workspace
  git-status           Git workspace status
  semantic <query>     Semantic code search
  hybrid <query>       Hybrid FTS+vector search
  lint                 Run project lint script
  checkpoints          List file checkpoints

Flags
  --json / --ndjson    Machine-readable output
  --ci                 Exit 1 on failure

Env
  HOOSH_API            Runtime base (default http://127.0.0.1:3001)
  HOOSH_DEVICE_TOKEN   Optional override for X-Hoosh-Device-Token`);
}

if (!cmd || cmd === 'help' || (!NO_TEXT_CMDS.has(cmd) && !text && cmd !== 'implement' && cmd !== 'checkpoints')) {
  printHelp();
  process.exit(cmd && cmd !== 'help' && !NO_TEXT_CMDS.has(cmd) ? 1 : 0);
}

async function streamChat(messages, mode = 'agent') {
  const client = api();
  const res = await client.post('/api/ai/chat', {
    messages,
    stream: true,
    mode,
    model: 'mistral',
    allowedModels: ['mistral']
  }, { responseType: 'stream' });

  let sawError = false;
  return new Promise((resolve, reject) => {
    let buf = '';
    res.data.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.error || j.agent_event?.type === 'error') sawError = true;
          if (ndjsonMode || jsonMode) {
            process.stdout.write(JSON.stringify(j) + '\n');
          } else {
            const c = j.message?.content || '';
            if (c) process.stdout.write(c);
            if (j.agent_event) {
              const ev = j.agent_event;
              if (ev.type === 'status' && ev.message) {
                process.stderr.write(`\n[${ev.type}] ${ev.message}\n`);
              }
              if (ev.type === 'token' && ev.token) process.stdout.write(ev.token);
              if (ev.type === 'paused' && ev.planOnly) {
                process.stderr.write('\n[plan ready — run: hoosh-cli implement]\n');
              }
            }
          }
        } catch { /* skip */ }
      }
    });
    res.data.on('end', () => resolve(sawError));
    res.data.on('error', reject);
  });
}

async function streamImplement() {
  const client = api();
  const res = await client.post('/api/v3/mission/implement', {}, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    let buf = '';
    res.data.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (ndjsonMode || jsonMode) {
            process.stdout.write(JSON.stringify(j) + '\n');
          } else if (j.agent_event?.type === 'token' && j.agent_event.token) {
            process.stdout.write(j.agent_event.token);
          } else if (j.agent_event?.message) {
            process.stderr.write(`\n[${j.agent_event.type}] ${j.agent_event.message}\n`);
          }
        } catch { /* skip */ }
      }
    });
    res.data.on('end', () => resolve());
    res.data.on('error', reject);
  });
}

(async () => {
  let exitCode = 0;
  const client = api();
  try {
    if (cmd === 'doctor') {
      const r = await client.get('/api/v3/runtime/doctor');
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
      else {
        console.log(r.data?.ok ? 'Hoosh Runtime: OK' : 'Hoosh Runtime: issues found');
        for (const c of r.data?.checks || []) {
          console.log(`  ${c.ok ? '✓' : '✗'} ${c.id}: ${c.detail}`);
        }
      }
      if (ciMode && !r.data?.ok) exitCode = 1;
    } else if (cmd === 'status' || cmd === 'health') {
      const r = await client.get('/api/v3/runtime/health');
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
      else {
        console.log(`runtime=${r.data?.version || '?'} device=${r.data?.deviceId || '?'}`);
        console.log(`bind=${r.data?.bindHost || '?'} auth=${r.data?.authRequired ? 'on' : 'off'}`);
      }
    } else if (cmd === 'login') {
      const r = await client.get('/api/v3/runtime/bootstrap');
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
      else {
        console.log('Device ID:', r.data?.deviceId);
        console.log('Token cached at', AUTH_PATH);
        console.log('(Token already written by Runtime on first boot; send via HOOSH_DEVICE_TOKEN if needed)');
        if (r.data?.deviceToken) {
          console.log('Token: ' + String(r.data.deviceToken).slice(0, 12) + '…');
        }
      }
    } else if (cmd === 'connect' || cmd === 'pair') {
      if (text && /^\d{6}$/.test(text)) {
        const r = await client.post('/api/v3/runtime/pair/confirm', {
          code: text,
          clientName: 'cli',
          label: 'Hoosh CLI'
        });
        if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
        else {
          console.log('Paired device:', r.data?.deviceId);
          console.log('Session:', r.data?.sessionId);
          if (r.data?.sessionToken) {
            try {
              const auth = fs.existsSync(AUTH_PATH) ? JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')) : {};
              auth.sessionToken = r.data.sessionToken;
              auth.sessionId = r.data.sessionId;
              fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
            } catch { /* ignore */ }
            console.log('Session token stored alongside', AUTH_PATH);
          }
        }
      } else {
        const r = await client.post('/api/v3/runtime/pair/start', {});
        if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
        else {
          console.log('Pairing code:', r.data?.code);
          console.log('Expires in:', r.data?.expiresInSec, 'sec');
          console.log('Confirm from web or: hoosh-cli connect', r.data?.code);
        }
      }
    } else if (cmd === 'disconnect') {
      const r = await client.post('/api/v3/runtime/revoke', { rotate: true });
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data, null, 2));
      else console.log('Disconnected — sessions revoked' + (r.data?.deviceToken ? ', token rotated' : ''));
    } else if (cmd === 'mission') {
      const hadError = await streamChat([{ role: 'user', content: text }], 'agent');
      if (!ndjsonMode) console.log('\n');
      if (ciMode && hadError) exitCode = 1;
    } else if (cmd === 'plan') {
      const hadError = await streamChat([{ role: 'user', content: text }], 'plan');
      if (!ndjsonMode) console.log('\n');
      if (ciMode && hadError) exitCode = 1;
    } else if (cmd === 'implement') {
      await streamImplement();
      if (!ndjsonMode) console.log('\n');
    } else if (cmd === 'chat') {
      await streamChat([{ role: 'user', content: text }], 'ask');
      if (!ndjsonMode) console.log('\n');
    } else if (cmd === 'gather') {
      const r = await client.post('/api/v3/gather', { goal: text });
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data));
      else console.log(r.data?.context || '');
    } else if (cmd === 'git-status') {
      const r = await client.get('/api/v3/git/status');
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'semantic') {
      const r = await client.post('/api/ai/semantic-search', { query: text });
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'hybrid') {
      const r = await client.post('/api/ai/hybrid-search', { query: text });
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'lint') {
      const r = await client.post('/api/v3/lint/run', { files: [] });
      console.log(JSON.stringify(r.data, null, 2));
      if (ciMode && (r.data?.failed || r.data?.lint?.ok === false)) exitCode = 1;
    } else if (cmd === 'checkpoints') {
      const r = await client.get('/api/v3/checkpoints').catch(() => client.get('/v3/checkpoints'));
      console.log(JSON.stringify(r.data, null, 2));
    } else {
      console.error('Unknown command:', cmd);
      printHelp();
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
  process.exit(exitCode);
})();
