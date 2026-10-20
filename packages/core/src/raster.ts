/**
 * 纯 RGBA 像素处理，不依赖 Canvas，浏览器和 Node 都能用。
 * 解码、编码 PNG 由调用方负责（浏览器里用 Canvas）。
 */

export interface RgbaImage {
  width: number;
  height: number;
  /** 长度为 width * height * 4，非预乘 alpha */
  data: Uint8ClampedArray;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundRemovalOptions {
  /** 「墨色深度」低于这个值的像素视为纸张，完全透明。0–255，默认 40 */
  paperThreshold?: number;
  /** 「墨色深度」高于这个值的像素完全不透明。默认 paperThreshold + 70 */
  inkThreshold?: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 去掉白色或浅色纸张背景，只保留墨迹，适用于拍照或扫描的签名、印章。
 *
 * 「墨色深度」取 255 - min(r, g, b)：纸张三个通道都高，
 * 红色印泥和黑色笔迹至少有一个通道很低，所以都能保留下来。
 * 半透明的边缘按「墨色与白纸混合」反推出原本的墨色，避免出现白边。
 */
export function removeWhiteBackground(img: RgbaImage, opts: BackgroundRemovalOptions = {}): RgbaImage {
  const low = opts.paperThreshold ?? 40;
  const high = opts.inkThreshold ?? low + 70;
  const src = img.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]!;
    const g = src[i + 1]!;
    const b = src[i + 2]!;
    const a = src[i + 3]!;
    const ink = 255 - Math.min(r, g, b);
    const k = smoothstep(low, high, ink);
    if (k <= 0 || a === 0) {
      out[i + 3] = 0;
      continue;
    }
    // 观察到的颜色 = k·墨色 + (1-k)·白色  →  墨色 = (颜色 - (1-k)·255) / k
    const unmix = (c: number) => (c - (1 - k) * 255) / k;
    out[i] = unmix(r);
    out[i + 1] = unmix(g);
    out[i + 2] = unmix(b);
    out[i + 3] = a * k;
  }
  return { width: img.width, height: img.height, data: out };
}

/** 不透明像素的包围盒；全透明时返回 null */
export function opaqueBounds(img: RgbaImage, alphaThreshold = 8, padding = 0): PixelRect | null {
  const { width, height, data } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3]! > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + padding) - x,
    height: Math.min(height, maxY + 1 + padding) - y,
  };
}

export function cropImage(img: RgbaImage, rect: PixelRect): RgbaImage {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.min(img.width - x, Math.floor(rect.width)));
  const h = Math.max(1, Math.min(img.height - y, Math.floor(rect.height)));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(start, start + w * 4), row * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** 是否含有半透明或透明像素（用来判断导入的图片要不要默认去底） */
export function hasTransparency(img: RgbaImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i]! < 250) return true;
  }
  return false;
}
