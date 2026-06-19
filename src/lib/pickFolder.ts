/** Browser folder picker — File System Access API or webkitdirectory fallback. */

function filesToFileList(files: File[]): FileList | null {
  if (files.length === 0) return null;
  if (typeof DataTransfer !== 'undefined') {
    const dt = new DataTransfer();
    for (const file of files) dt.items.add(file);
    return dt.files;
  }
  const bag = files as File[] & { item(index: number): File | null; length: number };
  bag.item = (index: number) => files[index] ?? null;
  return bag as FileList;
}

async function collectFilesFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  rootName: string,
  prefix = ''
): Promise<File[]> {
  const out: File[] = [];
  for await (const [name, entry] of handle.entries()) {
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'directory') {
      out.push(...await collectFilesFromDirectoryHandle(entry, rootName, relPath));
      continue;
    }
    const file = await entry.getFile();
    const patched = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
    Object.defineProperty(patched, 'webkitRelativePath', {
      value: `${rootName}/${relPath}`,
      configurable: true,
    });
    out.push(patched);
  }
  return out;
}

async function pickWithDirectoryPicker(): Promise<FileList | null> {
  const picker = typeof window !== 'undefined'
    ? (window as Window & { showDirectoryPicker?: (opts: { mode: 'read' }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
    : undefined;
  if (!picker) return null;
  try {
    const handle = await picker({ mode: 'read' });
    return filesToFileList(await collectFilesFromDirectoryHandle(handle, handle.name));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    console.warn('[pickFolder] showDirectoryPicker failed', err);
    return null;
  }
}

function pickWithHiddenInput(): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    try {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    } catch {
      /* ignore */
    }

    let settled = false;
    const finish = (files: FileList | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };

    input.addEventListener('change', () => {
      const files = input.files;
      finish(files && files.length > 0 ? files : null);
    });

    input.addEventListener('cancel', () => finish(null));

    document.body.appendChild(input);
    input.click();

    window.setTimeout(() => finish(null), 120_000);
  });
}

export async function pickFolderFromBrowser(): Promise<FileList | null> {
  const fromPicker = await pickWithDirectoryPicker();
  if (fromPicker && fromPicker.length > 0) return fromPicker;
  return pickWithHiddenInput();
}
