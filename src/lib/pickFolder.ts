/** Browser folder picker via hidden input (works on many mobile browsers). */

export function pickFolderFromBrowser(): Promise<FileList | null> {
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

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('change', () => {
      const files = input.files;
      cleanup();
      resolve(files && files.length > 0 ? files : null);
    });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}
