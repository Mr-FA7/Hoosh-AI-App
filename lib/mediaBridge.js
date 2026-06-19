/**
 * Hoosh Media Bridge — original subprocess/HTTP integration layer (no upstream code).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { runCommand } = require('./containerRuntime');
const { getMediaPython, getMediaEnv } = require('./mediaEnv');
const {
  getCapability,
  listCapabilities,
  STACK_CAPABILITIES,
  getExampleRoot,
  getExamplePath,
  getStacksDir
} = require('./mediaCatalog');

const PROBE_CACHE = new Map();
const PROBE_TTL_MS = 60_000;

function getPython() {
  return getMediaPython();
}

function resolveOutputPath(projectRoot, relOrAbs) {
  const base = projectRoot || path.join(os.homedir(), '.aivon-os', 'media-output');
  fs.ensureDirSync(base);
  if (!relOrAbs) return path.join(base, `out-${Date.now()}`);
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(base, relOrAbs);
  fs.ensureDirSync(path.dirname(abs));
  return abs;
}

async function which(bin) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const r = await runCommand(cmd, [bin], { timeoutMs: 5000 });
  if (!r.ok) return null;
  return String(r.stdout || '').split('\n').map((s) => s.trim()).find(Boolean) || null;
}

async function probePython(expr) {
  const py = getPython();
  const r = await runCommand(py, ['-c', expr], { timeoutMs: 15000, env: getMediaEnv() });
  return { ok: r.ok, python: py, error: r.ok ? null : r.stderr?.slice(0, 300) };
}

async function probeHttp(baseUrl, healthPath = '/') {
  const url = `${String(baseUrl).replace(/\/$/, '')}${healthPath}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, status: res.status, url };
  } catch (e) {
    return { ok: false, error: e.message, url };
  }
}

async function probeCapability(cap) {
  const cached = PROBE_CACHE.get(cap.id);
  if (cached && (Date.now() - cached.at) < PROBE_TTL_MS) return cached.result;

  const result = {
    id: cap.id,
    name: cap.name,
    category: cap.category,
    license: cap.license,
    integration: cap.integration,
    description: cap.description,
    tools: cap.tools || [],
    pipPackages: cap.pipPackages || [],
    composeStack: cap.composeStack || null,
    available: false,
    sourceAvailable: false,
    mode: null,
    detail: null,
    examplePath: getExamplePath(cap),
    exampleExists: false,
    port: cap.defaultPort || null
  };

  if (cap.exampleFolder) {
    result.exampleExists = await fs.pathExists(result.examplePath);
    result.sourceAvailable = result.exampleExists;
  }

  if (cap.integration === 'builtin') {
    result.available = true;
    result.mode = 'builtin';
    result.detail = 'Provided by FA7 OS (Ollama / Stacks)';
  } else if (cap.cli?.length) {
    for (const bin of cap.cli) {
      const found = await which(bin);
      if (found) {
        result.available = true;
        result.mode = 'cli';
        result.detail = found;
        break;
      }
    }
  }

  if (!result.available && cap.pythonCheck) {
    const py = await probePython(cap.pythonCheck);
    if (py.ok) {
      result.available = true;
      result.mode = 'python';
      result.detail = py.python;
    }
  }

  if (!result.available && cap.cli?.length) {
    const venvBin = process.platform === 'win32'
      ? path.join(path.dirname(getPython()), `${cap.cli[0]}.exe`)
      : path.join(path.dirname(getPython()), cap.cli[0]);
    if (await fs.pathExists(venvBin)) {
      result.available = true;
      result.mode = 'cli';
      result.detail = venvBin;
    }
  }

  if (!result.available && cap.scriptEntry && result.exampleExists) {
    const scriptPath = path.join(result.examplePath, cap.scriptEntry);
    if (await fs.pathExists(scriptPath)) {
      result.available = true;
      result.mode = 'example';
      result.detail = scriptPath;
    }
  }

  if (!result.available && cap.composeStack) {
    const stackInRepo = path.join(getStacksDir(), cap.composeStack);
    const stackInProject = path.join(process.cwd(), '.fa7', 'media-stacks', cap.composeStack);
    if (await fs.pathExists(stackInRepo) || await fs.pathExists(stackInProject)) {
      result.available = true;
      result.mode = 'stack';
      result.detail = `stackUp { composeFile: ".fa7/media-stacks/${cap.composeStack}" }`;
    }
  }

  if (!result.available && cap.defaultPort) {
    const http = await probeHttp(`http://127.0.0.1:${cap.defaultPort}`, cap.healthPath || '/');
    if (http.ok) {
      result.available = true;
      result.mode = 'http';
      result.detail = http.url;
    }
  }

  PROBE_CACHE.set(cap.id, { at: Date.now(), result: { ...result } });
  return result;
}

async function probeAll() {
  const caps = listCapabilities();
  const rows = await Promise.all(caps.map((c) => probeCapability(c)));
  return {
    exampleRoot: getExampleRoot(),
    categories: require('./mediaCatalog').MEDIA_CATEGORIES,
    capabilities: rows,
    stackCapabilities: STACK_CAPABILITIES,
    summary: {
      total: rows.length,
      available: rows.filter((r) => r.available).length,
      sourceAvailable: rows.filter((r) => r.sourceAvailable).length,
      byCategory: mediaSummary(rows)
    }
  };
}

function mediaSummary(rows) {
  const out = {};
  for (const r of rows) {
    out[r.category] = out[r.category] || { total: 0, available: 0, sourceAvailable: 0 };
    out[r.category].total += 1;
    if (r.available) out[r.category].available += 1;
    if (r.sourceAvailable) out[r.category].sourceAvailable += 1;
  }
  return out;
}

async function copyStackToProject(projectRoot, stackFile) {
  const src = path.join(getStacksDir(), stackFile);
  if (!await fs.pathExists(src)) throw new Error(`Stack template not found: ${stackFile}`);
  const destDir = path.join(projectRoot, '.fa7', 'media-stacks');
  await fs.ensureDir(destDir);
  const dest = path.join(destDir, stackFile);
  await fs.copy(src, dest, { overwrite: true });
  return { ok: true, file: path.relative(projectRoot, dest).replace(/\\/g, '/'), absolute: dest };
}

async function initMediaStack(projectRoot, capabilityId) {
  const cap = getCapability(capabilityId);
  if (!cap?.composeStack) return { ok: false, error: 'No compose stack for this capability' };
  if (!projectRoot) return { ok: false, error: 'No project open' };
  const copied = await copyStackToProject(projectRoot, cap.composeStack);
  return {
    ok: true,
    capability: cap.id,
    composeFile: copied.file,
    port: cap.defaultPort,
    hint: `stackUp { composeFile: "${copied.file}" }`
  };
}

async function initAllMediaStacks(projectRoot) {
  if (!projectRoot) return { ok: false, error: 'No project open' };
  const results = [];
  for (const id of STACK_CAPABILITIES) {
    try {
      results.push(await initMediaStack(projectRoot, id));
    } catch (e) {
      results.push({ ok: false, capability: id, error: e.message });
    }
  }
  return { ok: true, stacks: results };
}

async function runCli(bin, args, options = {}) {
  const resolved = await which(bin) || bin;
  return runCommand(resolved, args, {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs || 300000,
    env: options.env
  });
}

async function runPythonScript(script, argv = [], options = {}) {
  const py = getPython();
  return runCommand(py, ['-c', script, ...argv], {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs || 900000,
    env: { ...getMediaEnv(), ...options.env, PYTHONUTF8: '1' }
  });
}

async function runInExample(capId, buildArgs, options = {}) {
  const cap = getCapability(capId);
  const root = getExamplePath(cap);
  if (!await fs.pathExists(root)) {
    return { ok: false, error: `Example folder not found: ${root}. Set FA7_EXAMPLE_ROOT.` };
  }
  const py = getPython();
  const entry = cap.scriptEntry;
  if (entry) {
    const script = path.join(root, entry);
    if (await fs.pathExists(script)) {
      const args = typeof buildArgs === 'function' ? buildArgs(root, options.params || {}) : (buildArgs || []);
      const r = await runCommand(py, [script, ...args], {
        cwd: root,
        timeoutMs: options.timeoutMs || 900000,
        env: { ...process.env, PYTHONPATH: root }
      });
      return { ok: r.ok, stdout: r.stdout?.slice(0, 12000), stderr: r.stderr?.slice(0, 4000), cwd: root };
    }
  }
  if (options.inlineScript) {
    const r = await runPythonScript(options.inlineScript, options.argv || [], {
      cwd: root,
      env: { PYTHONPATH: root, ...(options.env || {}) },
      timeoutMs: options.timeoutMs
    });
    return { ok: r.ok, stdout: r.stdout?.slice(0, 12000), stderr: r.stderr?.slice(0, 4000) };
  }
  return { ok: false, error: `No runnable entry for ${capId}` };
}

async function transcribeWhisperHttp(audio, params) {
  const host = params.host || `http://127.0.0.1:${params.port || 9000}`;
  try {
    const buf = await fs.readFile(audio);
    const res = await fetch(`${host.replace(/\/$/, '')}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: buf,
      signal: AbortSignal.timeout(params.timeoutMs || 300000)
    });
    const data = await res.json();
    return { ok: res.ok, result: data, host };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function transcribe(params, ctx) {
  const audio = params.audio || params.file || params.path;
  if (!audio) return { ok: false, error: 'audio path required' };
  const httpTry = await transcribeWhisperHttp(audio, params);
  if (httpTry.ok) return httpTry;

  const model = params.model || 'turbo';
  const taskFlag = params.task === 'translate' ? '--task translate' : '';
  const outDir = resolveOutputPath(ctx.projectRoot, params.outputDir || 'transcripts');
  const whisper = await which('whisper');
  if (whisper) {
    const args = [audio, '--model', model, '--output_dir', outDir, '--output_format', 'json'];
    if (params.task === 'translate') args.push('--task', 'translate');
    if (params.language) args.push('--language', params.language);
    const r = await runCli('whisper', args, { cwd: ctx.projectRoot, timeoutMs: params.timeoutMs || 600000 });
    return { ok: r.ok, stdout: r.stdout, stderr: r.stderr, outputDir: outDir };
  }
  const lang = params.language ? `"${params.language}"` : 'None';
  const taskPy = params.task === 'translate' ? ', task="translate"' : '';
  const script = [
    'import json,sys,whisper',
    `m=whisper.load_model("${model}")`,
    `r=m.transcribe(sys.argv[1], language=${lang}${taskPy})`,
    'print(json.dumps({"text":r["text"],"language":r.get("language")}))'
  ].join(';');
  const r = await runPythonScript(script, [audio], { timeoutMs: params.timeoutMs || 600000 });
  let parsed = null;
  try { parsed = JSON.parse(String(r.stdout || '').trim()); } catch { /* */ }
  return { ok: r.ok, result: parsed, stderr: r.stderr };
}

async function textToSpeech(params, ctx) {
  const text = String(params.text || '').trim();
  if (!text) return { ok: false, error: 'text required' };
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || `speech-${Date.now()}.wav`);

  const piper = await which('piper');
  if (piper) {
    const txtFile = outFile.replace(/\.wav$/i, '.txt');
    await fs.writeFile(txtFile, text, 'utf8');
    const args = ['--output_file', outFile, '--input_file', txtFile];
    if (params.model) args.unshift('--model', params.model);
    const r = await runCli('piper', args, { timeoutMs: 120000 });
    return { ok: r.ok, output: outFile, stderr: r.stderr };
  }

  const tts = await which('tts');
  if (tts) {
    const args = ['--text', text, '--out_path', outFile];
    if (params.model) args.push('--model_name', params.model);
    if (params.speaker) args.push('--speaker_idx', String(params.speaker));
    const r = await runCli('tts', args, { timeoutMs: 300000 });
    return { ok: r.ok, output: outFile, stderr: r.stderr };
  }

  const script = [
    'import sys',
    'from TTS.api import TTS',
    `t=TTS("${params.model || 'tts_models/en/ljspeech/tacotron2-DDC'}")`,
    't.tts_to_file(text=sys.argv[1], file_path=sys.argv[2])',
    'print("ok")'
  ].join(';');
  const r = await runPythonScript(script, [text, outFile], { timeoutMs: 300000 });
  return r.ok ? { ok: true, output: outFile } : { ok: false, error: 'Install piper, tts CLI, or pip install TTS', stderr: r.stderr };
}

async function generateAudioBark(params, ctx) {
  const text = String(params.text || 'Hello from FA7').trim();
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || `bark-${Date.now()}.wav`);
  const script = [
    'import sys',
    'from bark import SAMPLE_RATE, generate_audio, preload_models',
    'import numpy as np',
    'try:',
    '  import scipy.io.wavfile as wav',
    'except ImportError:',
    '  import soundfile as sf',
    '  wav=None',
    'preload_models()',
    'a=generate_audio(sys.argv[1])',
    'if wav: wav.write(sys.argv[2], SAMPLE_RATE, a)',
    'else: sf.write(sys.argv[2], a, SAMPLE_RATE)',
    'print(sys.argv[2])'
  ].join('\n');
  const r = await runPythonScript(script, [text, outFile], { timeoutMs: 600000 });
  return { ok: r.ok, output: outFile, stdout: r.stdout, stderr: r.stderr };
}

async function generateMusic(params, ctx) {
  const prompt = String(params.prompt || 'upbeat electronic dance track');
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || `music-${Date.now()}.wav`);
  const dur = Number(params.duration || 10);
  const script = [
    'import sys,torch',
    'from audiocraft.models import MusicGen',
    'from audiocraft.data.audio import audio_write',
    'm=MusicGen.get_pretrained("facebook/musicgen-small")',
    `m.set_generation_params(duration=${dur})`,
    'a=m.generate([sys.argv[1]])',
    'audio_write(sys.argv[2].replace(".wav",""), a[0].cpu(), m.sample_rate, strategy="loudness")',
    'print(sys.argv[2])'
  ].join(';');
  const r = await runPythonScript(script, [prompt, outFile], { timeoutMs: 900000 });
  if (r.ok) return { ok: true, output: outFile };
  return runInExample('audiocraft', [], { params, timeoutMs: 900000 });
}

async function generateMidi(params, ctx) {
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || `midi-${Date.now()}.mid`);
  const script = [
    'import magenta',
    'print("magenta", magenta.__version__)',
    'print("Use melody_rnn_generate CLI or install from example folder")'
  ].join(';');
  const r = await runPythonScript(script, [], { timeoutMs: 60000 });
  const melody = await which('melody_rnn_generate');
  if (melody) {
    const r2 = await runCli('melody_rnn_generate', ['--output', outFile, '--num_steps', String(params.steps || 128)], { timeoutMs: 300000 });
    return { ok: r2.ok, output: outFile, stderr: r2.stderr };
  }
  return { ok: false, hint: 'pip install magenta or use example folder', stderr: r.stderr };
}

async function analyzeAudio(params, ctx) {
  const audio = params.audio || params.file;
  if (!audio) return { ok: false, error: 'audio required' };
  const script = [
    'import sys,json',
    'import essentia.standard as es',
    'loader=es.MonoLoader(filename=sys.argv[1])',
    'audio=loader()',
    'w=es.Windowing(type="hann")',
    'spectrum=es.Spectrum()',
    'mfcc=es.MFCC()',
    'frames=[]',
    'for frame in es.FrameGenerator(audio, frameSize=1024, hopSize=512):',
    '  spec=spectrum(w(frame))',
    '  bands, coeffs=mfcc(spec)',
    '  frames.append({"mfcc":coeffs.tolist()})',
    'print(json.dumps({"frames":len(frames),"sample":frames[:3]}))'
  ].join('\n');
  const r = await runPythonScript(script, [audio], { timeoutMs: 120000 });
  let parsed = null;
  try { parsed = JSON.parse(String(r.stdout || '').trim()); } catch { /* */ }
  return { ok: r.ok, analysis: parsed, stderr: r.stderr };
}

async function separateAudio(params, ctx) {
  const input = params.audio || params.file;
  if (!input) return { ok: false, error: 'audio path required' };
  const model = params.model || 'htdemucs';
  const outDir = resolveOutputPath(ctx.projectRoot, params.outputDir || 'separated');
  const demucs = await which('demucs');
  if (!demucs) {
    const script = 'import demucs.separate; print("use demucs CLI")';
    const pr = await probePython('import demucs');
    if (!pr.ok) return { ok: false, error: 'pip install demucs' };
  }
  const r = await runCli('demucs', ['-n', model, '-o', outDir, input], {
    cwd: ctx.projectRoot,
    timeoutMs: params.timeoutMs || 900000
  });
  return { ok: r.ok, outputDir: outDir, stderr: r.stderr };
}

async function ocrDocument(params, ctx) {
  const image = params.image || params.file || params.path;
  if (!image) return { ok: false, error: 'image path required' };
  const paddle = await which('paddleocr');
  if (paddle) {
    const r = await runCli('paddleocr', ['ocr', '-i', image, '--use_angle_cls', 'true'], {
      cwd: ctx.projectRoot,
      timeoutMs: params.timeoutMs || 300000
    });
    return { ok: r.ok, text: r.stdout, stderr: r.stderr };
  }
  const script = [
    'import sys,json',
    'from paddleocr import PaddleOCR',
    'o=PaddleOCR(use_angle_cls=True,lang=sys.argv[2] if len(sys.argv)>2 else "en")',
    'r=o.ocr(sys.argv[1],cls=True)',
    'print(json.dumps(r,default=str))'
  ].join(';');
  const r = await runPythonScript(script, [image, params.lang || 'en'], { timeoutMs: 300000 });
  return { ok: r.ok, result: r.stdout, stderr: r.stderr };
}

async function ocrPdf(params, ctx) {
  const file = params.file || params.pdf || params.path;
  if (!file) return { ok: false, error: 'pdf path required' };
  const paddle = await which('paddleocr');
  if (paddle) {
    const r = await runCli('paddleocr', ['pp_structure', '-i', file, '--type', 'pdf'], {
      timeoutMs: params.timeoutMs || 600000
    });
    return { ok: r.ok, text: r.stdout, stderr: r.stderr };
  }
  return ocrDocument({ ...params, image: file }, ctx);
}

function buildComfyTxt2ImgWorkflow(prompt, seed = 42) {
  return {
    prompt: {
      '3': { class_type: 'KSampler', inputs: { seed, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'bad quality', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'hoosh', images: ['8', 0] } }
    }
  };
}

async function generateImageComfy(params) {
  const host = params.host || `http://127.0.0.1:${params.port || 8188}`;
  let workflow = params.workflow;
  if (!workflow && params.prompt) workflow = buildComfyTxt2ImgWorkflow(params.prompt, params.seed || Date.now() % 999999);
  if (!workflow) return { ok: false, error: 'workflow or prompt required for ComfyUI' };
  try {
    const res = await fetch(`${host.replace(/\/$/, '')}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeof workflow === 'string' ? JSON.parse(workflow) : workflow),
      signal: AbortSignal.timeout(params.timeoutMs || 120000)
    });
    const data = await res.json();
    return { ok: res.ok, data, host };
  } catch (e) {
    return { ok: false, error: e.message, hint: 'mediaInitStack { capabilityId: "comfyui" } then stackUp' };
  }
}

async function generateImageSdWebui(params) {
  const host = params.host || `http://127.0.0.1:${params.port || 7860}`;
  const endpoint = params.endpoint === 'img2img' ? 'img2img' : 'txt2img';
  const body = {
    prompt: params.prompt || 'a scenic landscape',
    negative_prompt: params.negativePrompt || '',
    steps: params.steps || 20,
    width: params.width || 512,
    height: params.height || 512,
    cfg_scale: params.cfgScale || 7
  };
  if (endpoint === 'img2img' && params.initImages) body.init_images = params.initImages;
  try {
    const res = await fetch(`${host.replace(/\/$/, '')}/sdapi/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs || 300000)
    });
    const data = await res.json();
    const outPath = params.output;
    if (outPath && data.images?.[0]) {
      await fs.writeFile(outPath, Buffer.from(data.images[0], 'base64'));
    }
    return { ok: res.ok, images: data.images?.length || 0, output: outPath, host };
  } catch (e) {
    return { ok: false, error: e.message, hint: 'mediaInitStack { capabilityId: "stable-diffusion-webui" }' };
  }
}

async function generateVideo(params, ctx) {
  const outDir = resolveOutputPath(ctx.projectRoot, params.outputDir || 'video-out');
  return runInExample('generative-models', (root, p) => [
    '--input_path', p.image || p.input || '',
    '--output_path', outDir
  ], { params, timeoutMs: 900000 });
}

async function talkingHead(params, ctx) {
  const image = params.image || params.source_image;
  const audio = params.audio || params.driven_audio;
  const outDir = resolveOutputPath(ctx.projectRoot, params.outputDir || 'talking-head');
  if (!image || !audio) return { ok: false, error: 'image and audio required' };
  return runInExample('sadtalker', () => [
    '--driven_audio', audio,
    '--source_image', image,
    '--result_dir', outDir,
    '--still'
  ], { params, timeoutMs: 900000 });
}

async function lipSync(params, ctx) {
  const face = params.face || params.video;
  const audio = params.audio;
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || 'lipsync.mp4');
  if (!face || !audio) return { ok: false, error: 'face video and audio required (NC license)' };
  return runInExample('wav2lip', () => [
    '--checkpoint_path', 'checkpoints/wav2lip_gan.pth',
    '--face', face,
    '--audio', audio,
    '--outfile', outFile
  ], { params, timeoutMs: 900000 });
}

async function animateImage(params, ctx) {
  const config = params.config;
  if (config) {
    return runInExample('animatediff', () => ['--config', config], { params, timeoutMs: 900000 });
  }
  return { ok: false, error: 'config path required (AnimateDiff YAML)', hint: 'example: scripts/animate.py --config configs/...' };
}

async function cloneVoice(params, ctx) {
  const ref = params.referenceAudio || params.reference;
  const text = params.text || 'Hello from OpenVoice';
  if (!ref) return { ok: false, error: 'referenceAudio required' };
  const outFile = resolveOutputPath(ctx.projectRoot, params.output || `clone-${Date.now()}.wav`);
  return runInExample('openvoice', () => [], {
    params,
    inlineScript: [
      'import sys',
      'print("OpenVoice: install deps in example folder, then: python -m openvoice_app")',
      'print("reference:", sys.argv[1] if len(sys.argv)>1 else "n/a")'
    ].join('\n'),
    argv: [ref],
    timeoutMs: 60000
  });
}

async function trainLoRA(params) {
  const host = params.host || `http://127.0.0.1:${params.port || 7861}`;
  const http = await probeHttp(host, '/');
  if (http.ok) return { ok: true, mode: 'http', url: host, hint: 'Open Kohya SS Gradio UI' };
  return {
    ok: false,
    hint: 'mediaInitStack { capabilityId: "kohya_ss" } then stackUp, or run kohya_gui.py in example folder'
  };
}

async function ollamaList() {
  const r = await runCli('ollama', ['list'], { timeoutMs: 30000 });
  return { ok: r.ok, models: r.stdout, stderr: r.stderr };
}

async function n8nRequest(pathSuffix, options = {}) {
  const host = options.host || `http://127.0.0.1:${options.port || 5678}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.apiKey) headers['X-N8N-API-KEY'] = options.apiKey;
  try {
    const res = await fetch(`${host.replace(/\/$/, '')}${pathSuffix}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs || 30000)
    });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* */ }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function runMediaAction(action, params, ctx = {}) {
  const p = params || {};
  switch (action) {
    case 'transcribe':
      return transcribe(p, ctx);
    case 'translateAudio':
      return transcribe({ ...p, task: 'translate' }, ctx);
    case 'textToSpeech':
    case 'voiceConvert':
      return textToSpeech(p, ctx);
    case 'generateAudio':
      return generateAudioBark(p, ctx);
    case 'separateAudio':
      return separateAudio(p, ctx);
    case 'audioToMidi': {
      if (!p.audio) return { ok: false, error: 'audio required' };
      const outDir = resolveOutputPath(ctx.projectRoot, p.outputDir || 'midi');
      const r = await runCli('basic-pitch', [outDir, p.audio], { cwd: ctx.projectRoot, timeoutMs: 600000 });
      return { ok: r.ok, outputDir: outDir, stderr: r.stderr };
    }
    case 'generateMusic':
      return generateMusic(p, ctx);
    case 'generateMidi':
      return generateMidi(p, ctx);
    case 'analyzeAudio':
      return analyzeAudio(p, ctx);
    case 'ocrDocument':
      return ocrDocument(p, ctx);
    case 'ocrPdf':
      return ocrPdf(p, ctx);
    case 'generateImage':
      if (p.engine === 'sd-webui' || p.engine === 'a1111' || p.port === 7860) return generateImageSdWebui(p);
      if (p.prompt && !p.workflow) return generateImageComfy(p);
      return generateImageComfy(p);
    case 'runComfyWorkflow':
      return generateImageComfy(p);
    case 'img2img':
      return generateImageSdWebui({ ...p, endpoint: 'img2img' });
    case 'generateVideo':
      return generateVideo(p, ctx);
    case 'talkingHead':
      return talkingHead(p, ctx);
    case 'lipSync':
      return lipSync(p, ctx);
    case 'animateImage':
      return animateImage(p, ctx);
    case 'cloneVoice':
      return cloneVoice(p, ctx);
    case 'trainLoRA':
      return trainLoRA(p);
    case 'n8nListWorkflows':
      return n8nRequest('/api/v1/workflows', { apiKey: p.apiKey, port: p.port });
    case 'n8nRunWorkflow':
      return n8nRequest(`/api/v1/workflows/${p.workflowId}/run`, {
        method: 'POST', apiKey: p.apiKey, body: p.input || {}, port: p.port
      });
    case 'ollamaPull': {
      const r = await runCli('ollama', ['pull', p.model || 'qwen2.5:7b'], { timeoutMs: 600000 });
      return { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
    }
    case 'ollamaList':
      return ollamaList();
    case 'runtimeStatus': {
      const { runtimeStatus } = require('./stackRunner');
      return runtimeStatus();
    }
    default:
      return { ok: false, error: `Unknown media action: ${action}` };
  }
}

async function runCapability(capabilityId, params, ctx) {
  const cap = getCapability(capabilityId);
  if (!cap) return { ok: false, error: 'Unknown capability' };
  const action = params?.action || cap.tools?.[0];
  if (!action) return { ok: false, error: 'No action specified' };
  const result = await runMediaAction(action, { ...params, capabilityId }, ctx);
  return { ...result, capability: cap.id, action };
}

function clearProbeCache() {
  PROBE_CACHE.clear();
}

module.exports = {
  probeCapability,
  probeAll,
  initMediaStack,
  initAllMediaStacks,
  copyStackToProject,
  runMediaAction,
  runCapability,
  resolveOutputPath,
  clearProbeCache,
  getExampleRoot,
  buildComfyTxt2ImgWorkflow
};
