/**
 * 坐标变换。
 *
 * 界面里的坐标是「显示坐标」：页面按 /Rotate 顺时针旋转后呈现给用户的样子，
 * 原点在左上角，y 轴向下，单位 pt。PDF 用户空间原点在左下角，y 轴向上，
 * 并且显示区域由 CropBox 决定（可能不从 0 开始）。
 *
 * 矩阵采用 PDF 的 [a b c d e f] 约定：
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 */

export type Matrix = [number, number, number, number, number, number];

export type PageRotation = 0 | 90 | 180 | 270;

/** PDF 用户空间中的页面可见区域（CropBox），单位 pt */
export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 显示坐标中的矩形（中心点 + 尺寸 + 顺时针旋转），单位 pt */
export interface VisualRect {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotationDeg: number;
}

export function normalizeRotation(deg: number): PageRotation {
  const r = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return r as PageRotation;
}

/** 页面旋转后的显示尺寸 */
export function visualSize(box: PageBox, rotation: number): { width: number; height: number } {
  const r = normalizeRotation(rotation);
  return r === 90 || r === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

/** 显示坐标 → PDF 用户空间 */
export function visualToPdfMatrix(box: PageBox, rotation: number): Matrix {
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.width;
  const y1 = box.y + box.height;
  switch (normalizeRotation(rotation)) {
    case 0:
      return [1, 0, 0, -1, x0, y1];
    case 90:
      return [0, 1, 1, 0, x0, y0];
    case 180:
      return [-1, 0, 0, 1, x1, y0];
    case 270:
      return [0, -1, -1, 0, x1, y1];
  }
}

export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/**
 * 计算把图片画到页面上所需的 cm 矩阵。
 * PDF 图片绘制在单位正方形里：u 向右，v 向上，v=1 是图片顶边。
 */
export function stampMatrix(rect: VisualRect, box: PageBox, rotation: number): Matrix {
  const theta = (rect.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const toVisual = (u: number, v: number) => {
    const dx = (u - 0.5) * rect.width;
    const dy = (0.5 - v) * rect.height;
    return { x: rect.cx + cos * dx - sin * dy, y: rect.cy + sin * dx + cos * dy };
  };
  const toPdf = visualToPdfMatrix(box, rotation);
  const map = (u: number, v: number) => {
    const p = toVisual(u, v);
    return applyMatrix(toPdf, p.x, p.y);
  };
  const p00 = map(0, 0);
  const p10 = map(1, 0);
  const p01 = map(0, 1);
  return [p10.x - p00.x, p10.y - p00.y, p01.x - p00.x, p01.y - p00.y, p00.x, p00.y];
}

/** 旋转后矩形的外接框半宽、半高，用于把印章限制在页面内 */
export function rotatedHalfExtents(width: number, height: number, rotationDeg: number) {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { hx: (width * c + height * s) / 2, hy: (width * s + height * c) / 2 };
}
