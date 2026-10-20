/**
 * 端到端校验导出坐标：用 pdf-lib 生成各种旋转、CropBox 偏移的页面，盖章后
 * 再用 pdf.js（和界面预览用的是同一个库）读回，计算图片在「显示坐标」里的位置，
 * 和盖章时给出的位置比对。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, concatTransformationMatrix, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EncryptedPdfError, inspectPdf, stampPdf, type StampDraw } from '../src/export.ts';
import { mmToPt } from '../src/units.ts';
import { makePng } from './helpers.ts';

type M = [number, number, number, number, number, number];
const compose = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m: M, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;

/** 返回每次绘制图片时，单位正方形四个角在显示坐标（pt）中的位置 */
async function imageCornersPerPage(bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: false });
  const doc = await task.promise;
  const pages: Array<Array<{ tl: readonly [number, number]; tr: readonly [number, number]; bl: readonly [number, number] }>> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const stack: M[] = [];
    let ctm: M = [1, 0, 0, 1, 0, 0];
    const found: (typeof pages)[number] = [];
    ops.fnArray.forEach((fn, k) => {
      const args = ops.argsArray[k];
      if (fn === pdfjs.OPS.save) stack.push(ctm);
      else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === pdfjs.OPS.transform) ctm = compose(ctm, args as M);
      else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
        const dev = compose(viewport.transform as M, ctm);
        found.push({ tl: apply(dev, 0, 1), tr: apply(dev, 1, 1), bl: apply(dev, 0, 0) });
      }
    });
    pages.push(found);
  }
  await task.destroy();
  return pages;
}

async function makeSourcePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  const p2 = doc.addPage([600, 400]);
  p2.setRotation(degrees(90));
  p2.setCropBox(50, 30, 500, 350);
  const p3 = doc.addPage([400, 600]);
  p3.setRotation(degrees(180));
  const p4 = doc.addPage([700, 450]);
  p4.setMediaBox(100, 50, 600, 400);
  p4.setRotation(degrees(270));
  // 模拟原内容留下未恢复的坐标变换，验证会被 q/Q 隔离
  p4.pushOperators(concatTransformationMatrix(2, 0, 0, 2, 30, 30));
  return doc.save();
}

const png = makePng(64, 32, (x) => (x < 32 ? [220, 30, 30, 255] : [0, 0, 0, 128]));

test('各种页面旋转和 CropBox 下，印章落在指定的显示位置', async () => {
  const src = await makeSourcePdf();
  const draws: StampDraw[] = [0, 1, 2, 3].map((pageIndex) => ({
    pageIndex,
    image: { key: 'seal', png },
    cxMm: 60,
    cyMm: 50,
    widthMm: 40,
    heightMm: 20,
    rotationDeg: 0,
  }));
  draws.push({ pageIndex: 0, image: { key: 'seal', png }, cxMm: 100, cyMm: 100, widthMm: 40, heightMm: 20, rotationDeg: 90 });

  const out = await stampPdf(src, draws);
  const corners = await imageCornersPerPage(out);

  const eps = 0.01;
  const close = (p: readonly [number, number], x: number, y: number, label: string) =>
    assert.ok(Math.abs(p[0] - x) < eps && Math.abs(p[1] - y) < eps, `${label}: got ${p.map((v) => v.toFixed(2))}, want ${x.toFixed(2)},${y.toFixed(2)}`);

  for (let i = 0; i < 4; i++) {
    const c = corners[i]![0]!;
    assert.ok(c, `第 ${i + 1} 页应有图片`);
    close(c.tl, mmToPt(40), mmToPt(40), `page ${i + 1} top-left`);
    close(c.tr, mmToPt(80), mmToPt(40), `page ${i + 1} top-right`);
    close(c.bl, mmToPt(40), mmToPt(60), `page ${i + 1} bottom-left`);
  }

  // 顺时针旋转 90°：图片左上角转到右上角
  const r = corners[0]![1]!;
  close(r.tl, mmToPt(110), mmToPt(80), 'rotated top-left');
  close(r.bl, mmToPt(90), mmToPt(80), 'rotated bottom-left');
});

test('同一张图片只嵌入一次', async () => {
  const src = await makeSourcePdf();
  const draws: StampDraw[] = Array.from({ length: 4 }, (_, pageIndex) => ({
    pageIndex,
    image: { key: 'same', png },
    cxMm: 30,
    cyMm: 30,
    widthMm: 20,
    heightMm: 10,
    rotationDeg: 0,
  }));
  const once = await stampPdf(src, draws.slice(0, 1));
  const many = await stampPdf(src, draws);
  // 多画三次只多了几十字节的内容流，而不是再嵌入三张图
  assert.ok(many.length - once.length < 600, `size diff ${many.length - once.length}`);
});

test('页码越界报错', async () => {
  const src = await makeSourcePdf();
  await assert.rejects(
    stampPdf(src, [{ pageIndex: 9, image: { key: 'x', png }, cxMm: 1, cyMm: 1, widthMm: 1, heightMm: 1, rotationDeg: 0 }]),
    RangeError,
  );
});

test('检查文档：普通文档可写、无签名', async () => {
  const info = await inspectPdf(await makeSourcePdf());
  assert.deepEqual(info, { pageCount: 4, encrypted: false, hasSignatures: false });
});

test('加密文档给出明确错误', async () => {
  // 最小的加密 PDF：trailer 带 /Encrypt
  const doc = await PDFDocument.create();
  doc.addPage();
  const bytes = await doc.save({ useObjectStreams: false });
  const text = Buffer.from(bytes).toString('latin1');
  const encDict = '99 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>\nendobj\n';
  const patched = text
    .replace('trailer\n<<', 'trailer\n<<\n/Encrypt 99 0 R')
    .replace(/xref\n/, `${encDict}xref\n`);
  const info = await inspectPdf(new Uint8Array(Buffer.from(patched, 'latin1')));
  assert.equal(info.encrypted, true);
  await assert.rejects(stampPdf(new Uint8Array(Buffer.from(patched, 'latin1')), []), EncryptedPdfError);
});
