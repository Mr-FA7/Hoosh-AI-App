/**
 * Agent-facing Media Studio tools (original bridge — no upstream project code).
 */
const { listCapabilities, MEDIA_CATEGORIES, STACK_CAPABILITIES, getCapability } = require('./mediaCatalog');
const {
  probeAll,
  probeCapability,
  initMediaStack,
  initAllMediaStacks,
  runMediaAction,
  runCapability,
  clearProbeCache,
  getExampleRoot
} = require('./mediaBridge');
const { installCapabilityDeps, installAllDeps } = require('./mediaInstall');
const { listPipelines, runPipeline } = require('./mediaPipelines');
const { bootstrapMediaStudio, getBootstrapStatus } = require('./mediaBootstrap');

const MEDIA_TOOLS_DOC = `
[HOOSH MEDIA STUDIO — 23 capabilities, original bridges (no upstream code copies)]
Setup: FA7_EXAMPLE_ROOT → example folder | mediaStatus | mediaInstallDeps { capabilityId? }
Stacks: mediaInitStack | mediaInitAllStacks → stackUp
Bootstrap: mediaBootstrap { startStacks? } | mediaBootstrapStatus
Pipelines: mediaPipelineList | mediaPipelineRun { pipelineId, input }

Speech: transcribe, translateAudio, textToSpeech, generateAudio (Bark), cloneVoice (OpenVoice)
Music: separateAudio (Demucs), audioToMidi (Basic Pitch), generateMusic (AudioCraft), generateMidi (Magenta)
Analysis: analyzeAudio (Essentia, AGPL sidecar)
Vision: generateImage (ComfyUI/SD-WebUI), img2img, runComfyWorkflow, generateVideo (Stability)
Video: talkingHead (SadTalker), animateImage (AnimateDiff), lipSync (Wav2Lip NC)
Docs: ocrDocument, ocrPdf (PaddleOCR)
Training: trainLoRA (Kohya SS)
LLM: ollamaPull, ollamaList (built-in Ollama)
Automation: n8nListWorkflows, n8nRunWorkflow
Runtime: runtimeStatus, stackUp (Podman/Docker via platform-ops)

License: AGPL/GPL=sidecar only; Wav2Lip=research; audiocraft weights may be NC.
`.trim();

const MEDIA_TOOL_NAMES = new Set([
  'medialist', 'mediastatus', 'mediaprobe', 'mediainitstack', 'mediainitallstacks',
  'mediainstalldeps', 'mediainstallalldeps', 'mediarun', 'mediapipelinelist', 'mediapipelinerun',
  'mediabootstrap', 'mediabootstrapstatus',
  'transcribe', 'translateaudio', 'texttospeech', 'voiceconvert', 'generateaudio',
  'separateaudio', 'audiotomidi', 'generatemusic', 'generatemidi',
  'ocrdocument', 'ocrpdf', 'generateimage', 'runcomfyworkflow', 'img2img', 'generatevideo',
  'clonevoice', 'analyzeaudio', 'animateimage', 'talkinghead', 'lipsync', 'trainlora',
  'n8nlistworkflows', 'n8nrunworkflow', 'ollamapull', 'ollamalist', 'runtimestatus'
]);

const GLOBAL_MEDIA_TOOLS = new Set([
  'medialist', 'mediastatus', 'mediaprobe', 'mediapipelinelist', 'mediabootstrapstatus',
  'mediainstallalldeps', 'ollamapull', 'ollamalist', 'runtimestatus'
]);

function isMediaTool(name) {
  return MEDIA_TOOL_NAMES.has(String(name || '').toLowerCase());
}

async function executeMediaTool(name, args, ctx) {
  const tool = String(name || '').toLowerCase();
  const safeArgs = args || {};
  const root = ctx.projectRoot;
  if (!root && !GLOBAL_MEDIA_TOOLS.has(tool)) {
    return JSON.stringify({ ok: false, error: 'No project open' });
  }

  if (tool === 'medialist') {
    return JSON.stringify({
      ok: true,
      exampleRoot: getExampleRoot(),
      categories: MEDIA_CATEGORIES,
      stackCapabilities: STACK_CAPABILITIES,
      capabilities: listCapabilities({ category: safeArgs.category })
    });
  }
  if (tool === 'mediastatus') {
    clearProbeCache();
    return JSON.stringify(await probeAll());
  }
  if (tool === 'mediaprobe') {
    const cap = getCapability(safeArgs.capabilityId || safeArgs.id);
    if (!cap) return JSON.stringify({ ok: false, error: 'Unknown capability' });
    return JSON.stringify({ ok: true, ...(await probeCapability(cap)) });
  }
  if (tool === 'mediainitstack') {
    return JSON.stringify(await initMediaStack(root, safeArgs.capabilityId || safeArgs.id));
  }
  if (tool === 'mediainitallstacks') {
    return JSON.stringify(await initAllMediaStacks(root));
  }
  if (tool === 'mediainstalldeps') {
    return JSON.stringify(await installCapabilityDeps(safeArgs.capabilityId || safeArgs.id));
  }
  if (tool === 'mediainstallalldeps') {
    return JSON.stringify(await installAllDeps(safeArgs.category));
  }
  if (tool === 'mediarun') {
    const result = await runCapability(safeArgs.capabilityId || safeArgs.id, safeArgs, { projectRoot: root });
    return JSON.stringify(result);
  }
  if (tool === 'mediapipelinelist') {
    return JSON.stringify({ ok: true, pipelines: listPipelines() });
  }
  if (tool === 'mediapipelinerun') {
    const result = await runPipeline(safeArgs.pipelineId || safeArgs.id, safeArgs.input || safeArgs, { projectRoot: root });
    return JSON.stringify(result);
  }
  if (tool === 'mediabootstrap') {
    const report = await bootstrapMediaStudio(root, {
      pip: safeArgs.pip !== false,
      exampleReqs: safeArgs.exampleReqs !== false,
      initStacks: safeArgs.initStacks !== false,
      startStacks: !!safeArgs.startStacks,
      stackMode: safeArgs.stackMode || 'bundle',
      pipOnly: !!safeArgs.pipOnly
    });
    return JSON.stringify(report);
  }
  if (tool === 'mediabootstrapstatus') {
    return JSON.stringify({ ok: true, ...(await getBootstrapStatus()) });
  }

  const actionMap = {
    transcribe: 'transcribe',
    translateaudio: 'translateAudio',
    texttospeech: 'textToSpeech',
    voiceconvert: 'voiceConvert',
    generateaudio: 'generateAudio',
    separateaudio: 'separateAudio',
    audiotomidi: 'audioToMidi',
    generatemusic: 'generateMusic',
    generatemidi: 'generateMidi',
    ocrdocument: 'ocrDocument',
    ocrpdf: 'ocrPdf',
    generateimage: 'generateImage',
    runcomfyworkflow: 'runComfyWorkflow',
    img2img: 'img2img',
    generatevideo: 'generateVideo',
    clonevoice: 'cloneVoice',
    analyzeaudio: 'analyzeAudio',
    animateimage: 'animateImage',
    talkinghead: 'talkingHead',
    lipsync: 'lipSync',
    trainlora: 'trainLoRA',
    n8nlistworkflows: 'n8nListWorkflows',
    n8nrunworkflow: 'n8nRunWorkflow',
    ollamapull: 'ollamaPull',
    ollamalist: 'ollamaList',
    runtimestatus: 'runtimeStatus'
  };

  if (actionMap[tool]) {
    const result = await runMediaAction(actionMap[tool], safeArgs, { projectRoot: root });
    return JSON.stringify(result);
  }

  return JSON.stringify({ ok: false, error: `Unknown media tool: ${name}` });
}

const MEDIA_KERNEL_TOOLS = [
  { name: 'mediaList', description: 'List all 23 Media Studio capabilities', inputSchema: { type: 'object', properties: { category: { type: 'string' } } } },
  { name: 'mediaStatus', description: 'Probe CLI/Python/HTTP/source for all capabilities', inputSchema: { type: 'object', properties: {} } },
  { name: 'mediaProbe', description: 'Probe one capability', inputSchema: { type: 'object', properties: { capabilityId: { type: 'string' } }, required: ['capabilityId'] } },
  { name: 'mediaInitStack', description: 'Copy compose template to .fa7/media-stacks/', inputSchema: { type: 'object', properties: { capabilityId: { type: 'string' } }, required: ['capabilityId'] } },
  { name: 'mediaInitAllStacks', description: 'Copy all media compose templates', inputSchema: { type: 'object', properties: {} } },
  { name: 'mediaInstallDeps', description: 'pip install packages for a capability', inputSchema: { type: 'object', properties: { capabilityId: { type: 'string' } }, required: ['capabilityId'] } },
  { name: 'mediaInstallAllDeps', description: 'pip install all media Python deps', inputSchema: { type: 'object', properties: { category: { type: 'string' } } } },
  { name: 'mediaRun', description: 'Run capability action', inputSchema: { type: 'object', properties: { capabilityId: { type: 'string' }, action: { type: 'string' } }, required: ['capabilityId'] } },
  { name: 'mediaPipelineList', description: 'List multi-step media pipelines', inputSchema: { type: 'object', properties: {} } },
  { name: 'mediaPipelineRun', description: 'Run pipeline (dub-video, stem-mix, doc-extract, etc.)', inputSchema: { type: 'object', properties: { pipelineId: { type: 'string' }, input: { type: 'object' } }, required: ['pipelineId'] } },
  { name: 'mediaBootstrap', description: 'Full setup: venv, pip, example reqs, stacks, optional stack up', inputSchema: { type: 'object', properties: { startStacks: { type: 'boolean' }, pipOnly: { type: 'boolean' }, stackMode: { type: 'string' } } } },
  { name: 'mediaBootstrapStatus', description: 'Bootstrap state + capability probe', inputSchema: { type: 'object', properties: {} } },
  { name: 'transcribe', description: 'Whisper ASR', inputSchema: { type: 'object', properties: { audio: { type: 'string' }, model: { type: 'string' }, language: { type: 'string' } }, required: ['audio'] } },
  { name: 'translateAudio', description: 'Whisper translate to English', inputSchema: { type: 'object', properties: { audio: { type: 'string' }, model: { type: 'string' } }, required: ['audio'] } },
  { name: 'textToSpeech', description: 'Piper / Coqui TTS', inputSchema: { type: 'object', properties: { text: { type: 'string' }, model: { type: 'string' }, output: { type: 'string' } }, required: ['text'] } },
  { name: 'generateAudio', description: 'Bark expressive TTS/SFX', inputSchema: { type: 'object', properties: { text: { type: 'string' }, output: { type: 'string' } }, required: ['text'] } },
  { name: 'separateAudio', description: 'Demucs stem separation', inputSchema: { type: 'object', properties: { audio: { type: 'string' }, model: { type: 'string' } }, required: ['audio'] } },
  { name: 'audioToMidi', description: 'Basic Pitch → MIDI', inputSchema: { type: 'object', properties: { audio: { type: 'string' }, outputDir: { type: 'string' } }, required: ['audio'] } },
  { name: 'generateMusic', description: 'AudioCraft MusicGen', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, duration: { type: 'number' } } } },
  { name: 'generateMidi', description: 'Magenta MIDI generation', inputSchema: { type: 'object', properties: { steps: { type: 'number' } } } },
  { name: 'analyzeAudio', description: 'Essentia MIR descriptors', inputSchema: { type: 'object', properties: { audio: { type: 'string' } }, required: ['audio'] } },
  { name: 'ocrDocument', description: 'PaddleOCR image', inputSchema: { type: 'object', properties: { image: { type: 'string' }, lang: { type: 'string' } }, required: ['image'] } },
  { name: 'ocrPdf', description: 'PaddleOCR PDF structure', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'generateImage', description: 'ComfyUI or SD WebUI txt2img', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, engine: { type: 'string' }, port: { type: 'number' }, workflow: { type: 'object' } } } },
  { name: 'img2img', description: 'SD WebUI img2img', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, initImages: { type: 'array' } } } },
  { name: 'generateVideo', description: 'Stability SVD video', inputSchema: { type: 'object', properties: { image: { type: 'string' }, outputDir: { type: 'string' } } } },
  { name: 'cloneVoice', description: 'OpenVoice clone', inputSchema: { type: 'object', properties: { referenceAudio: { type: 'string' }, text: { type: 'string' } }, required: ['referenceAudio'] } },
  { name: 'talkingHead', description: 'SadTalker avatar video', inputSchema: { type: 'object', properties: { image: { type: 'string' }, audio: { type: 'string' } }, required: ['image', 'audio'] } },
  { name: 'animateImage', description: 'AnimateDiff', inputSchema: { type: 'object', properties: { config: { type: 'string' } }, required: ['config'] } },
  { name: 'lipSync', description: 'Wav2Lip (NC)', inputSchema: { type: 'object', properties: { face: { type: 'string' }, audio: { type: 'string' } }, required: ['face', 'audio'] } },
  { name: 'trainLoRA', description: 'Kohya SS training UI', inputSchema: { type: 'object', properties: { port: { type: 'number' } } } },
  { name: 'n8nListWorkflows', description: 'List n8n workflows', inputSchema: { type: 'object', properties: { apiKey: { type: 'string' }, port: { type: 'number' } } } },
  { name: 'n8nRunWorkflow', description: 'Run n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' }, input: { type: 'object' } }, required: ['workflowId'] } },
  { name: 'ollamaList', description: 'List Ollama models', inputSchema: { type: 'object', properties: {} } }
];

module.exports = {
  MEDIA_TOOLS_DOC,
  MEDIA_TOOL_NAMES,
  MEDIA_KERNEL_TOOLS,
  isMediaTool,
  executeMediaTool
};
