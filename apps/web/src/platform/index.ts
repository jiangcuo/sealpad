import type { Platform } from './types.ts';
import { createWebPlatform } from './web.ts';

export * from './types.ts';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 在 Tauri 里运行时使用原生对话框和文件读写，否则使用浏览器实现 */
export async function createPlatform(): Promise<Platform> {
  if (isTauri()) {
    const { createTauriPlatform } = await import('./tauri.ts');
    return createTauriPlatform();
  }
  return createWebPlatform();
}
