const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

/** Canonical Gira working tree (same as CLI `main.py` from this folder). Do not rename — path is fixed for this install. */
const BDTM_PROJECT_ROOT = '/Users/mr.fa7/Desktop/BDTM/Project';

function nowIso() {
  return new Date().toISOString();
}

function detectPythonBin(projectRoot) {
  const candidates = process.platform === 'win32'
    ? [
        path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
        'python',
        'py'
      ]
    : [
        path.join(projectRoot, '.venv', 'bin', 'python3'),
        path.join(projectRoot, '.venv', 'bin', 'python'),
        'python3',
        'python'
      ];
  return candidates;
}

async function pickFirstWorkingPython(projectRoot) {
  const bins = detectPythonBin(projectRoot);
  for (const bin of bins) {
    const ok = await new Promise((resolve) => {
      const child = spawn(bin, ['--version'], { cwd: projectRoot, stdio: 'ignore' });
      child.once('error', () => resolve(false));
      child.once('exit', (code) => resolve(code === 0));
    });
    if (ok) return bin;
  }
  return null;
}

/** magnet:?… or http(s) .torrent link */
function classifyDownloadInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return { kind: 'invalid', message: 'Empty URL.' };
  if (/^magnet:\?/i.test(s)) return { kind: 'torrent', value: s };
  if (/^https?:\/\//i.test(s)) {
    if (/\.torrent(\?|#|$)/i.test(s)) return { kind: 'torrent', value: s };
    return { kind: 'http', value: s };
  }
  return { kind: 'invalid', message: 'Use http(s) URL, .torrent link, or a magnet link.' };
}

function aria2cAvailable() {
  return new Promise((resolve) => {
    const c = spawn('aria2c', ['--version'], { stdio: 'ignore' });
    c.once('error', () => resolve(false));
    c.once('exit', (code) => resolve(code === 0));
  });
}

class GiraBdtmKernel {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || BDTM_PROJECT_ROOT;
    this.jobs = new Map();
  }

  async isReady() {
    const mainPy = path.join(this.projectRoot, 'main.py');
    const hasMain = await fs.pathExists(mainPy);
    const pythonBin = hasMain ? await pickFirstWorkingPython(this.projectRoot) : null;
    return {
      ok: !!(hasMain && pythonBin),
      hasMain,
      pythonBin
    };
  }

  listJobs() {
    return Array.from(this.jobs.values()).map((j) => ({
      id: j.id,
      status: j.status,
      url: j.url,
      mode: j.mode,
      engine: j.engine,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      exitCode: j.exitCode
    }));
  }

  getJob(jobId) {
    const j = this.jobs.get(jobId);
    if (!j) return null;
    return {
      id: j.id,
      status: j.status,
      url: j.url,
      mode: j.mode,
      engine: j.engine,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      exitCode: j.exitCode,
      stdoutTail: j.stdout.slice(-5000),
      stderrTail: j.stderr.slice(-5000)
    };
  }

  /**
   * Direct http(s), .torrent URL, or magnet:?… — torrents use aria2c when installed, else main.py --download-url.
   */
  async startDirectDownload(url) {
    const classified = classifyDownloadInput(url);
    if (classified.kind === 'invalid') {
      return { ok: false, error: classified.message || 'Invalid download input.' };
    }

    const cleanUrl = classified.value;
    const jobId = `gira-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      id: jobId,
      url: cleanUrl,
      mode: classified.kind === 'torrent' ? 'torrent' : 'http',
      status: 'starting',
      createdAt: nowIso(),
      startedAt: null,
      endedAt: null,
      exitCode: null,
      stdout: '',
      stderr: ''
    };
    this.jobs.set(jobId, job);

    if (classified.kind === 'torrent') {
      const useAria = await aria2cAvailable();
      if (useAria) {
        const outDir = path.join(this.projectRoot, 'gira-torrents');
        await fs.ensureDir(outDir);
        const child = spawn(
          'aria2c',
          ['--dir=' + outDir, '--seed-time=0', '--console-log-level=warn', cleanUrl],
          {
            cwd: this.projectRoot,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe']
          }
        );
        job.status = 'running';
        job.startedAt = nowIso();
        job.engine = 'aria2c';
        child.stdout.on('data', (d) => {
          job.stdout += String(d || '');
        });
        child.stderr.on('data', (d) => {
          job.stderr += String(d || '');
        });
        child.once('error', (err) => {
          job.status = 'failed';
          job.endedAt = nowIso();
          job.exitCode = -1;
          job.stderr += `\n[spawn-error] ${String(err && err.message ? err.message : err)}`;
        });
        child.once('exit', (code) => {
          job.exitCode = Number.isInteger(code) ? code : -1;
          job.endedAt = nowIso();
          job.status = job.exitCode === 0 ? 'completed' : 'failed';
        });
        return {
          ok: true,
          jobId,
          status: job.status,
          engine: 'aria2c',
          downloadDir: outDir
        };
      }
    }

    const readiness = await this.isReady();
    if (!readiness.ok) {
      this.jobs.delete(jobId);
      const hint =
        classified.kind === 'torrent'
          ? ' Install aria2 (`brew install aria2` on macOS) for torrent/magnet, or ensure main.py supports this URL.'
          : '';
      return {
        ok: false,
        error:
          'Gira core is not ready (missing main.py or Python in the configured project tree).' + hint,
        details: readiness
      };
    }

    job.engine = 'python';
    const args = ['main.py', '--download-url', cleanUrl];
    const child = spawn(readiness.pythonBin, args, {
      cwd: this.projectRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    job.status = 'running';
    job.startedAt = nowIso();

    child.stdout.on('data', (d) => {
      job.stdout += String(d || '');
    });
    child.stderr.on('data', (d) => {
      job.stderr += String(d || '');
    });

    child.once('error', (err) => {
      job.status = 'failed';
      job.endedAt = nowIso();
      job.exitCode = -1;
      job.stderr += `\n[spawn-error] ${String(err && err.message ? err.message : err)}`;
    });
    child.once('exit', (code) => {
      job.exitCode = Number.isInteger(code) ? code : -1;
      job.endedAt = nowIso();
      job.status = job.exitCode === 0 ? 'completed' : 'failed';
    });

    return {
      ok: true,
      jobId,
      status: job.status,
      pythonBin: readiness.pythonBin
    };
  }
}

module.exports = {
  GiraBdtmKernel
};
