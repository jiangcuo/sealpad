// 使用 pdf.js 的 legacy 构建：带兼容补丁，国内常见的旧内核浏览器也能打开。
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };

export function isRenderCancelled(err: unknown): boolean {
  return (err as Error)?.name === 'RenderingCancelledException';
}

/** 「100%」= 真实尺寸：1pt 显示为 96/72 个 CSS 像素，和 pdf.js 官方查看器一致 */
export const CSS_PX_PER_PT = 96 / 72;

export interface PageSize {
  /** 旋转后的显示尺寸，单位 pt */
  widthPt: number;
  heightPt: number;
}

export interface OpenedPdf {
  task: PDFDocumentLoadingTask;
  proxy: PDFDocumentProxy;
  pages: PageSize[];
}

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}pdfjs/${path}`, document.baseURI).href;
}

export class PdfPasswordError extends Error {
  constructor() {
    super('这个 PDF 设置了打开密码，暂不支持。请先在原软件中取消密码。');
  }
}

export async function openPdf(bytes: Uint8Array): Promise<OpenedPdf> {
  const task = pdfjs.getDocument({
    // pdf.js 会把数据转移到 worker，原数组会被清空，所以传副本，原数据留给导出用
    data: bytes.slice(),
    cMapUrl: assetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts/'),
    wasmUrl: assetUrl('wasm/'),
    iccUrl: assetUrl('iccs/'),
  });
  // 没有设置 onPassword 时，需要密码的文档会以 PasswordException 拒绝
  let proxy: PDFDocumentProxy;
  try {
    proxy = await task.promise;
  } catch (err) {
    if ((err as Error)?.name === 'PasswordException') throw new PdfPasswordError();
    throw err;
  }
  const pages: PageSize[] = [];
  for (let i = 1; i <= proxy.numPages; i++) {
    const page = await proxy.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    pages.push({ widthPt: vp.width, heightPt: vp.height });
  }
  return { task, proxy, pages };
}
