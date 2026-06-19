#!/usr/bin/env node
/**
 * Hoosh headless CLI — run agent missions from terminal.
 * Usage: node scripts/hoosh-cli.js mission "your goal here"
 *        node scripts/hoosh-cli.js chat "question"
 *        node scripts/hoosh-cli.js plan "architecture goal"
 *        node scripts/hoosh-cli.js implement
 */
const axios = require('axios');

const BASE = process.env.HOOSH_API || 'http://127.0.0.1:3001';
const rawArgs = process.argv.slice(2);
const jsonMode = rawArgs.includes('--json') || rawArgs.includes('--ndjson');
const ndjsonMode = rawArgs.includes('--ndjson');
const ciMode = rawArgs.includes('--ci');
const args = rawArgs.filter((a) => !['--json', '--ndjson', '--ci'].includes(a));
const [cmd, ...rest] = args;
const text = rest.join(' ').trim();

if (!cmd || (cmd !== 'implement' && cmd !== 'checkpoints' && !text)) {
  console.log(`Hoosh CLI
  mission <goal>       Run autonomous mission (agent mode)
  plan <goal>          Plan-only mission (no writes until implement)
  implement            Execute pending plan from last plan command
  chat <message>       Single chat turn (ask mode)
  gather <goal>        Read-only context gather
  git-status           Git workspace status
  semantic <query>     Semantic code search
  hybrid <query>       Hybrid FTS+vector search
  lint                 Run project lint script
  checkpoints          List file checkpoints
  --json               Emit JSON where possible
  --ndjson             Emit NDJSON events for streaming commands
  --ci                 Exit 1 on lint/test/mission failure`);
  process.exit(cmd && cmd !== 'implement' && cmd !== 'checkpoints' ? 1 : 0);
}

async function streamChat(messages, mode = 'agent') {
  const res = await axios.post(`${BASE}/api/ai/chat`, {
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
          if (ndjsonMode) {
            process.stdout.write(JSON.stringify(j) + '\n');
          } else if (jsonMode) {
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
  const res = await axios.post(`${BASE}/api/v3/mission/implement`, {}, { responseType: 'stream' });
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
  try {
    if (cmd === 'mission') {
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
      const r = await axios.post(`${BASE}/api/v3/gather`, { goal: text });
      if (jsonMode || ndjsonMode) console.log(JSON.stringify(r.data));
      else console.log(r.data?.context || '');
    } else if (cmd === 'git-status') {
      const r = await axios.get(`${BASE}/api/v3/git/status`);
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'semantic') {
      const r = await axios.post(`${BASE}/api/ai/semantic-search`, { query: text });
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'hybrid') {
      const r = await axios.post(`${BASE}/api/ai/hybrid-search`, { query: text });
      console.log(JSON.stringify(r.data, null, 2));
    } else if (cmd === 'lint') {
      const r = await axios.post(`${BASE}/api/v3/lint/run`, { files: [] });
      console.log(JSON.stringify(r.data, null, 2));
      if (ciMode && (r.data?.failed || r.data?.lint?.ok === false)) exitCode = 1;
    } else if (cmd === 'checkpoints') {
      const r = await axios.get(`${BASE}/v3/checkpoints`);
      console.log(JSON.stringify(r.data, null, 2));
    } else {
      console.error('Unknown command:', cmd);
      process.exit(1);
    }
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
  process.exit(exitCode);
})();
