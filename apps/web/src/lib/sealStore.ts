import type { SealAsset } from '@sealpad/core';

/**
 * 印章库存储。网页版和桌面版目前都用 IndexedDB（Tauri 的 WebView 会把它保存在应用数据目录）。
 * 路线图第四阶段会在桌面版改成加密文件 + 使用前输入 PIN。
 */
export interface SealStore {
  readonly persistent: boolean;
  list(): Promise<SealAsset[]>;
  put(seal: SealAsset): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'sealpad';
const STORE = 'seals';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function createIndexedDbStore(db: IDBDatabase): SealStore {
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    persistent: true,
    async list() {
      const all = (await request(tx('readonly').getAll())) as SealAsset[];
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(seal) {
      await request(tx('readwrite').put(seal));
    },
    async remove(id) {
      await request(tx('readwrite').delete(id));
    },
  };
}

function createMemoryStore(): SealStore {
  const map = new Map<string, SealAsset>();
  return {
    persistent: false,
    async list() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(seal) {
      map.set(seal.id, seal);
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

/** 浏览器禁用 IndexedDB（如部分隐私模式）时退回内存存储，关闭页面后丢失 */
export async function createSealStore(): Promise<SealStore> {
  try {
    if (!('indexedDB' in window)) return createMemoryStore();
    return createIndexedDbStore(await openDb());
  } catch {
    return createMemoryStore();
  }
}
