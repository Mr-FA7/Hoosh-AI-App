export type WebFsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  workspaceRoot?: boolean;
};

type DirNode = {
  dirs: Map<string, DirNode>;
  files: Map<string, string>;
};

type WebProject = {
  id: string;
  name: string;
  root: DirNode;
  updatedAt: string;
};

const projects = new Map<string, WebProject>();
let activeProjectId: string | null = null;

const STORAGE_KEY = 'fa7-web-projects-v1';

function emptyDir(): DirNode {
  return { dirs: new Map(), files: new Map() };
}

function splitPath(relPath: string): string[] {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
}

function getDir(root: DirNode, parts: string[], create = false): DirNode | null {
  let node = root;
  for (const part of parts) {
    let next = node.dirs.get(part);
    if (!next) {
      if (!create) return null;
      next = emptyDir();
      node.dirs.set(part, next);
    }
    node = next;
  }
  return node;
}

function persistRecent(project: WebProject) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      { id: project.id, name: project.name, lastOpened: project.updatedAt },
      ...list.filter((p: { id: string }) => p.id !== project.id),
    ].slice(0, 8);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function listRecentWebProjects(): Array<{ id: string; name: string; lastOpened: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isWebProjectRoot(root: string | null | undefined): boolean {
  return typeof root === 'string' && root.startsWith('web://');
}

export function getActiveWebProjectId(): string | null {
  return activeProjectId;
}

export function activateWebProject(root: string): boolean {
  if (!isWebProjectRoot(root)) return false;
  if (!projects.has(root)) return false;
  activeProjectId = root;
  return true;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function isLikelyTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  const blocked = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.zip', '.wasm', '.node', '.exe', '.dll', '.so', '.dylib', '.pdf'];
  if (blocked.some((ext) => lower.endsWith(ext))) return false;
  return true;
}

export async function importFolderFromFileList(fileList: FileList): Promise<string> {
  const root = emptyDir();
  let displayName = 'project';

  for (const file of Array.from(fileList)) {
    const rel = String((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || '').trim();
    if (!rel) continue;
    const parts = splitPath(rel);
    if (parts.length === 0) continue;
    displayName = parts[0];
    const innerParts = parts.slice(1);
    if (innerParts.length === 0) {
      if (isLikelyTextFile(file.name)) {
        const content = await readFileAsText(file);
        root.files.set(file.name, content);
      }
      continue;
    }
    const dirParts = innerParts.slice(0, -1);
    const fileName = innerParts[innerParts.length - 1];
    const dir = getDir(root, dirParts, true);
    if (!dir) continue;
    if (!isLikelyTextFile(fileName)) continue;
    const content = await readFileAsText(file);
    dir.files.set(fileName, content);
  }

  const id = `web://${displayName}-${Date.now()}`;
  const project: WebProject = {
    id,
    name: displayName,
    root,
    updatedAt: new Date().toISOString(),
  };
  projects.set(id, project);
  activeProjectId = id;
  persistRecent(project);
  return id;
}

function listDir(node: DirNode, prefix: string): WebFsEntry[] {
  const rows: WebFsEntry[] = [];
  for (const name of node.dirs.keys()) {
    rows.push({
      name,
      path: prefix ? `${prefix}/${name}` : name,
      isDirectory: true,
    });
  }
  for (const name of node.files.keys()) {
    rows.push({
      name,
      path: prefix ? `${prefix}/${name}` : name,
      isDirectory: false,
    });
  }
  return rows;
}

export function listWebFiles(relPath?: string): WebFsEntry[] {
  const project = activeProjectId ? projects.get(activeProjectId) : null;
  if (!project) return [];
  const parts = splitPath(relPath || '');
  if (parts.length === 0) return listDir(project.root, '');
  const dir = getDir(project.root, parts, false);
  if (!dir) return [];
  return listDir(dir, parts.join('/'));
}

export function readWebFile(relPath: string): string {
  const project = activeProjectId ? projects.get(activeProjectId) : null;
  if (!project) throw new Error('No web project open');
  const parts = splitPath(relPath);
  if (parts.length === 0) throw new Error('Missing path');
  const fileName = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const dir = dirParts.length ? getDir(project.root, dirParts, false) : project.root;
  if (!dir) throw new Error('Not found');
  const content = dir.files.get(fileName);
  if (content === undefined) throw new Error('Not found');
  return content;
}

export function writeWebFile(relPath: string, content: string): void {
  const project = activeProjectId ? projects.get(activeProjectId) : null;
  if (!project) throw new Error('No web project open');
  const parts = splitPath(relPath);
  if (parts.length === 0) throw new Error('Missing path');
  const fileName = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const dir = dirParts.length ? getDir(project.root, dirParts, true) : project.root;
  if (!dir) throw new Error('Invalid path');
  dir.files.set(fileName, content ?? '');
  project.updatedAt = new Date().toISOString();
}

export function getWebProjectMeta(root: string): { path: string; name: string } | null {
  const project = projects.get(root);
  if (!project) return null;
  return { path: project.id, name: project.name };
}
