import { IMAGE_EXTENSIONS, PDF_EXTENSIONS, type OpenedFile, type Platform } from './types.ts';

function pickFile(extensions: string[]): Promise<OpenedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.map((e) => `.${e}`).join(',');
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      } catch (err) {
        reject(new Error(`无法读取文件「${file.name}」：${(err as Error).message}`));
      }
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.append(input);
    input.click();
  });
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<{
    name: string;
    createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }>;
  }>;
}

async function saveFile(suggestedName: string, bytes: Uint8Array): Promise<string | null> {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const w = window as Window & SaveFilePickerWindow;
  // Chrome / Edge 支持选择保存位置
  if (w.showSaveFilePicker && window.self === window.top) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      // 其他错误（例如权限策略）退回到下载
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return `下载目录 / ${suggestedName}`;
}

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    openPdf: () => pickFile(PDF_EXTENSIONS),
    openImage: () => pickFile(IMAGE_EXTENSIONS),
    saveFile,
  };
}
