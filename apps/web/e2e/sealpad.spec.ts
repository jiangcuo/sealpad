import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import { makePng } from '../../../packages/core/test/helpers.ts';

/** 生成一份 3 页 A4 测试合同 */
async function makeContract(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`SealPad test contract - page ${i}`, { x: 72, y: 760, size: 18, font, color: rgb(0.1, 0.1, 0.1) });
    for (let line = 0; line < 20; line++) {
      page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', { x: 72, y: 700 - line * 24, size: 11, font });
    }
  }
  return doc.save();
}

// 直接传文件内容而不是路径：部分环境下非 ASCII 路径（测试输出目录含中文标题）无法被浏览器读取
async function openFile(page: Page, buttonName: string, file: { name: string; mimeType: string; bytes: Uint8Array }) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: buttonName, exact: true }).first().click();
  await (await chooser).setFiles({ name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.bytes) });
}

function sealPadImages(doc: PDFDocument, pageIndex: number): number {
  const page = doc.getPage(pageIndex);
  const xobjects = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  return xobjects ? xobjects.keys().filter((k) => k.toString().startsWith('/SealPad')).length : 0;
}

test.beforeEach(async ({ page }) => {
  // 让网页版走「下载」分支，方便测试拿到导出的文件
  await page.addInitScript(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
  await page.goto('./');
  // 每个测试都是全新的浏览器上下文，首次启动一定会弹出使用须知
  await page.getByTestId('about-ok').click();
  await expect(page.getByTestId('about-ok')).toHaveCount(0);
});

test('打开 PDF、盖章、调整尺寸、骑缝章、导出', async ({ page }, testInfo) => {
  await openFile(page, '打开 PDF', { name: 'contract.pdf', mimeType: 'application/pdf', bytes: await makeContract() });
  await expect(page.getByTestId('page-3')).toBeVisible();

  await page.getByRole('button', { name: '添加示例印章' }).click();
  await expect(page.getByTestId('seal-item')).toHaveCount(1);

  await page.getByRole('button', { name: '盖章', exact: true }).click();
  const stamp = page.getByTestId('stamp');
  await expect(stamp).toHaveCount(1);
  await expect(page.getByTestId('placement-width')).toHaveValue('40');

  // 拖动印章
  const box = (await stamp.locator('.stamp-box').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  const moved = (await stamp.locator('.stamp-box').boundingBox())!;
  expect(Math.round(moved.x - box.x)).toBe(-80);
  expect(Math.round(moved.y - box.y)).toBe(-60);

  // 输入毫米数调整尺寸：页面上的像素宽度应同步变化
  await page.getByTestId('placement-width').fill('42');
  await page.getByTestId('placement-width').press('Enter');
  const resized = (await stamp.locator('.stamp-box').boundingBox())!;
  expect(resized.width / moved.width).toBeCloseTo(42 / 40, 2);

  // 从印章库直接拖到页面上（HTML5 拖放），印章中心落在松手的位置
  const page1 = page.getByTestId('page-1');
  await page1.scrollIntoViewIfNeeded();
  await page.getByTestId('seal-item').dragTo(page1, { targetPosition: { x: 150, y: 200 } });
  await expect(stamp).toHaveCount(2);
  const dropped = (await stamp.nth(1).locator('.stamp-box').boundingBox())!;
  const p1 = (await page1.boundingBox())!;
  expect(Math.abs(dropped.x + dropped.width / 2 - (p1.x + 150))).toBeLessThan(2);
  expect(Math.abs(dropped.y + dropped.height / 2 - (p1.y + 200))).toBeLessThan(2);
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await expect(stamp).toHaveCount(1);

  // 骑缝章：3 页各一条
  await page.getByTestId('straddle-switch').click();
  await expect(page.getByTestId('straddle-piece')).toHaveCount(3);
  await expect(page.getByTestId('straddle-summary')).toContainText('共 3 页参与');

  await page.screenshot({ path: testInfo.outputPath('stamped.png') });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PDF' }).click();
  const file = testInfo.outputPath('out.pdf');
  await (await download).saveAs(file);

  const out = await PDFDocument.load(readFileSync(file), { updateMetadata: false });
  expect(out.getPageCount()).toBe(3);
  expect(sealPadImages(out, 0)).toBe(2); // 印章 + 骑缝章切片
  expect(sealPadImages(out, 1)).toBe(1);
  expect(sealPadImages(out, 2)).toBe(1);
  expect(out.getProducer()).toBe('SealPad');
});

test('导入图片印章并去掉白底', async ({ page }) => {
  // 白底上的红色圆环
  const png = makePng(240, 240, (x, y) => {
    const d = Math.hypot(x - 120, y - 120);
    return d > 80 && d < 96 ? [205, 30, 30, 255] : [247, 246, 242, 255];
  });
  await openFile(page, '导入', { name: 'seal.png', mimeType: 'image/png', bytes: png });
  await expect(page.getByTestId('import-preview')).toBeVisible();
  await page.getByTestId('import-name').fill('测试章');
  await page.getByTestId('import-save').click();

  const item = page.getByTestId('seal-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('测试章');
  // 自动裁边后是 192px 见方的圆环，宽 40mm → 高 40mm
  await expect(item).toContainText('40 × 40 mm');

  // 刷新后印章还在（IndexedDB）
  await page.reload();
  await expect(page.getByTestId('seal-item')).toHaveCount(1);
});
