/**
 * Hoosh Media Studio — capability catalog (original metadata; no upstream code).
 */
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const EXAMPLE_ROOT = process.env.FA7_EXAMPLE_ROOT
  || process.env.FA7_TOOLS_ROOT
  || (() => {
    const def = path.join(os.homedir(), 'Desktop', 'example');
    if (fs.existsSync(def)) {
      process.env.FA7_EXAMPLE_ROOT = def;
      return def;
    }
    return path.join(os.homedir(), 'Desktop', 'example');
  })();

const MEDIA_CAPABILITIES = [
  {
    id: 'whisper', name: 'Whisper ASR', category: 'speech-in', license: 'MIT',
    integration: 'cli', exampleFolder: 'whisper-main',
    cli: ['whisper'], pythonCheck: 'import whisper',
    pipPackages: ['openai-whisper', 'faster-whisper'],
    composeStack: 'media-whisper.yaml', defaultPort: 9000, healthPath: '/health',
    description: 'Multilingual speech-to-text and translation.',
    tools: ['transcribe', 'translateAudio']
  },
  {
    id: 'piper', name: 'Piper TTS', category: 'speech-out', license: 'MIT',
    integration: 'cli', exampleFolder: 'piper-master',
    cli: ['piper'], pythonCheck: 'import piper',
    composeStack: 'media-piper.yaml', defaultPort: 5000,
    description: 'Fast local neural TTS (ONNX).',
    tools: ['textToSpeech']
  },
  {
    id: 'tts', name: 'Coqui TTS', category: 'speech-out', license: 'MPL-2.0',
    integration: 'cli', exampleFolder: 'TTS-dev',
    cli: ['tts', 'tts-server'], pythonCheck: 'import TTS',
    pipPackages: ['TTS'],
    composeStack: 'media-tts.yaml', defaultPort: 5002, healthPath: '/',
    description: 'Neural TTS (XTTS, VITS, YourTTS).',
    tools: ['textToSpeech', 'voiceConvert']
  },
  {
    id: 'bark', name: 'Bark', category: 'speech-out', license: 'MIT',
    integration: 'python', exampleFolder: 'bark-main',
    pythonCheck: 'from bark import generate_audio',
    pipPackages: ['git+https://github.com/suno-ai/bark.git'],
    description: 'Expressive text-to-audio: speech, music, SFX.',
    tools: ['generateAudio']
  },
  {
    id: 'openvoice', name: 'OpenVoice', category: 'speech-out', license: 'MIT',
    integration: 'python', exampleFolder: 'OpenVoice-main',
    pythonCheck: 'import openvoice',
    scriptEntry: 'openvoice_app.py',
    description: 'Instant voice cloning with style control.',
    tools: ['cloneVoice']
  },
  {
    id: 'demucs', name: 'Demucs', category: 'music', license: 'MIT',
    integration: 'cli', exampleFolder: 'demucs-main',
    cli: ['demucs'], pythonCheck: 'import demucs',
    pipPackages: ['demucs'],
    description: 'Music source separation (vocals, drums, bass, other).',
    tools: ['separateAudio']
  },
  {
    id: 'basic-pitch', name: 'Basic Pitch', category: 'music', license: 'Apache-2.0',
    integration: 'cli', exampleFolder: 'basic-pitch-main',
    cli: ['basic-pitch'], pythonCheck: 'import basic_pitch',
    pipPackages: ['basic-pitch'],
    description: 'Audio to MIDI transcription.',
    tools: ['audioToMidi']
  },
  {
    id: 'audiocraft', name: 'AudioCraft', category: 'music', license: 'MIT (NC weights)',
    integration: 'python', exampleFolder: 'audiocraft-main',
    pythonCheck: 'import audiocraft',
    pipPackages: ['audiocraft'],
    description: 'MusicGen / AudioGen generation.',
    tools: ['generateMusic']
  },
  {
    id: 'magenta', name: 'Magenta', category: 'music', license: 'Apache-2.0',
    integration: 'python', exampleFolder: 'magenta-main',
    pythonCheck: 'import note_seq',
    pipPackages: ['note-seq', 'magenta'],
    description: 'Google ML-for-music (legacy TensorFlow).',
    tools: ['generateMidi']
  },
  {
    id: 'essentia', name: 'Essentia', category: 'analysis', license: 'AGPL-3',
    integration: 'python', exampleFolder: 'essentia-master',
    pythonCheck: 'import essentia',
    pipPackages: ['essentia'],
    composeStack: 'media-essentia.yaml',
    description: 'Audio/MIR descriptors. AGPL — container boundary only.',
    tools: ['analyzeAudio']
  },
  {
    id: 'comfyui', name: 'ComfyUI', category: 'vision', license: 'GPL-3',
    integration: 'http', exampleFolder: 'ComfyUI-master',
    composeStack: 'media-comfyui.yaml', defaultPort: 8188, healthPath: '/system_stats',
    description: 'Node-graph image/video AI engine.',
    tools: ['generateImage', 'runComfyWorkflow']
  },
  {
    id: 'stable-diffusion-webui', name: 'SD WebUI (A1111)', category: 'vision', license: 'AGPL-3',
    integration: 'http', exampleFolder: 'stable-diffusion-webui-master',
    composeStack: 'media-sd-webui.yaml', defaultPort: 7860, healthPath: '/sdapi/v1/options',
    description: 'Automatic1111 WebUI with --api.',
    tools: ['generateImage', 'img2img']
  },
  {
    id: 'generative-models', name: 'Stability Generative Models', category: 'vision', license: 'MIT (model-specific)',
    integration: 'python', exampleFolder: 'generative-models-main',
    scriptEntry: 'scripts/sampling/simple_video_sample.py',
    description: 'SDXL, SVD video, turbo models.',
    tools: ['generateImage', 'generateVideo']
  },
  {
    id: 'animatediff', name: 'AnimateDiff', category: 'video', license: 'Apache-2.0',
    integration: 'python', exampleFolder: 'AnimateDiff-main',
    scriptEntry: 'scripts/animate.py',
    description: 'Animate still images with motion modules.',
    tools: ['animateImage']
  },
  {
    id: 'sadtalker', name: 'SadTalker', category: 'video', license: 'Apache-2.0',
    integration: 'python', exampleFolder: 'SadTalker-main',
    scriptEntry: 'inference.py',
    description: 'Portrait + audio → talking-head video.',
    tools: ['talkingHead']
  },
  {
    id: 'wav2lip', name: 'Wav2Lip', category: 'video', license: 'Non-commercial (OSS)',
    integration: 'python', exampleFolder: 'Wav2Lip-master',
    scriptEntry: 'inference.py',
    description: 'Lip-sync video (research-only OSS).',
    tools: ['lipSync']
  },
  {
    id: 'paddleocr', name: 'PaddleOCR', category: 'document', license: 'Apache-2.0',
    integration: 'cli', exampleFolder: 'PaddleOCR-main',
    cli: ['paddleocr'], pythonCheck: 'import paddleocr',
    pipPackages: ['paddleocr', 'paddlepaddle'],
    composeStack: 'media-paddleocr.yaml', defaultPort: 8080,
    description: 'OCR and document structure extraction.',
    tools: ['ocrDocument', 'ocrPdf']
  },
  {
    id: 'kohya_ss', name: 'Kohya SS', category: 'training', license: 'Apache-2.0',
    integration: 'http', exampleFolder: 'kohya_ss-master',
    composeStack: 'media-kohya.yaml', defaultPort: 7861, healthPath: '/',
    scriptEntry: 'kohya_gui.py',
    description: 'LoRA / Dreambooth / SDXL training.',
    tools: ['trainLoRA']
  },
  {
    id: 'llama-models', name: 'Meta Llama Models', category: 'llm', license: 'Llama Community',
    integration: 'builtin', exampleFolder: 'llama-models-main',
    description: 'Via built-in Ollama runtime.',
    tools: ['ollamaPull', 'ollamaList']
  },
  {
    id: 'qwen', name: 'Qwen LLM', category: 'llm', license: 'Tongyi Qianwen',
    integration: 'builtin', exampleFolder: 'Qwen-main',
    description: 'Via Ollama Qwen presets.',
    tools: ['ollamaPull', 'ollamaList']
  },
  {
    id: 'n8n', name: 'n8n Automation', category: 'automation', license: 'Fair-code',
    integration: 'http', exampleFolder: 'n8n-master',
    composeStack: 'media-n8n.yaml', defaultPort: 5678, healthPath: '/healthz',
    description: 'External workflow automation sidecar.',
    tools: ['n8nListWorkflows', 'n8nRunWorkflow']
  },
  {
    id: 'media-studio-full', name: 'Media Studio Bundle', category: 'runtime', license: 'Mixed',
    integration: 'compose', composeStack: 'media-studio-full.yaml',
    description: 'Whisper + Piper + PaddleOCR + n8n in one compose file.',
    tools: ['mediaInitAllStacks']
  },
  {
    id: 'podman', name: 'Podman', category: 'runtime', license: 'Apache-2.0',
    integration: 'builtin', exampleFolder: 'podman-main',
    description: 'Rootless containers via Hoosh Stacks.',
    tools: ['runtimeStatus', 'stackUp']
  },
  {
    id: 'moby', name: 'Moby (Docker engine)', category: 'runtime', license: 'Apache-2.0',
    integration: 'builtin', exampleFolder: 'moby-master',
    description: 'Host Docker/Podman CLI via Stacks.',
    tools: ['runtimeStatus']
  }
];

const MEDIA_CATEGORIES = [
  { id: 'speech-in', label: 'Speech In (ASR)' },
  { id: 'speech-out', label: 'Speech Out (TTS / Voice)' },
  { id: 'music', label: 'Music & Audio ML' },
  { id: 'analysis', label: 'Audio Analysis' },
  { id: 'vision', label: 'Image Generation' },
  { id: 'video', label: 'Video / Avatar' },
  { id: 'document', label: 'OCR & Documents' },
  { id: 'training', label: 'Model Training' },
  { id: 'llm', label: 'LLM (via Ollama)' },
  { id: 'automation', label: 'External Automation' },
  { id: 'runtime', label: 'Container Runtime' }
];

const STACK_CAPABILITIES = MEDIA_CAPABILITIES.filter((c) => c.composeStack).map((c) => c.id);

function getExampleRoot() {
  return EXAMPLE_ROOT;
}

function getCapability(id) {
  return MEDIA_CAPABILITIES.find((c) => c.id === id) || null;
}

function listCapabilities(filter = {}) {
  let rows = [...MEDIA_CAPABILITIES];
  if (filter.category) rows = rows.filter((c) => c.category === filter.category);
  if (filter.integration) rows = rows.filter((c) => c.integration === filter.integration);
  if (filter.hasStack) rows = rows.filter((c) => c.composeStack);
  return rows;
}

function getStacksDir() {
  return path.join(__dirname, '..', 'templates', 'stacks');
}

function getExamplePath(cap) {
  if (!cap?.exampleFolder) return null;
  return path.join(EXAMPLE_ROOT, cap.exampleFolder);
}

module.exports = {
  MEDIA_CAPABILITIES,
  MEDIA_CATEGORIES,
  STACK_CAPABILITIES,
  EXAMPLE_ROOT,
  getExampleRoot,
  getCapability,
  listCapabilities,
  getStacksDir,
  getExamplePath
};
