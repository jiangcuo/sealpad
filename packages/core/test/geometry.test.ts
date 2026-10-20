import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMatrix, normalizeRotation, rotatedHalfExtents, stampMatrix, visualSize, visualToPdfMatrix } from '../src/geometry.ts';
import { mmToPt, ptToMm } from '../src/units.ts';
import { near } from './helpers.ts';

const box = { x: 10, y: 20, width: 600, height: 400 };

test('毫米与 pt 互换', () => {
  assert.ok(near(mmToPt(25.4), 72));
  assert.ok(near(ptToMm(mmToPt(42)), 42));
});

test('旋转角度归一化', () => {
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(0), 0);
});

test('旋转 90/270 度时显示尺寸宽高互换', () => {
  assert.deepEqual(visualSize(box, 0), { width: 600, height: 400 });
  assert.deepEqual(visualSize(box, 90), { width: 400, height: 600 });
  assert.deepEqual(visualSize(box, 270), { width: 400, height: 600 });
});

test('显示坐标的四个角对应 CropBox 的正确角', () => {
  const x0 = 10, y0 = 20, x1 = 610, y1 = 420;
  // [旋转, 显示左上角对应的 PDF 点, 显示右上角对应的 PDF 点]
  const cases: Array<[number, [number, number], [number, number]]> = [
    [0, [x0, y1], [x1, y1]],
    [90, [x0, y0], [x0, y1]],
    [180, [x1, y0], [x0, y0]],
    [270, [x1, y1], [x1, y0]],
  ];
  for (const [rot, tl, tr] of cases) {
    const m = visualToPdfMatrix(box, rot);
    const size = visualSize(box, rot);
    const p = applyMatrix(m, 0, 0);
    const q = applyMatrix(m, size.width, 0);
    assert.deepEqual([p.x, p.y], tl, `rotation ${rot} top-left`);
    assert.deepEqual([q.x, q.y], tr, `rotation ${rot} top-right`);
  }
});

test('印章矩阵：未旋转页面上图片顶边朝上', () => {
  const m = stampMatrix({ cx: 100, cy: 50, width: 40, height: 20, rotationDeg: 0 }, box, 0);
  // 单位正方形 (0,1) 是图片左上角，应落在显示坐标 (80, 40)，即 PDF (90, 380)
  const tl = applyMatrix(m, 0, 1);
  assert.ok(near(tl.x, 90) && near(tl.y, 380));
  const br = applyMatrix(m, 1, 0);
  assert.ok(near(br.x, 130) && near(br.y, 360));
});

test('旋转 90 度后外接框', () => {
  const e = rotatedHalfExtents(40, 20, 90);
  assert.ok(near(e.hx, 10) && near(e.hy, 20));
});
