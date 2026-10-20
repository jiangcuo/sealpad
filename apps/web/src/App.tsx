import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Spinner } from '@fluentui/react-components';
import {
  DEFAULT_STRADDLE,
  EncryptedPdfError,
  SAMPLE_SEAL,
  clamp,
  createId,
  inspectPdf,
  opaqueBounds,
  cropImage,
  stampPdf,
  type Placement,
  type SignatureAsset,
  type StraddleOptions,
} from '@sealpad/core';
import { TopBar } from './components/TopBar.tsx';
import { SignatureLibrary } from './components/SignatureLibrary.tsx';
import { DocumentView } from './components/DocumentView.tsx';
import { Inspector } from './components/Inspector.tsx';
import { ImportImageDialog } from './components/ImportImageDialog.tsx';
import { AboutDialog } from './components/AboutDialog.tsx';
import { NoticeBar, type Notice } from './components/NoticeBar.tsx';
import { isTypingTarget, readFlag, useAssetUrls, writeFlag } from './hooks.ts';
import { buildDraws, computeStraddle, pageSizeMm } from './lib/layout.ts';
import { CSS_PX_PER_PT, PdfPasswordError, openPdf, type OpenedPdf } from './lib/pdf.ts';
import { rgbaToPng, svgToRgba } from './lib/image.ts';
import { createAssetStore, type AssetStore } from './lib/assetStore.ts';
import {
  IMAGE_EXTENSIONS,
  WORD_EXTENSIONS,
  createPlatform,
  extensionOf,
  type OpenedFile,
  type Platform,
} from './platform/index.ts';

const DISCLAIMER_FLAG = 'sealpad.disclaimer.v1';
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface LoadedDoc {
  name: string;
  bytes: Uint8Array;
  pdf: OpenedPdf;
  /** 不能写入的原因（加密、结构损坏），为空表示可以导出 */
  readOnlyReason: string | null;
}

function exportName(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return `${base}-已盖章.pdf`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function App() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [store, setStore] = useState<AssetStore | null>(null);
  const [seals, setSeals] = useState<SignatureAsset[]>([]);
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [straddle, setStraddle] = useState<StraddleOptions>(DEFAULT_STRADDLE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<OpenedFile | null>(null);
  const [aboutOpen, setAboutOpen] = useState(() => !readFlag(DISCLAIMER_FLAG));
  const [fileDragging, setFileDragging] = useState(false);
  const dragDepth = useRef(0);
  const docRef = useRef<LoadedDoc | null>(null);
  const viewportWidth = useRef(900);

  const assetMap = useMemo(() => new Map(seals.map((s) => [s.id, s])), [seals]);
  const assetUrls = useAssetUrls(seals);
  const pages = doc?.pdf.pages ?? [];
  const straddleLayout = useMemo(() => computeStraddle(pages, straddle, assetMap), [pages, straddle, assetMap]);
  const selected = placements.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    void createPlatform().then(setPlatform);
    void createAssetStore().then(async (s) => {
      setStore(s);
      setSeals(await s.list());
    });
  }, []);

  const fitZoom = useCallback((pdf: OpenedPdf) => {
    const maxWidthPt = Math.max(...pdf.pages.map((p) => p.widthPt), 1);
    const z = (viewportWidth.current - 64) / (maxWidthPt * CSS_PX_PER_PT);
    return clamp(Math.round(z * 100) / 100, 0.25, 2);
  }, []);

  // ---------- 文档 ----------

  const openDocument = useCallback(
    async (file: OpenedFile) => {
      const ext = extensionOf(file.name);
      if (WORD_EXTENSIONS.includes(ext)) {
        setNotice({
          intent: 'warning',
          title: '暂不支持直接打开 Word',
          text: '请先在 Word 或 WPS 中另存为 PDF。Word 导入在路线图第三阶段（桌面版）。',
        });
        return;
      }
      if (IMAGE_EXTENSIONS.includes(ext)) {
        setImportFile(file);
        return;
      }
      setBusy('正在打开文档…');
      try {
        const pdf = await openPdf(file.bytes);
        let readOnlyReason: string | null = null;
        let hasSignatures = false;
        try {
          const info = await inspectPdf(file.bytes);
          if (info.encrypted) readOnlyReason = new EncryptedPdfError().message;
          hasSignatures = info.hasSignatures;
        } catch (err) {
          readOnlyReason = `这个 PDF 的结构无法写入：${errorText(err)}`;
        }
        void docRef.current?.pdf.task.destroy();
        const next: LoadedDoc = { name: file.name, bytes: file.bytes, pdf, readOnlyReason };
        docRef.current = next;
        setDoc(next);
        setPlacements([]);
        setSelectedId(null);
        setCurrentPage(0);
        setStraddle((s) => ({ ...s, enabled: false, fromPage: 1, toPage: 0 }));
        setZoom(fitZoom(pdf));
        if (readOnlyReason) setNotice({ intent: 'warning', title: '只能预览，不能导出', text: readOnlyReason });
        else if (hasSignatures)
          setNotice({
            intent: 'warning',
            title: '这个文档已有数字签名',
            text: '导出时会重新保存整个文件，原有的数字签名将失效。如需保留，请联系签署方在盖章后重新签名。',
          });
        else setNotice(null);
      } catch (err) {
        setNotice({
          intent: 'error',
          title: '打开失败',
          text: err instanceof PdfPasswordError ? err.message : `无法识别这个 PDF：${errorText(err)}`,
        });
      } finally {
        setBusy(null);
      }
    },
    [fitZoom],
  );

  const openViaDialog = useCallback(async () => {
    try {
      const file = await platform?.openPdf();
      if (file) await openDocument(file);
    } catch (err) {
      setNotice({ intent: 'error', title: '打开失败', text: errorText(err) });
    }
  }, [platform, openDocument]);

  const exportDocument = useCallback(async () => {
    if (!doc || !platform) return;
    if (doc.readOnlyReason) {
      setNotice({ intent: 'warning', title: '无法导出', text: doc.readOnlyReason });
      return;
    }
    if (placements.length === 0 && !straddleLayout?.pieces.length) {
      setNotice({ intent: 'info', title: '还没有盖章', text: '从左侧印章库把印章拖到页面上，或打开右侧的骑缝章。' });
      return;
    }
    setBusy('正在生成 PDF…');
    try {
      const draws = await buildDraws(placements, straddleLayout, assetMap);
      const out = await stampPdf(doc.bytes, draws);
      setBusy(null);
      const where = await platform.saveFile(exportName(doc.name), out);
      if (where) setNotice({ intent: 'success', title: '导出完成', text: `已保存：${where}` });
    } catch (err) {
      setNotice({ intent: 'error', title: '导出失败', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }, [doc, platform, placements, straddleLayout, assetMap]);

  // ---------- 印章库 ----------

  const saveAsset = useCallback(
    async (seal: SignatureAsset) => {
      await store?.put(seal);
      setSeals((list) => [...list.filter((s) => s.id !== seal.id), seal]);
    },
    [store],
  );

  const addSampleSeal = useCallback(async () => {
    try {
      const raw = await svgToRgba(SAMPLE_SEAL.svg(), 800);
      const bounds = opaqueBounds(raw, 8, 2);
      const img = bounds ? cropImage(raw, bounds) : raw;
      const png = await rgbaToPng(img);
      await saveAsset({
        id: createId(),
        name: SAMPLE_SEAL.name,
        kind: 'seal',
        widthMm: SAMPLE_SEAL.widthMm,
        heightMm: (SAMPLE_SEAL.widthMm * img.height) / img.width,
        png,
        pixelWidth: img.width,
        pixelHeight: img.height,
        createdAt: Date.now(),
        origin: 'sample',
      });
    } catch (err) {
      setNotice({ intent: 'error', title: '生成示例印章失败', text: errorText(err) });
    }
  }, [saveAsset]);

  const deleteAsset = useCallback(
    async (id: string) => {
      await store?.remove(id);
      setSeals((list) => list.filter((s) => s.id !== id));
      setPlacements((ps) => ps.filter((p) => p.assetId !== id));
      setStraddle((s) => (s.assetId === id ? { ...s, assetId: null, enabled: false } : s));
    },
    [store],
  );

  const importViaDialog = useCallback(async () => {
    try {
      const file = await platform?.openImage();
      if (file) setImportFile(file);
    } catch (err) {
      setNotice({ intent: 'error', title: '读取图片失败', text: errorText(err) });
    }
  }, [platform]);

  // ---------- 盖章 ----------

  const addPlacement = useCallback(
    (assetId: string, pageIndex: number, cxMm?: number, cyMm?: number) => {
      const seal = assetMap.get(assetId);
      const page = pages[pageIndex];
      if (!seal || !page) return;
      const { widthMm, heightMm } = pageSizeMm(page);
      const p: Placement = {
        id: createId(),
        assetId,
        pageIndex,
        cxMm: clamp(cxMm ?? widthMm * 0.68, 0, widthMm),
        cyMm: clamp(cyMm ?? heightMm * 0.78, 0, heightMm),
        widthMm: seal.widthMm,
        heightMm: seal.heightMm,
        rotationDeg: 0,
      };
      setPlacements((ps) => [...ps, p]);
      setSelectedId(p.id);
    },
    [assetMap, pages],
  );

  const updatePlacement = useCallback((id: string, patch: Partial<Placement>) => {
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePlacement = useCallback((id: string) => {
    setPlacements((ps) => ps.filter((p) => p.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const applyToAllPages = useCallback(
    (id: string) => {
      const src = placements.find((p) => p.id === id);
      if (!src) return;
      const copies: Placement[] = [];
      pages.forEach((page, pageIndex) => {
        if (pageIndex === src.pageIndex) return;
        const { widthMm, heightMm } = pageSizeMm(page);
        copies.push({ ...src, id: createId(), pageIndex, cxMm: clamp(src.cxMm, 0, widthMm), cyMm: clamp(src.cyMm, 0, heightMm) });
      });
      setPlacements((ps) => [...ps, ...copies]);
      setNotice({ intent: 'success', title: '已复制', text: `已在其余 ${copies.length} 页的相同位置盖章。` });
    },
    [placements, pages],
  );

  // ---------- 快捷键 ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void openViaDialog();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void exportDocument();
        return;
      }
      if (isTypingTarget(e.target) || !selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removePlacement(selected.id);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const page = pages[selected.pageIndex];
        if (!page) return;
        const { widthMm, heightMm } = pageSizeMm(page);
        updatePlacement(selected.id, {
          cxMm: clamp(selected.cxMm + dx, 0, widthMm),
          cyMm: clamp(selected.cyMm + dy, 0, heightMm),
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openViaDialog, exportDocument, selected, pages, removePlacement, updatePlacement]);

  // ---------- 拖入文件 ----------

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const onFileDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setFileDragging(true);
  };
  const onFileDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setFileDragging(false);
  };
  const onFileDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onFileDrop = async (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setFileDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      await openDocument({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    } catch (err) {
      setNotice({ intent: 'error', title: '读取文件失败', text: errorText(err) });
    }
  };

  const setZoomStep = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 1e-6) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 1e-6);
    if (next) setZoom(next);
  };

  return (
    <div
      className="app"
      onDragEnter={onFileDragEnter}
      onDragLeave={onFileDragLeave}
      onDragOver={onFileDragOver}
      onDrop={onFileDrop}
    >
      <TopBar
        docName={doc?.name ?? null}
        zoom={zoom}
        canExport={!!doc && !doc.readOnlyReason}
        onOpen={openViaDialog}
        onExport={exportDocument}
        onZoomIn={() => setZoomStep(1)}
        onZoomOut={() => setZoomStep(-1)}
        onZoomReset={() => setZoom(1)}
        onFit={() => doc && setZoom(fitZoom(doc.pdf))}
        onAbout={() => setAboutOpen(true)}
      />
      {notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}
      <div className="workspace">
        <SignatureLibrary
          seals={seals}
          urls={assetUrls}
          persistent={store?.persistent ?? true}
          canStamp={!!doc}
          onImport={importViaDialog}
          onAddSample={addSampleSeal}
          onStamp={(id) => addPlacement(id, currentPage)}
          onDelete={deleteAsset}
        />
        <DocumentView
          doc={doc ? { proxy: doc.pdf.proxy, pages: doc.pdf.pages, name: doc.name } : null}
          zoom={zoom}
          placements={placements}
          seals={assetMap}
          assetUrls={assetUrls}
          straddle={straddleLayout}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updatePlacement}
          onDelete={removePlacement}
          onDropSeal={addPlacement}
          onCurrentPage={setCurrentPage}
          onViewportWidth={(w) => (viewportWidth.current = w)}
          onOpen={openViaDialog}
        />
        <Inspector
          pages={pages}
          currentPage={currentPage}
          seals={seals}
          selected={selected}
          selectedSeal={selected ? (assetMap.get(selected.assetId) ?? null) : null}
          onChange={updatePlacement}
          onDelete={removePlacement}
          onApplyAll={applyToAllPages}
          straddle={straddle}
          straddleLayout={straddleLayout}
          onStraddleChange={(patch) => setStraddle((s) => ({ ...s, ...patch }))}
        />
      </div>
      <footer className="statusbar">
        {doc ? (
          <span>
            共 {pages.length} 页 · 第 {currentPage + 1} 页 · 已盖 {placements.length} 枚
            {straddleLayout?.pieces.length ? ` · 骑缝章 ${straddleLayout.pageCount} 页` : ''}
          </span>
        ) : (
          <span>未打开文档</span>
        )}
        <span className="statusbar-right">{platform?.kind === 'desktop' ? '桌面版' : '网页版'} · 文件只在本机处理，不会上传</span>
      </footer>
      {fileDragging && <div className="drop-overlay">松开鼠标打开文件（PDF 或印章图片）</div>}
      {busy && (
        <div className="busy-overlay" role="status">
          <Spinner label={busy} />
        </div>
      )}
      <ImportImageDialog
        file={importFile}
        onCancel={() => setImportFile(null)}
        onSave={async (seal) => {
          await saveAsset(seal);
          setImportFile(null);
          setNotice({ intent: 'success', title: '已加入印章库', text: `「${seal.name}」可以拖到页面上使用了。` });
        }}
      />
      <AboutDialog
        open={aboutOpen}
        firstRun={!readFlag(DISCLAIMER_FLAG)}
        onClose={() => {
          writeFlag(DISCLAIMER_FLAG);
          setAboutOpen(false);
        }}
      />
    </div>
  );
}
