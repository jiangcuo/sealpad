import {
  cropImage,
  planStraddle,
  ptToMm,
  straddleSliceRect,
  type Placement,
  type SealAsset,
  type StampDraw,
  type StraddleOptions,
} from '@sealpad/core';
import { pngToRgba, rgbaToPng } from './image.ts';
import type { PageSize } from './pdf.ts';

export interface StraddlePiece {
  pageIndex: number;
  sliceIndex: number;
  sliceCount: number;
  cxMm: number;
  cyMm: number;
  widthMm: number;
  heightMm: number;
  /** 切片在原图中的像素范围 */
  x0: number;
  x1: number;
}

export interface StraddleLayout {
  seal: SealAsset;
  sealWidthMm: number;
  sealHeightMm: number;
  pieces: StraddlePiece[];
  pageCount: number;
  /** 最窄的一条有多宽（毫米） */
  minSliceMm: number;
}

export function pageSizeMm(p: PageSize) {
  return { widthMm: ptToMm(p.widthPt), heightMm: ptToMm(p.heightPt) };
}

export function computeStraddle(
  pages: PageSize[],
  opts: StraddleOptions,
  seals: Map<string, SealAsset>,
): StraddleLayout | null {
  if (!opts.enabled || !opts.sealId) return null;
  const seal = seals.get(opts.sealId);
  if (!seal) return null;
  const sealWidthMm = opts.widthMm > 0 ? opts.widthMm : seal.widthMm;
  const sealHeightMm = (sealWidthMm * seal.pixelHeight) / seal.pixelWidth;
  const plan = planStraddle(pages.length, opts);
  const pieces = plan.map((slice) => {
    const { widthMm, heightMm } = pageSizeMm(pages[slice.pageIndex]!);
    const r = straddleSliceRect({
      slice,
      side: opts.side,
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
      sealWidthMm,
      sealHeightMm,
      pixelWidth: seal.pixelWidth,
      centerYRatio: opts.centerYRatio,
    });
    return { pageIndex: slice.pageIndex, sliceIndex: slice.sliceIndex, sliceCount: slice.sliceCount, ...r };
  });
  const minSliceMm = pieces.reduce((m, p) => Math.min(m, p.widthMm), Number.POSITIVE_INFINITY);
  return { seal, sealWidthMm, sealHeightMm, pieces, pageCount: new Set(pieces.map((p) => p.pageIndex)).size, minSliceMm };
}

/** 汇总普通印章和骑缝章切片，生成导出用的绘制列表 */
export async function buildDraws(
  placements: Placement[],
  straddle: StraddleLayout | null,
  seals: Map<string, SealAsset>,
): Promise<StampDraw[]> {
  const draws: StampDraw[] = [];
  for (const p of placements) {
    const seal = seals.get(p.sealId);
    if (!seal) continue;
    draws.push({
      pageIndex: p.pageIndex,
      image: { key: seal.id, png: seal.png },
      cxMm: p.cxMm,
      cyMm: p.cyMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      rotationDeg: p.rotationDeg,
    });
  }
  if (straddle && straddle.pieces.length > 0) {
    // 真正把图片切开，而不是用裁剪路径遮住：每页只包含自己那一条，无法从单页里提取出完整印章
    const full = await pngToRgba(straddle.seal.png);
    const cache = new Map<string, Uint8Array>();
    for (const piece of straddle.pieces) {
      const key = `${straddle.seal.id}:${piece.sliceCount}:${piece.sliceIndex}`;
      let png = cache.get(key);
      if (!png) {
        png = await rgbaToPng(cropImage(full, { x: piece.x0, y: 0, width: piece.x1 - piece.x0, height: full.height }));
        cache.set(key, png);
      }
      draws.push({
        pageIndex: piece.pageIndex,
        image: { key, png },
        cxMm: piece.cxMm,
        cyMm: piece.cyMm,
        widthMm: piece.widthMm,
        heightMm: piece.heightMm,
        rotationDeg: 0,
      });
    }
  }
  return draws;
}
