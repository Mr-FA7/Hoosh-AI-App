import axios from 'axios';
import { companionGet, companionPost } from './companionHttp';
import { getRuntimeEnv } from './companionProbe';
import { isWebProjectRoot, activateWebProject, listWebFiles, readWebFile, writeWebFile } from './webWorkspace';

async function shouldUseWebWorkspace(projectRoot?: string | null): Promise<boolean> {
  if (projectRoot && isWebProjectRoot(projectRoot)) return true;
  const env = await getRuntimeEnv();
  return env.usesWebWorkspace && !env.usesCompanionApi;
}

export async function switchProject(path: string): Promise<void> {
  if (isWebProjectRoot(path)) {
    if (!activateWebProject(path)) {
      throw new Error('Web project is no longer available in this session. Please pick the folder again.');
    }
    return;
  }
  if (!(await shouldUseWebWorkspace(path))) {
    await companionPost('/api/v3/project/switch', { path });
  }
}

export async function fetchProjectFiles(path?: string, projectRoot?: string | null): Promise<any[]> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    return listWebFiles(path);
  }
  const env = await getRuntimeEnv();
  if (env.usesWebWorkspace && !env.usesCompanionApi) {
    return listWebFiles(path);
  }
  const res = await companionGet('/api/files', {
    params: path ? { path } : { _: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchFileContent(path: string, projectRoot?: string | null): Promise<string> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    return readWebFile(path);
  }
  const env = await getRuntimeEnv();
  if (env.usesWebWorkspace && !env.usesCompanionApi) {
    return readWebFile(path);
  }
  const res = await companionGet<{ content?: string }>('/api/file', { params: { path } });
  return String(res.data?.content ?? '');
}

export async function saveFileContent(path: string, content: string, projectRoot?: string | null): Promise<void> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    writeWebFile(path, content);
    return;
  }
  const env = await getRuntimeEnv();
  if (env.usesWebWorkspace && !env.usesCompanionApi) {
    writeWebFile(path, content);
    return;
  }
  await companionPost('/api/file', { path, content });
}
