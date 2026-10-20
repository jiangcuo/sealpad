import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFSignature,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  type PDFImage,
} from 'pdf-lib';
import { stampMatrix } from './geometry.ts';
import { mmToPt } from './units.ts';

/** 要画到 PDF 上的一张图片。key 相同的图片只嵌入一次。 */
export interface StampImage {
  key: string;
  png: Uint8Array;
}

/** 一次绘制：显示坐标（左上角原点，毫米），中心点 + 尺寸 + 顺时针旋转 */
export interface StampDraw {
  pageIndex: number;
  image: StampImage;
  cxMm: number;
  cyMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
}

export interface StampOptions {
  /** 写入文档信息的 Producer 字段 */
  producer?: string;
}

export class EncryptedPdfError extends Error {
  constructor() {
    super('这个 PDF 已加密或设置了权限密码，暂时无法写入。请先用原软件去掉密码后再导入。');
    this.name = 'EncryptedPdfError';
  }
}

export interface PdfInspection {
  pageCount: number;
  /** 已加密，无法写入 */
  encrypted: boolean;
  /** 已有数字签名；重新保存会让原签名失效 */
  hasSignatures: boolean;
}

async function loadForWrite(pdfBytes: Uint8Array): Promise<PDFDocument> {
  // pdf-lib 编译成 ES5，它的错误类无法用 instanceof 判断，所以先忽略加密载入再自己检查
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false, ignoreEncryption: true });
  if (doc.isEncrypted) throw new EncryptedPdfError();
  return doc;
}

/** 检查文档能否写入，以及有没有已存在的数字签名 */
export async function inspectPdf(pdfBytes: Uint8Array): Promise<PdfInspection> {
  let doc: PDFDocument;
  try {
    doc = await loadForWrite(pdfBytes);
  } catch (err) {
    if (err instanceof EncryptedPdfError) {
      return { pageCount: 0, encrypted: true, hasSignatures: false };
    }
    throw err;
  }
  let hasSignatures = false;
  try {
    hasSignatures = doc
      .getForm()
      .getFields()
      .some((f) => f instanceof PDFSignature && f.acroField.dict.get(PDFName.of('V')) instanceof PDFDict);
  } catch {
    // 表单结构损坏时忽略，不影响盖章
  }
  return { pageCount: doc.getPageCount(), encrypted: false, hasSignatures };
}

/**
 * 把印章画到 PDF 上，返回新的 PDF。
 * 原有内容会被 q/Q 包起来（pdf-lib 默认行为），不受原内容残留的坐标变换影响。
 */
export async function stampPdf(
  pdfBytes: Uint8Array,
  draws: StampDraw[],
  options: StampOptions = {},
): Promise<Uint8Array> {
  const doc = await loadForWrite(pdfBytes);
  const pages = doc.getPages();
  const images = new Map<string, PDFImage>();

  for (const d of draws) {
    const page = pages[d.pageIndex];
    if (!page) throw new RangeError(`页码超出范围：${d.pageIndex + 1}`);

    let image = images.get(d.image.key);
    if (!image) {
      image = await doc.embedPng(d.image.png);
      images.set(d.image.key, image);
    }

    const box = page.getCropBox();
    const rotation = page.getRotation().angle;
    const m = stampMatrix(
      {
        cx: mmToPt(d.cxMm),
        cy: mmToPt(d.cyMm),
        width: mmToPt(d.widthMm),
        height: mmToPt(d.heightMm),
        rotationDeg: d.rotationDeg,
      },
      box,
      rotation,
    );
    const name = page.node.newXObject('SealPad', image.ref);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m), drawObject(name), popGraphicsState());
  }

  doc.setProducer(options.producer ?? 'SealPad');
  doc.setModificationDate(new Date());
  return doc.save();
}
