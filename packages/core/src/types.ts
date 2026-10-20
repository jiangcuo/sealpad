import type { PatternDesign } from './pattern/types.ts';

/** 签名的来源：导入的图片、手写签名、签名图案设计器 */
export type SignatureSource = 'image' | 'handwriting' | 'pattern';

/**
 * 签名库里的一项。统一保存为带透明通道的 PNG，物理尺寸单独记录（毫米）。
 * 签名图案额外保存设计参数，可以再次编辑。
 */
export interface SignatureAsset {
  id: string;
  name: string;
  source: SignatureSource;
  /** 放到文档上的默认宽度（毫米） */
  widthMm: number;
  /** 放到文档上的默认高度（毫米），按图片比例从宽度算出 */
  heightMm: number;
  png: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  createdAt: number;
  /** 签名图案的设计参数 */
  design?: PatternDesign;
}

/**
 * 页面上放置的一个签名。坐标是「显示坐标」：页面按 /Rotate 旋转后看到的样子，
 * 原点在左上角，单位毫米。导出时再换算成 PDF 用户空间。
 */
export interface Placement {
  id: string;
  assetId: string;
  /** 从 0 开始的页码 */
  pageIndex: number;
  /** 中心点 */
  cxMm: number;
  cyMm: number;
  widthMm: number;
  heightMm: number;
  /** 顺时针旋转角度 */
  rotationDeg: number;
}

export type StraddleSide = 'left' | 'right';

/** 骑缝签名设置 */
export interface StraddleOptions {
  enabled: boolean;
  assetId: string | null;
  side: StraddleSide;
  /** 起始页（从 1 开始） */
  fromPage: number;
  /** 结束页（从 1 开始），0 表示最后一页 */
  toPage: number;
  /** 双面打印：只在奇数页（每张纸的正面）放置 */
  oddPagesOnly: boolean;
  /** 跳过范围内的第一页（封面） */
  skipFirstPage: boolean;
  /** 中心的垂直位置，占页面高度的比例 0–1 */
  centerYRatio: number;
  /** 整体宽度（毫米），高度按图片比例 */
  widthMm: number;
  /** 每个签名最多覆盖的页数，0 表示不限；页数太多时每页只剩一条细线，可以分成几组 */
  maxPagesPerSeal: number;
}

export const DEFAULT_STRADDLE: StraddleOptions = {
  enabled: false,
  assetId: null,
  side: 'right',
  fromPage: 1,
  toPage: 0,
  oddPagesOnly: false,
  skipFirstPage: false,
  centerYRatio: 0.5,
  widthMm: 40,
  maxPagesPerSeal: 0,
};

export function createId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
