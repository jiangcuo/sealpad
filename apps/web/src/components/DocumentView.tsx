import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Text } from '@fluentui/react-components';
import { DocumentPdfRegular, FolderOpenRegular } from '@fluentui/react-icons';
import type { Placement, SignatureAsset } from '@sealpad/core';
import { CSS_PX_PER_PT, type PDFDocumentProxy, type PageSize } from '../lib/pdf.ts';
import { pageSizeMm, type StraddleLayout } from '../lib/layout.ts';
import { PageView } from './PageView.tsx';
import { StampView } from './StampView.tsx';

interface Props {
  doc: { proxy: PDFDocumentProxy; pages: PageSize[]; name: string } | null;
  zoom: number;
  placements: Placement[];
  seals: Map<string, SignatureAsset>;
  assetUrls: Map<string, string>;
  straddle: StraddleLayout | null;
  selectedId: string | null;
  onSelect(id: string | null): void;
  onChange(id: string, patch: Partial<Placement>): void;
  onDelete(id: string): void;
  onDropSeal(assetId: string, pageIndex: number, cxMm: number, cyMm: number): void;
  onCurrentPage(index: number): void;
  onViewportWidth(width: number): void;
  onOpen(): void;
}

export function DocumentView(props: Props) {
  const { doc, zoom } = props;
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const pageEls = useRef(new Map<number, HTMLElement>());
  const scrollRatio = useRef(0);
  const lastPage = useRef(-1);
  const { onViewportWidth, onCurrentPage } = props;

  useEffect(() => {
    if (!scrollEl) return;
    const ro = new ResizeObserver(() => onViewportWidth(scrollEl.clientWidth));
    ro.observe(scrollEl);
    onViewportWidth(scrollEl.clientWidth);
    return () => ro.disconnect();
  }, [scrollEl, onViewportWidth]);

  const updateCurrentPage = useCallback(() => {
    if (!scrollEl) return;
    const mid = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [i, el] of pageEls.current) {
      const r = el.getBoundingClientRect();
      const dist = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (best !== lastPage.current) {
      lastPage.current = best;
      onCurrentPage(best);
    }
  }, [scrollEl, onCurrentPage]);

  // 缩放时保持阅读位置
  useLayoutEffect(() => {
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollRatio.current * scrollEl.scrollHeight;
  }, [zoom, scrollEl]);

  useEffect(() => {
    lastPage.current = -1;
    pageEls.current.clear();
    if (scrollEl) scrollEl.scrollTop = 0;
    scrollRatio.current = 0;
  }, [doc?.proxy, scrollEl]);

  const registerElement = useCallback((index: number, el: HTMLElement | null) => {
    if (el) pageEls.current.set(index, el);
    else pageEls.current.delete(index);
  }, []);

  if (!doc) {
    return (
      <main className="viewer viewer-empty">
        <div className="empty-card">
          <DocumentPdfRegular className="empty-icon" />
          <Text size={500} weight="semibold">
            打开要盖章的 PDF
          </Text>
          <Text className="muted">把文件拖到窗口里，或点击下面的按钮</Text>
          <Button appearance="primary" size="large" icon={<FolderOpenRegular />} onClick={props.onOpen}>
            打开 PDF
          </Button>
          <Text size={200} className="muted">
            文件只在本机处理，不会上传到任何服务器
          </Text>
        </div>
      </main>
    );
  }

  const k = (CSS_PX_PER_PT * zoom * 72) / 25.4;

  return (
    <main
      className="viewer"
      ref={setScrollEl}
      onScroll={(e) => {
        const el = e.currentTarget;
        scrollRatio.current = el.scrollHeight ? el.scrollTop / el.scrollHeight : 0;
        updateCurrentPage();
      }}
      data-testid="viewer"
    >
      {doc.pages.map((size, index) => {
        const { widthMm, heightMm } = pageSizeMm(size);
        return (
          <PageView
            key={index}
            proxy={doc.proxy}
            index={index}
            size={size}
            zoom={zoom}
            scrollRoot={scrollEl}
            registerElement={registerElement}
            onBlankPointerDown={() => props.onSelect(null)}
            onDropSeal={(assetId, x, y) => props.onDropSeal(assetId, index, x, y)}
          >
            {props.straddle?.pieces
              .filter((piece) => piece.pageIndex === index)
              .map((piece) => (
                <div
                  key={`straddle-${piece.sliceIndex}`}
                  className="straddle-piece"
                  style={{
                    left: (piece.cxMm - piece.widthMm / 2) * k,
                    top: (piece.cyMm - piece.heightMm / 2) * k,
                    width: piece.widthMm * k,
                    height: piece.heightMm * k,
                  }}
                  data-testid="straddle-piece"
                >
                  <img
                    src={props.assetUrls.get(props.straddle!.seal.id)}
                    alt=""
                    draggable={false}
                    style={{
                      left: -(piece.x0 / props.straddle!.seal.pixelWidth) * props.straddle!.sealWidthMm * k,
                      width: props.straddle!.sealWidthMm * k,
                      height: piece.heightMm * k,
                    }}
                  />
                </div>
              ))}
            {props.placements
              .filter((p) => p.pageIndex === index)
              .map((p) => (
                <StampView
                  key={p.id}
                  placement={p}
                  url={props.assetUrls.get(p.assetId)}
                  name={props.seals.get(p.assetId)?.name ?? ''}
                  k={k}
                  pageWidthMm={widthMm}
                  pageHeightMm={heightMm}
                  selected={p.id === props.selectedId}
                  onSelect={() => props.onSelect(p.id)}
                  onChange={(patch) => props.onChange(p.id, patch)}
                  onDelete={() => props.onDelete(p.id)}
                />
              ))}
          </PageView>
        );
      })}
    </main>
  );
}
