import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { CSS_PX_PER_PT, isRenderCancelled, type PDFDocumentProxy, type PageSize } from '../lib/pdf.ts';
import { SEAL_DRAG_TYPE } from './SealLibrary.tsx';

interface Props {
  proxy: PDFDocumentProxy;
  index: number;
  size: PageSize;
  zoom: number;
  scrollRoot: HTMLElement | null;
  children?: ReactNode;
  onBlankPointerDown(): void;
  onDropSeal(sealId: string, xMm: number, yMm: number): void;
  registerElement(index: number, el: HTMLElement | null): void;
}

/** 单张画布最多这么多像素，避免放大时内存爆掉 */
const MAX_CANVAS_PIXELS = 16_000_000;

export function PageView(props: Props) {
  const { proxy, index, size, zoom } = props;
  const cssW = size.widthPt * CSS_PX_PER_PT * zoom;
  const cssH = size.heightPt * CSS_PX_PER_PT * zoom;
  const kMm = (CSS_PX_PER_PT * zoom * 72) / 25.4;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  // 只渲染进入视口附近的页面
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), {
      root: props.scrollRoot,
      rootMargin: '1200px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [props.scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    const timer = window.setTimeout(async () => {
      try {
        const page = await proxy.getPage(index + 1);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const base = page.getViewport({ scale: 1 });
        let scale = CSS_PX_PER_PT * zoom * dpr;
        const pixels = base.width * base.height * scale * scale;
        if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        // 先画到离屏画布，完成后再替换，缩放时不会闪白
        const off = document.createElement('canvas');
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        task = page.render({ canvas: off, viewport });
        await task.promise;
        if (cancelled) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d')?.drawImage(off, 0, 0);
        setRendered(true);
      } catch (err) {
        if (!isRenderCancelled(err) && !cancelled) console.error(`第 ${index + 1} 页渲染失败`, err);
      }
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [visible, zoom, proxy, index]);

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(SEAL_DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const sealId = e.dataTransfer.getData(SEAL_DRAG_TYPE);
    if (!sealId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    props.onDropSeal(sealId, (e.clientX - rect.left) / kMm, (e.clientY - rect.top) / kMm);
  };

  return (
    <div
      className="page-wrap"
      ref={(el) => {
        wrapperRef.current = el;
        props.registerElement(index, el);
      }}
      data-page={index}
    >
      <div className={`page${rendered ? '' : ' loading'}`} style={{ width: cssW, height: cssH }}>
        <canvas ref={canvasRef} className="page-canvas" />
        <div
          className="page-overlay"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) props.onBlankPointerDown();
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          data-testid={`page-${index + 1}`}
        >
          {props.children}
        </div>
      </div>
      <div className="page-number">{index + 1}</div>
    </div>
  );
}
