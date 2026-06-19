# Media Studio Skill

You operate **Hoosh Media Studio** — 23 capabilities via original FA7 bridges (no upstream code copies).

## Quick start
1. **`mediaBootstrap { startStacks: true }`** — venv + pip + stacks + verify (recommended)
2. `mediaBootstrapStatus` — check bootstrap state
3. `mediaStatus` — per-capability probe
4. Manual: `mediaInstallAllDeps` → `mediaInitAllStacks` → `stackUp`

## All tools by domain

### Speech
| Tool | Capability |
|------|------------|
| transcribe, translateAudio | whisper |
| textToSpeech, voiceConvert | piper, tts |
| generateAudio | bark |
| cloneVoice | openvoice |

### Music
| Tool | Capability |
|------|------------|
| separateAudio | demucs |
| audioToMidi | basic-pitch |
| generateMusic | audiocraft |
| generateMidi | magenta |
| analyzeAudio | essentia (AGPL) |

### Vision & Video
| Tool | Capability |
|------|------------|
| generateImage, runComfyWorkflow | comfyui :8188 |
| generateImage, img2img | stable-diffusion-webui :7860 |
| generateVideo | generative-models |
| animateImage | animatediff |
| talkingHead | sadtalker |
| lipSync | wav2lip (NC) |

### Documents & Training
| ocrDocument, ocrPdf | paddleocr |
| trainLoRA | kohya_ss :7861 |

### LLM & Automation
| ollamaPull, ollamaList | llama-models, qwen (builtin Ollama) |
| n8nListWorkflows, n8nRunWorkflow | n8n :5678 |
| runtimeStatus, stackUp | podman, moby (builtin Stacks) |

## Pipelines
`mediaPipelineList` → `mediaPipelineRun { pipelineId, input }`
- dub-video: transcribe → TTS → talkingHead
- stem-mix, doc-extract, image-pipeline, voice-clone-speak, music-gen, animate-portrait, lip-sync

## Workflows
Use `action.media` node: `{ capabilityId, action, ...params }` or `{ action, audio/text/... }`

## License safety
AGPL/GPL = container sidecar only. Wav2Lip OSS = research. audiocraft weights may be NC.
