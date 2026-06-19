/**
 * Hoosh Media — pip/dependency installer with venv + example-folder support.
 */
const fs = require('fs-extra');
const path = require('path');
const { runCommand } = require('./containerRuntime');
const { getCapability, listCapabilities, getExamplePath } = require('./mediaCatalog');
const { getMediaPython, getMediaEnv, ensureMediaVenv } = require('./mediaEnv');

/** Tier 1 — lightweight, install first */
const CORE_PACKAGES = [
  'numpy',
  'scipy',
  'soundfile',
  'librosa',
  'openai-whisper',
  'faster-whisper',
  'demucs',
  'basic-pitch',
  'onnxruntime',
  'piper-tts'
];

/** Tier 2 — medium size */
const STANDARD_PACKAGES = [
  'paddlepaddle',
  'paddleocr',
  'TTS',
  'bark',
  'transformers',
  'accelerate',
  'safetensors',
  'pillow',
  'opencv-python-headless',
  'einops'
];

/** Tier 3 — heavy / optional — best effort */
const OPTIONAL_PACKAGES = [
  'audiocraft',
  'essentia',
  'note-seq',
  'magenta',
  'gradio',
  'omegaconf',
  'hydra-core'
];

function getPython() {
  return getMediaPython();
}

async function pipInstall(packages, options = {}) {
  await ensureMediaVenv();
  const py = getPython();
  const pkgs = Array.isArray(packages) ? packages : [packages];
  const args = ['-m', 'pip', 'install'];
  if (options.indexUrl) args.push('-i', options.indexUrl);
  if (options.extraIndex) args.push('--extra-index-url', options.extraIndex);
  args.push(...pkgs);
  if (options.upgrade) args.push('--upgrade');
  return runCommand(py, args, {
    timeoutMs: options.timeoutMs || 900000,
    env: getMediaEnv()
  });
}

async function installTorchCpu() {
  const py = getPython();
  const check = await runCommand(py, ['-c', 'import torch; print(torch.__version__)'], {
    timeoutMs: 30000,
    env: getMediaEnv()
  });
  if (check.ok) return { ok: true, skipped: true, version: check.stdout?.trim() };
  return pipInstall(['torch', 'torchaudio'], {
    timeoutMs: 1200000,
    indexUrl: 'https://download.pytorch.org/whl/cpu'
  });
}

async function installPackageTier(name, packages) {
  const results = [];
  for (const pkg of packages) {
    const r = await pipInstall([pkg], { timeoutMs: 900000 });
    results.push({ package: pkg, ok: r.ok, stderr: r.stderr?.slice(-500) });
  }
  const installed = results.filter((x) => x.ok).length;
  return {
    tier: name,
    ok: installed >= Math.ceil(packages.length * 0.6),
    installed,
    failed: results.filter((x) => !x.ok).map((x) => x.package),
    results
  };
}

async function installCoreDeps() {
  const torch = await installTorchCpu();
  const tier1 = await installPackageTier('core', CORE_PACKAGES);
  const tier2 = await installPackageTier('standard', STANDARD_PACKAGES);
  const tier3 = await installPackageTier('optional', OPTIONAL_PACKAGES);
  return {
    ok: torch.ok && tier1.ok && tier2.ok,
    torch,
    tier1,
    tier2,
    tier3
  };
}

async function installFromExampleRequirements(capabilityId) {
  const cap = getCapability(capabilityId);
  if (!cap) return { ok: false, error: 'Unknown capability' };
  const root = getExamplePath(cap);
  if (!await fs.pathExists(root)) return { ok: false, skipped: true, error: 'Example folder missing' };

  const reqCandidates = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'setup.py'];
  const found = reqCandidates.filter((f) => fs.existsSync(path.join(root, f)));
  if (!found.length) return { ok: true, skipped: true, message: 'No installable spec in example folder' };

  const py = getPython();
  const results = [];

  if (found.includes('requirements.txt')) {
    const r = await runCommand(py, ['-m', 'pip', 'install', '-r', path.join(root, 'requirements.txt')], {
      cwd: root,
      timeoutMs: 1800000,
      env: getMediaEnv()
    });
    results.push({ type: 'requirements.txt', ok: r.ok, stderr: r.stderr?.slice(-800) });
  }

  if (found.includes('setup.py') || found.includes('pyproject.toml')) {
    const r = await runCommand(py, ['-m', 'pip', 'install', '-e', '.'], {
      cwd: root,
      timeoutMs: 1800000,
      env: getMediaEnv()
    });
    results.push({ type: 'editable', ok: r.ok, stderr: r.stderr?.slice(-800) });
  }

  return {
    ok: results.some((r) => r.ok),
    capability: capabilityId,
    path: root,
    results
  };
}

async function installAllExampleRequirements(onProgress) {
  const caps = listCapabilities().filter((c) => c.exampleFolder && c.integration !== 'builtin');
  const results = [];
  for (const cap of caps) {
    onProgress?.({ phase: 'example-reqs', capability: cap.id });
    try {
      results.push({ id: cap.id, ...(await installFromExampleRequirements(cap.id)) });
    } catch (e) {
      results.push({ id: cap.id, ok: false, error: e.message });
    }
  }
  return {
    ok: results.filter((r) => r.ok).length > 0,
    attempted: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results
  };
}

async function installCapabilityDeps(capabilityId) {
  const cap = getCapability(capabilityId);
  if (!cap) return { ok: false, error: 'Unknown capability' };
  const packages = cap.pipPackages || [];
  const pipResult = packages.length
    ? await pipInstall(packages)
    : { ok: true, skipped: true };
  const exampleResult = await installFromExampleRequirements(capabilityId);
  return {
    ok: pipResult.ok || exampleResult.ok,
    capability: cap.id,
    packages,
    pip: { ok: pipResult.ok, stderr: pipResult.stderr?.slice(-1000) },
    example: exampleResult
  };
}

async function installAllDeps(category, onProgress) {
  await ensureMediaVenv();
  const core = await installCoreDeps();
  onProgress?.({ phase: 'core-pip', result: core });

  const caps = listCapabilities(category ? { category } : {});
  const capResults = [];
  for (const cap of caps) {
    if (!cap.pipPackages?.length) continue;
    onProgress?.({ phase: 'cap-pip', capability: cap.id });
    capResults.push({ id: cap.id, ...(await installCapabilityDeps(cap.id)) });
  }

  const example = await installAllExampleRequirements(onProgress);

  return {
    ok: core.ok || capResults.some((r) => r.ok) || example.succeeded > 0,
    core,
    capabilities: capResults,
    example,
    python: getPython()
  };
}

module.exports = {
  CORE_PACKAGES,
  STANDARD_PACKAGES,
  OPTIONAL_PACKAGES,
  pipInstall,
  installTorchCpu,
  installCoreDeps,
  installCapabilityDeps,
  installAllDeps,
  installFromExampleRequirements,
  installAllExampleRequirements,
  getPython
};
