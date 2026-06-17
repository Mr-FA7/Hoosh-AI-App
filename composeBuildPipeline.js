const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

function pickGradleWrapper(projectRoot) {
  const unixWrapper = path.join(projectRoot, 'gradlew');
  const winWrapper = path.join(projectRoot, 'gradlew.bat');
  if (fs.existsSync(unixWrapper)) return { bin: unixWrapper, shell: false };
  if (fs.existsSync(winWrapper)) return { bin: winWrapper, shell: true };
  return null;
}

function runProcess(bin, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: !!options.shell
    });

    let stdout = '';
    let stderr = '';
    const timeoutMs = Number(options.timeoutMs || 30 * 60 * 1000);
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr,
        timedOut
      });
    });
  });
}

async function walkFiles(dir, bucket = []) {
  if (!(await fs.pathExists(dir))) return bucket;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      bucket.push(full);
      await walkFiles(full, bucket);
    } else {
      bucket.push(full);
    }
  }
  return bucket;
}

async function collectComposeOutputs(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'build', 'ci-release', 'binaries'),
    path.join(projectRoot, 'desktop', 'app', 'build', 'custom-installer'),
    path.join(projectRoot, 'desktop', 'app', 'build', 'dist', 'archives'),
    path.join(projectRoot, 'desktop', 'app', 'build', 'compose', 'binaries')
  ];

  const acceptedSuffixes = ['.app', '.dmg', '.pkg', '.msi', '.exe', '.deb', '.rpm', '.zip', '.tar.gz'];
  const all = [];

  for (const c of candidates) {
    if (await fs.pathExists(c)) {
      await walkFiles(c, all);
    }
  }

  return all
    .filter((p) => acceptedSuffixes.some((s) => p.endsWith(s)))
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .sort();
}

async function buildComposeArtifacts(options = {}) {
  const { exec, execSync } = require('child_process');
  const projectRoot = path.resolve(options.projectRoot || process.cwd());

  // 1. Determine correct executable and task
  const isWin = process.platform === 'win32';
  const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
  
  // Use user-provided tasks or the robust default
  const tasks = Array.isArray(options.tasks) && options.tasks.length
    ? options.tasks.join(' ')
    : ':desktop:packageDistributionForCurrentOS';
  
  const fullCommand = `${gradleCmd} ${tasks} ${options.dry_run ? '--dry-run' : ''} --no-daemon`;

  // 2. Inject JAVA_HOME 17 specifically for macOS
  const buildEnv = Object.assign({}, process.env, {
    SKIP_ANDROID_BUILD: 'true'
  });
  
  if (process.platform === 'darwin') {
    try {
      const java17Path = execSync('/usr/libexec/java_home -v 17').toString().trim();
      buildEnv.JAVA_HOME = java17Path;
      console.log(`[ComposeBuild] Injected JAVA_HOME: ${java17Path}`);
    } catch (err) {
      console.warn('[ComposeBuild] JDK 17 not found via java_home. Attempting to proceed with default Java.');
    }
  }

  // 3. Execute the command
  return new Promise(async (resolve) => {
    console.log(`[ComposeBuild] Running: ${fullCommand} in ${projectRoot}`);
    
    exec(fullCommand, { 
      cwd: projectRoot,
      env: buildEnv,
      maxBuffer: 20 * 1024 * 1024 // Increased buffer for long build logs
    }, async (error, stdout, stderr) => {
      const outputFiles = await collectComposeOutputs(projectRoot);
      const tail = (text) => String(text || '').split('\n').slice(-150).join('\n');

      resolve({
        ok: !error,
        project_root: projectRoot,
        command: fullCommand,
        exit_code: error ? (error.code || 1) : 0,
        output_files: outputFiles,
        stdout_tail: tail(stdout),
        stderr_tail: tail(stderr),
        error: error ? error.message : null
      });
    });
  });
}

module.exports = {
  buildComposeArtifacts,
  collectComposeOutputs
};
