import axios from 'axios';
import { API_BASE, expectsCompanionBackend } from '../apiBase';
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
    await axios.post(`${API_BASE}/v3/project/switch`, { path });
  }
}

export async function fetchProjectFiles(path?: string, projectRoot?: string | null): Promise<any[]> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    return listWebFiles(path);
  }
  if (!expectsCompanionBackend()) {
    return listWebFiles(path);
  }
  const res = await axios.get(`${API_BASE}/files`, {
    params: path ? { path } : { _: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchFileContent(path: string, projectRoot?: string | null): Promise<string> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    return readWebFile(path);
  }
  if (!expectsCompanionBackend()) {
    return readWebFile(path);
  }
  const res = await axios.get(`${API_BASE}/file`, { params: { path } });
  return String(res.data?.content ?? '');
}

export async function saveFileContent(path: string, content: string, projectRoot?: string | null): Promise<void> {
  if (projectRoot && isWebProjectRoot(projectRoot)) {
    writeWebFile(path, content);
    return;
  }
  if (!expectsCompanionBackend()) {
    writeWebFile(path, content);
    return;
  }
  await axios.post(`${API_BASE}/file`, { path, content });
}
