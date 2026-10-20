import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStraddle, sliceBoundsPx, splitGroups, straddlePages, straddleSliceRect } from '../src/straddle.ts';
import { DEFAULT_STRADDLE, type StraddleOptions } from '../src/types.ts';

const opts = (o: Partial<StraddleOptions>): StraddleOptions => ({ ...DEFAULT_STRADDLE, enabled: true, sealId: 's', ...o });

test('页码范围、跳过首页、只盖奇数页', () => {
  assert.deepEqual(straddlePages(6, opts({})), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(straddlePages(6, opts({ fromPage: 2, toPage: 4 })), [1, 2, 3]);
  assert.deepEqual(straddlePages(6, opts({ skipFirstPage: true })), [1, 2, 3, 4, 5]);
  assert.deepEqual(straddlePages(6, opts({ oddPagesOnly: true })), [0, 2, 4]);
  assert.deepEqual(straddlePages(6, opts({ toPage: 99 })), [0, 1, 2, 3, 4, 5]);
});

test('分组尽量平均，每组至少 2 页', () => {
  assert.deepEqual(splitGroups(10, 0), [10]);
  assert.deepEqual(splitGroups(10, 4), [4, 3, 3]);
  assert.deepEqual(splitGroups(5, 4), [3, 2]);
  assert.deepEqual(splitGroups(7, 2), [3, 2, 2]);
  assert.deepEqual(splitGroups(7, 1), [3, 2, 2]);
  for (let n = 2; n < 40; n++) {
    for (const max of [0, 2, 3, 5, 10]) {
      const g = splitGroups(n, max);
      assert.equal(g.reduce((a, b) => a + b, 0), n);
      assert.ok(g.every((s) => s >= 2), `n=${n} max=${max} → ${g}`);
    }
  }
});

test('右侧骑缝：第 1 页拿最左边一条', () => {
  const plan = planStraddle(3, opts({ side: 'right' }));
  assert.deepEqual(plan.map((s) => [s.pageIndex, s.sliceIndex, s.sliceCount]), [
    [0, 0, 3],
    [1, 1, 3],
    [2, 2, 3],
  ]);
});

test('左侧骑缝：第 1 页拿最右边一条', () => {
  const plan = planStraddle(3, opts({ side: 'left' }));
  assert.deepEqual(plan.map((s) => s.sliceIndex), [2, 1, 0]);
});

test('少于 2 页不盖骑缝章', () => {
  assert.equal(planStraddle(1, opts({})).length, 0);
  assert.equal(planStraddle(4, opts({ fromPage: 4 })).length, 0);
});

test('切片像素范围首尾相接、覆盖整张图', () => {
  const w = 401;
  let prev = 0;
  for (let i = 0; i < 7; i++) {
    const { x0, x1 } = sliceBoundsPx(w, 7, i);
    assert.equal(x0, prev);
    prev = x1;
  }
  assert.equal(prev, w);
});

test('切片贴着页面边缘', () => {
  const plan = planStraddle(4, opts({}));
  const base = { side: 'right' as const, pageWidthMm: 210, pageHeightMm: 297, sealWidthMm: 40, sealHeightMm: 40, pixelWidth: 400, centerYRatio: 0.5 };
  const r = straddleSliceRect({ ...base, slice: plan[0]! });
  assert.equal(r.widthMm, 10);
  assert.equal(r.cxMm + r.widthMm / 2, 210);
  assert.equal(r.cyMm, 148.5);
  const l = straddleSliceRect({ ...base, side: 'left', slice: plan[0]! });
  assert.equal(l.cxMm - l.widthMm / 2, 0);
  // 垂直位置被限制在页面内
  const top = straddleSliceRect({ ...base, centerYRatio: 0, slice: plan[0]! });
  assert.equal(top.cyMm, 20);
});
