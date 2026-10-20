export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * 网页版和桌面版的差异都收在这里。界面代码只依赖这个接口。
 * 以后的扫码手写签名、Word 转换、系统证书签名也会加在这里，网页版给出降级实现。
 */
export interface Platform {
  readonly kind: 'web' | 'desktop';
  openPdf(): Promise<OpenedFile | null>;
  openImage(): Promise<OpenedFile | null>;
  /** 保存文件，返回保存位置的描述；用户取消时返回 null */
  saveFile(suggestedName: string, bytes: Uint8Array): Promise<string | null>;
}

export const PDF_EXTENSIONS = ['pdf'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'];
export const WORD_EXTENSIONS = ['doc', 'docx', 'wps', 'odt', 'rtf'];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function mimeOf(name: string): string {
  switch (extensionOf(name)) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
