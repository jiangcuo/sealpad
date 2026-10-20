import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropImage, hasTransparency, opaqueBounds, removeWhiteBackground, type RgbaImage } from '../src/raster.ts';

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { width, height, data };
}

const px = (img: RgbaImage, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

test('白纸变透明，红色印泥和黑色笔迹保留', () => {
  const src = image(3, 1, (x) => (x === 0 ? [245, 243, 238, 255] : x === 1 ? [200, 30, 30, 255] : [20, 20, 20, 255]));
  const out = removeWhiteBackground(src);
  assert.equal(px(out, 0, 0)[3], 0);
  assert.deepEqual(px(out, 1, 0), [200, 30, 30, 255]);
  assert.deepEqual(px(out, 2, 0), [20, 20, 20, 255]);
});

test('边缘的浅色像素变成半透明的原墨色，而不是灰白色', () => {
  // 红墨 (200,30,30) 与白纸各占一半混合后的颜色
  const src = image(1, 1, () => [228, 143, 143, 255]);
  const out = removeWhiteBackground(src, { paperThreshold: 40, inkThreshold: 200 });
  const [r, g, b, a] = px(out, 0, 0) as [number, number, number, number];
  assert.ok(a > 0 && a < 255);
  assert.ok(r > g + 30 && g === b, `应偏红：${[r, g, b]}`);
});

test('包围盒与裁剪', () => {
  const src = image(10, 8, (x, y) => (x >= 2 && x <= 5 && y >= 3 && y <= 6 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
  const box = opaqueBounds(src);
  assert.deepEqual(box, { x: 2, y: 3, width: 4, height: 4 });
  const cropped = cropImage(src, box!);
  assert.equal(cropped.width, 4);
  assert.equal(cropped.height, 4);
  assert.ok(!hasTransparency(cropped));
  assert.ok(hasTransparency(src));
  assert.equal(opaqueBounds(image(2, 2, () => [0, 0, 0, 0])), null);
  assert.deepEqual(opaqueBounds(src, 8, 1), { x: 1, y: 2, width: 6, height: 6 });
});
