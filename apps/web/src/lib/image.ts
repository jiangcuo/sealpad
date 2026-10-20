import type { RgbaImage } from '@sealpad/core';
import { extensionOf, mimeOf, type OpenedFile } from '../platform/index.ts';

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('浏览器不支持 Canvas 2D');
  return ctx;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法识别这张图片'));
    img.src = url;
  });
}

function drawToRgba(source: CanvasImageSource, srcW: number, srcH: number, maxSide: number): RgbaImage {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { width: w, height: h, data };
}

/** 解码 SVG 字符串为位图，宽度 widthPx，高度按 SVG 比例 */
export async function svgToRgba(svg: string, widthPx: number): Promise<RgbaImage> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImageElement(url);
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : 1;
    const h = Math.round(widthPx * ratio);
    const canvas = createCanvas(widthPx, h);
    context2d(canvas).drawImage(img, 0, 0, widthPx, h);
    return { width: widthPx, height: h, data: context2d(canvas).getImageData(0, 0, widthPx, h).data };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 解码导入的图片文件；过大的图片缩小到最长边 maxSide 像素 */
export async function decodeImageFile(file: OpenedFile, maxSide = 1600): Promise<RgbaImage> {
  if (extensionOf(file.name) === 'svg') {
    const text = new TextDecoder().decode(file.bytes);
    return svgToRgba(text, maxSide);
  }
  const blob = new Blob([file.bytes as BlobPart], { type: mimeOf(file.name) });
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const out = drawToRgba(bitmap, bitmap.width, bitmap.height, maxSide);
      bitmap.close();
      return out;
    } catch {
      // 部分格式 createImageBitmap 不支持，退回 <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(url);
    return drawToRgba(img, img.naturalWidth, img.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pngToRgba(png: Uint8Array): Promise<RgbaImage> {
  return decodeImageFile({ name: 'image.png', bytes: png }, Number.MAX_SAFE_INTEGER);
}

export function rgbaToCanvas(img: RgbaImage, canvas: HTMLCanvasElement = createCanvas(img.width, img.height)): HTMLCanvasElement {
  canvas.width = img.width;
  canvas.height = img.height;
  context2d(canvas).putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

export function rgbaToPng(img: RgbaImage): Promise<Uint8Array> {
  const canvas = rgbaToCanvas(img);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('PNG 编码失败'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}
