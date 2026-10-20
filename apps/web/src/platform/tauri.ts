import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { IMAGE_EXTENSIONS, PDF_EXTENSIONS, type OpenedFile, type Platform } from './types.ts';

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

async function pick(name: string, extensions: string[]): Promise<OpenedFile | null> {
  const path = await open({ multiple: false, directory: false, filters: [{ name, extensions }] });
  if (typeof path !== 'string') return null;
  return { name: baseName(path), bytes: await readFile(path) };
}

export function createTauriPlatform(): Platform {
  return {
    kind: 'desktop',
    openPdf: () => pick('PDF', PDF_EXTENSIONS),
    openImage: () => pick('图片', IMAGE_EXTENSIONS),
    async saveFile(suggestedName, bytes) {
      const path = await save({ defaultPath: suggestedName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!path) return null;
      await writeFile(path, bytes);
      return path;
    },
  };
}
