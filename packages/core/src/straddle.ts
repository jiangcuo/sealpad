import type { StraddleOptions, StraddleSide } from './types.ts';
import { clamp } from './units.ts';

/** 骑缝章在某一页上的切片 */
export interface StraddleSlice {
  pageIndex: number;
  /** 这一页用印章的第几条（从左往右数，从 0 开始） */
  sliceIndex: number;
  /** 这枚印章一共切成几条 */
  sliceCount: number;
  /** 第几组（页数太多时分组，每组盖一枚完整的章） */
  groupIndex: number;
}

/** 根据设置算出参与骑缝的页码（从 0 开始） */
export function straddlePages(pageCount: number, opts: StraddleOptions): number[] {
  if (pageCount <= 0) return [];
  const from = clamp(Math.floor(opts.fromPage) || 1, 1, pageCount);
  const to = opts.toPage > 0 ? clamp(Math.floor(opts.toPage), from, pageCount) : pageCount;
  let pages: number[] = [];
  for (let p = from; p <= to; p++) pages.push(p);
  if (opts.skipFirstPage) pages = pages.slice(1);
  if (opts.oddPagesOnly) pages = pages.filter((p) => p % 2 === 1);
  return pages.map((p) => p - 1);
}

/**
 * 把 n 页尽量平均地分成若干组，每组不超过 max 页。
 * 每组至少 2 页优先：两者冲突时（比如 7 页、每组最多 2 页），允许个别组多 1 页。
 */
export function splitGroups(n: number, maxPerGroup: number): number[] {
  if (n <= 0) return [];
  const max = maxPerGroup > 0 ? Math.max(2, Math.floor(maxPerGroup)) : n;
  const groups = Math.max(1, Math.min(Math.ceil(n / max), Math.floor(n / 2)));
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * 计算每页的切片。
 *
 * 纸张叠放、第 1 页在最上面。盖右侧骑缝章时，后面的页依次向右错开，
 * 所以第 1 页拿到印章最左边的一条；盖左侧时正好相反。
 */
export function planStraddle(pageCount: number, opts: StraddleOptions): StraddleSlice[] {
  const pages = straddlePages(pageCount, opts);
  if (pages.length < 2) return [];
  const sizes = splitGroups(pages.length, opts.maxPagesPerSeal);
  const result: StraddleSlice[] = [];
  let offset = 0;
  sizes.forEach((size, groupIndex) => {
    for (let k = 0; k < size; k++) {
      const pageIndex = pages[offset + k]!;
      const sliceIndex = opts.side === 'right' ? k : size - 1 - k;
      result.push({ pageIndex, sliceIndex, sliceCount: size, groupIndex });
    }
    offset += size;
  });
  return result;
}

/** 第 index 条切片在原图中的像素范围 [x0, x1) */
export function sliceBoundsPx(pixelWidth: number, count: number, index: number): { x0: number; x1: number } {
  const x0 = Math.round((index * pixelWidth) / count);
  const x1 = Math.round(((index + 1) * pixelWidth) / count);
  return { x0, x1: Math.max(x1, x0 + 1) };
}

/** 切片在页面上的位置（显示坐标，毫米，中心点 + 尺寸） */
export function straddleSliceRect(params: {
  slice: StraddleSlice;
  side: StraddleSide;
  pageWidthMm: number;
  pageHeightMm: number;
  sealWidthMm: number;
  sealHeightMm: number;
  pixelWidth: number;
  centerYRatio: number;
}): { cxMm: number; cyMm: number; widthMm: number; heightMm: number; x0: number; x1: number } {
  const { slice, side, pageWidthMm, pageHeightMm, sealWidthMm, sealHeightMm, pixelWidth } = params;
  const { x0, x1 } = sliceBoundsPx(pixelWidth, slice.sliceCount, slice.sliceIndex);
  const widthMm = (sealWidthMm * (x1 - x0)) / pixelWidth;
  const cxMm = side === 'right' ? pageWidthMm - widthMm / 2 : widthMm / 2;
  const half = sealHeightMm / 2;
  const cyMm = clamp(params.centerYRatio * pageHeightMm, half, pageHeightMm - half);
  return { cxMm, cyMm, widthMm, heightMm: sealHeightMm, x0, x1 };
}
