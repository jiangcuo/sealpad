import { useMemo, useRef } from 'react';
import type { SignatureAsset } from '@sealpad/core';

/** 为每个印章维护一个 blob URL，印章删除时释放 */
export function useAssetUrls(seals: SignatureAsset[]): Map<string, string> {
  const cache = useRef(new Map<string, { png: Uint8Array; url: string }>());
  const urls = useMemo(() => {
    const next = new Map<string, string>();
    for (const s of seals) {
      let entry = cache.current.get(s.id);
      if (!entry || entry.png !== s.png) {
        if (entry) URL.revokeObjectURL(entry.url);
        entry = { png: s.png, url: URL.createObjectURL(new Blob([s.png as BlobPart], { type: 'image/png' })) };
        cache.current.set(s.id, entry);
      }
      next.set(s.id, entry.url);
    }
    for (const [id, entry] of cache.current) {
      if (!next.has(id)) {
        URL.revokeObjectURL(entry.url);
        cache.current.delete(id);
      }
    }
    return next;
  }, [seals]);
  // 不在卸载时统一释放：React 严格模式会模拟卸载再挂载，提前释放会让缩略图失效。
  // 这个 hook 只在根组件里用一次，应用关闭时浏览器会自动回收。
  return urls;
}

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // 隐私模式下可能不可用，忽略
  }
}

/** 键盘事件是否来自输入框，此时不处理快捷键 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
