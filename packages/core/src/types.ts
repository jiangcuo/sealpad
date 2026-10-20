export type SealKind = 'seal' | 'signature';

/**
 * 印章或签名素材。统一保存为带透明通道的 PNG，物理尺寸单独记录（毫米）。
 * 以后的印章设计器会额外保存矢量 SVG 源稿。
 */
export interface SealAsset {
  id: string;
  name: string;
  kind: SealKind;
  /** 盖到文档上的默认宽度（毫米） */
  widthMm: number;
  /** 盖到文档上的默认高度（毫米），按图片比例从宽度算出 */
  heightMm: number;
  png: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  createdAt: number;
  origin: 'import' | 'sample';
}

/**
 * 页面上的一个印章。坐标是「显示坐标」：页面按 /Rotate 旋转后看到的样子，
 * 原点在左上角，单位毫米。导出时再换算成 PDF 用户空间。
 */
export interface Placement {
  id: string;
  sealId: string;
  /** 从 0 开始的页码 */
  pageIndex: number;
  /** 印章中心点 */
  cxMm: number;
  cyMm: number;
  widthMm: number;
  heightMm: number;
  /** 顺时针旋转角度 */
  rotationDeg: number;
}

export type StraddleSide = 'left' | 'right';

/** 骑缝章设置 */
export interface StraddleOptions {
  enabled: boolean;
  sealId: string | null;
  side: StraddleSide;
  /** 起始页（从 1 开始） */
  fromPage: number;
  /** 结束页（从 1 开始），0 表示最后一页 */
  toPage: number;
  /** 双面打印：只在奇数页（每张纸的正面）盖 */
  oddPagesOnly: boolean;
  /** 跳过范围内的第一页（封面） */
  skipFirstPage: boolean;
  /** 印章中心的垂直位置，占页面高度的比例 0–1 */
  centerYRatio: number;
  /** 骑缝章整体宽度（毫米），高度按图片比例 */
  widthMm: number;
  /** 每枚印章最多覆盖的页数，0 表示不限；页数太多时每页只剩一条细线，可以分成几组各盖一枚 */
  maxPagesPerSeal: number;
}

export const DEFAULT_STRADDLE: StraddleOptions = {
  enabled: false,
  sealId: null,
  side: 'right',
  fromPage: 1,
  toPage: 0,
  oddPagesOnly: false,
  skipFirstPage: false,
  centerYRatio: 0.5,
  widthMm: 40,
  maxPagesPerSeal: 0,
};
