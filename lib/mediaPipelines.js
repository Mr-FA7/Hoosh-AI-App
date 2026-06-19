/**
 * Hoosh Media — multi-step pipelines (original orchestration).
 */
const { runMediaAction } = require('./mediaBridge');

const MEDIA_PIPELINES = {
  'dub-video': {
    name: 'Transcribe → TTS → Talking head',
    steps: [
      { action: 'transcribe', map: { audio: 'audio' }, saveAs: 'transcript' },
      { action: 'textToSpeech', map: { text: 'transcript.text' }, saveAs: 'ttsAudio' },
      { action: 'talkingHead', map: { image: 'image', audio: 'ttsAudio.output' } }
    ]
  },
  'stem-mix': {
    name: 'Demucs stem separation',
    steps: [{ action: 'separateAudio', map: { audio: 'audio' } }]
  },
  'doc-extract': {
    name: 'OCR document',
    steps: [{ action: 'ocrDocument', map: { image: 'image' } }]
  },
  'image-pipeline': {
    name: 'SD WebUI txt2img',
    steps: [{ action: 'generateImage', map: { prompt: 'prompt', engine: 'engine' } }]
  },
  'voice-clone-speak': {
    name: 'OpenVoice clone + speak',
    steps: [
      { action: 'cloneVoice', map: { referenceAudio: 'referenceAudio', text: 'text' } }
    ]
  },
  'music-gen': {
    name: 'AudioCraft music generation',
    steps: [{ action: 'generateMusic', map: { prompt: 'prompt', duration: 'duration' } }]
  },
  'animate-portrait': {
    name: 'AnimateDiff motion',
    steps: [{ action: 'animateImage', map: { config: 'config', image: 'image' } }]
  },
  'lip-sync': {
    name: 'Wav2Lip lip sync',
    steps: [{ action: 'lipSync', map: { face: 'face', audio: 'audio' } }]
  }
};

function getByDotPath(obj, pathStr) {
  return String(pathStr || '').split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

async function runPipeline(pipelineId, input, ctx) {
  const pipe = MEDIA_PIPELINES[pipelineId];
  if (!pipe) return { ok: false, error: `Unknown pipeline: ${pipelineId}` };
  const state = { ...input };
  const stepResults = [];
  for (const step of pipe.steps) {
    const params = {};
    for (const [k, v] of Object.entries(step.map || {})) {
      params[k] = state[v] ?? getByDotPath(state, v);
    }
    const result = await runMediaAction(step.action, params, ctx);
    stepResults.push({ action: step.action, result });
    if (!result.ok) {
      return { ok: false, pipeline: pipelineId, failedAt: step.action, stepResults, state };
    }
    if (step.saveAs) state[step.saveAs] = result;
    Object.assign(state, result);
  }
  return { ok: true, pipeline: pipelineId, name: pipe.name, stepResults, state };
}

function listPipelines() {
  return Object.entries(MEDIA_PIPELINES).map(([id, p]) => ({ id, name: p.name, steps: p.steps.length }));
}

module.exports = { MEDIA_PIPELINES, runPipeline, listPipelines };
