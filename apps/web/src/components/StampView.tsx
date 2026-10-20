import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { clamp, rotatedHalfExtents, round, type Placement } from '@sealpad/core';

interface Props {
  placement: Placement;
  url: string | undefined;
  name: string;
  /** 每毫米多少 CSS 像素 */
  k: number;
  pageWidthMm: number;
  pageHeightMm: number;
  selected: boolean;
  onSelect(): void;
  onChange(patch: Partial<Placement>): void;
  onDelete(): void;
}

type Mode = 'move' | 'resize' | 'rotate';

interface DragState {
  mode: Mode;
  startX: number;
  startY: number;
  start: Placement;
  centerX: number;
  centerY: number;
  startDist: number;
}

const MIN_MM = 3;
const MAX_MM = 400;

function normalizeAngle(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  // 接近 0/90/180/270 时吸附
  for (const t of [0, 90, 180, 270, 360]) if (Math.abs(a - t) < 4) a = t % 360;
  return round(a, 1);
}

export function StampView(props: Props) {
  const { placement: p, k } = props;
  const drag = useRef<DragState | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 新盖的印章（创建时即被选中）如果在可视区域外，滚动过去
  useEffect(() => {
    if (props.selected) boxRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // 只在挂载时执行
  }, []);

  const begin = (e: ReactPointerEvent<HTMLElement>, mode: Mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    props.onSelect();
    const overlay = e.currentTarget.closest('.page-overlay');
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const centerX = rect.left + p.cxMm * k;
    const centerY = rect.top + p.cyMm * k;
    drag.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: p,
      centerX,
      centerY,
      startDist: Math.max(4, Math.hypot(e.clientX - centerX, e.clientY - centerY)),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'move') {
      props.onChange({
        cxMm: clamp(d.start.cxMm + (e.clientX - d.startX) / k, 0, props.pageWidthMm),
        cyMm: clamp(d.start.cyMm + (e.clientY - d.startY) / k, 0, props.pageHeightMm),
      });
    } else if (d.mode === 'resize') {
      const scale = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY) / d.startDist;
      const aspect = d.start.heightMm / d.start.widthMm;
      const widthMm = clamp(d.start.widthMm * scale, MIN_MM, MAX_MM);
      props.onChange({ widthMm, heightMm: widthMm * aspect });
    } else {
      const deg = (Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) * 180) / Math.PI + 90;
      props.onChange({ rotationDeg: normalizeAngle(deg) });
    }
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const ext = rotatedHalfExtents(p.widthMm, p.heightMm, p.rotationDeg);

  return (
    <div
      className={`stamp${props.selected ? ' selected' : ''}`}
      style={{ left: p.cxMm * k, top: p.cyMm * k }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      data-testid="stamp"
    >
      <div
        ref={boxRef}
        className="stamp-box"
        style={{ width: p.widthMm * k, height: p.heightMm * k, transform: `translate(-50%, -50%) rotate(${p.rotationDeg}deg)` }}
        onPointerDown={(e) => begin(e, 'move')}
        title={props.name}
      >
        {props.url && <img src={props.url} alt={props.name} draggable={false} />}
        {props.selected && (
          <>
            <span className="handle handle-rotate" onPointerDown={(e) => begin(e, 'rotate')} title="拖动旋转" />
            <span className="handle handle-resize" onPointerDown={(e) => begin(e, 'resize')} title="拖动缩放（保持比例）" />
            <button
              type="button"
              className="stamp-delete"
              aria-label="移除这个印章"
              title="移除（Delete）"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                props.onDelete();
              }}
            >
              ×
            </button>
          </>
        )}
      </div>
      {props.selected && (
        <div className="stamp-size" style={{ top: ext.hy * k + 8 }}>
          {round(p.widthMm)} × {round(p.heightMm)} mm{p.rotationDeg ? ` · ${round(p.rotationDeg)}°` : ''}
        </div>
      )}
    </div>
  );
}
