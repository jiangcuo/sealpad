import {
  Button,
  Checkbox,
  Divider,
  Field,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Text,
} from '@fluentui/react-components';
import { ArrowRotateClockwiseRegular, CopyRegular, DeleteRegular } from '@fluentui/react-icons';
import { round, type Placement, type SignatureAsset, type StraddleOptions } from '@sealpad/core';
import { pageSizeMm, type StraddleLayout } from '../lib/layout.ts';
import type { PageSize } from '../lib/pdf.ts';
import { NumberField } from './NumberField.tsx';

interface Props {
  pages: PageSize[];
  currentPage: number;
  seals: SignatureAsset[];
  selected: Placement | null;
  selectedSeal: SignatureAsset | null;
  onChange(id: string, patch: Partial<Placement>): void;
  onDelete(id: string): void;
  onApplyAll(id: string): void;
  straddle: StraddleOptions;
  straddleLayout: StraddleLayout | null;
  onStraddleChange(patch: Partial<StraddleOptions>): void;
}

function PlacementSection({ p, seal, pages, onChange, onDelete, onApplyAll }: {
  p: Placement;
  seal: SignatureAsset | null;
  pages: PageSize[];
  onChange(patch: Partial<Placement>): void;
  onDelete(): void;
  onApplyAll(): void;
}) {
  const page = pages[p.pageIndex];
  const { widthMm: pw, heightMm: ph } = page ? pageSizeMm(page) : { widthMm: 1000, heightMm: 1000 };
  const aspect = p.heightMm / p.widthMm;
  return (
    <section className="inspector-section" aria-label="印章属性">
      <Text weight="semibold">选中的印章</Text>
      <Text size={200} className="muted" truncate wrap={false}>
        {seal?.name ?? '（已删除的印章）'}
      </Text>
      <div className="grid-2">
        <NumberField label="宽度" unit="mm" value={p.widthMm} min={3} max={400} step={0.5} testId="placement-width"
          onCommit={(w) => onChange({ widthMm: w, heightMm: w * aspect })} />
        <NumberField label="高度" unit="mm" value={p.heightMm} min={3} max={400} step={0.5}
          onCommit={(h) => onChange({ heightMm: h, widthMm: h / aspect })} />
        <NumberField label="中心 X" unit="mm" value={p.cxMm} min={0} max={pw} step={0.5}
          onCommit={(x) => onChange({ cxMm: x })} />
        <NumberField label="中心 Y" unit="mm" value={p.cyMm} min={0} max={ph} step={0.5}
          onCommit={(y) => onChange({ cyMm: y })} />
        <NumberField label="旋转" unit="°" value={p.rotationDeg} min={0} max={359.9} step={1}
          onCommit={(r) => onChange({ rotationDeg: r })} />
        <NumberField label="所在页" value={p.pageIndex + 1} min={1} max={pages.length} digits={0}
          onCommit={(n) => onChange({ pageIndex: Math.round(n) - 1 })} />
      </div>
      <Text size={200} className="muted">
        比例已锁定。拖动印章移动，拖右下角缩放，拖顶部圆点旋转；方向键微调 0.5mm，按住 Shift 为 5mm。
      </Text>
      <div className="button-row">
        <Button size="small" icon={<ArrowRotateClockwiseRegular />} onClick={() => onChange({ rotationDeg: (Math.round(p.rotationDeg / 90) * 90 + 90) % 360 })}>
          转 90°
        </Button>
        <Button size="small" icon={<CopyRegular />} onClick={onApplyAll} disabled={pages.length < 2}>
          每页都盖
        </Button>
        <Button size="small" icon={<DeleteRegular />} onClick={onDelete}>
          移除
        </Button>
      </div>
    </section>
  );
}

function StraddleSection({ pages, seals, opts, layout, onChange }: {
  pages: PageSize[];
  seals: SignatureAsset[];
  opts: StraddleOptions;
  layout: StraddleLayout | null;
  onChange(patch: Partial<StraddleOptions>): void;
}) {
  const disabled = pages.length < 2 || seals.length === 0;
  const sorted = [...seals].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'seal' ? -1 : 1));
  const enable = (on: boolean) => {
    if (!on) return onChange({ enabled: false });
    const seal = seals.find((s) => s.id === opts.assetId) ?? sorted[0];
    onChange({ enabled: true, assetId: seal?.id ?? null, widthMm: seal?.widthMm ?? opts.widthMm });
  };
  const sliceMm = layout && layout.pieces.length ? layout.minSliceMm : 0;
  return (
    <section className="inspector-section" aria-label="骑缝章">
      <div className="section-title">
        <Text weight="semibold">骑缝章</Text>
        <Switch checked={opts.enabled} disabled={disabled} onChange={(_, d) => enable(d.checked)} aria-label="启用骑缝章" data-testid="straddle-switch" />
      </div>
      {disabled && (
        <Text size={200} className="muted">
          {pages.length < 2 ? '文档至少要有 2 页。' : '先在印章库导入一枚印章。'}
        </Text>
      )}
      {opts.enabled && !disabled && (
        <>
          <Field label="使用的印章" size="small">
            <Select
              size="small"
              value={opts.assetId ?? ''}
              onChange={(_, d) => {
                const seal = seals.find((s) => s.id === d.value);
                onChange({ assetId: d.value, widthMm: seal?.widthMm ?? opts.widthMm });
              }}
            >
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="位置" size="small">
            <RadioGroup layout="horizontal" value={opts.side} onChange={(_, d) => onChange({ side: d.value as StraddleOptions['side'] })}>
              <Radio value="right" label="右侧" />
              <Radio value="left" label="左侧" />
            </RadioGroup>
          </Field>
          <div className="grid-2">
            <NumberField label="起始页" value={opts.fromPage} min={1} max={pages.length} digits={0}
              onCommit={(n) => onChange({ fromPage: Math.round(n) })} />
            <NumberField label="结束页" value={opts.toPage > 0 ? opts.toPage : pages.length} min={1} max={pages.length} digits={0}
              onCommit={(n) => onChange({ toPage: Math.round(n) >= pages.length ? 0 : Math.round(n) })} />
            <NumberField label="印章宽度" unit="mm" value={opts.widthMm} min={10} max={120} step={0.5}
              onCommit={(w) => onChange({ widthMm: w })} />
            <NumberField label="每枚最多" unit="页" value={opts.maxPagesPerSeal} min={0} max={500} digits={0}
              hint="0 表示不限" onCommit={(n) => onChange({ maxPagesPerSeal: Math.round(n) })} />
          </div>
          <Checkbox checked={opts.skipFirstPage} label="跳过首页（封面）" onChange={(_, d) => onChange({ skipFirstPage: d.checked === true })} />
          <Checkbox checked={opts.oddPagesOnly} label="双面打印，只盖奇数页" onChange={(_, d) => onChange({ oddPagesOnly: d.checked === true })} />
          <Field label={`垂直位置：${Math.round(opts.centerYRatio * 100)}%`} size="small">
            <Slider min={0} max={100} step={1} value={Math.round(opts.centerYRatio * 100)} onChange={(_, d) => onChange({ centerYRatio: d.value / 100 })} />
          </Field>
          {layout && layout.pieces.length > 0 ? (
            <Text size={200} className={sliceMm < 3 ? 'warn' : 'muted'} data-testid="straddle-summary">
              共 {layout.pageCount} 页参与，每页约 {round(sliceMm)} mm 宽。
              {sliceMm < 3 && ' 每页太窄，建议设置「每枚最多」页数，分成几组盖。'}
            </Text>
          ) : (
            <Text size={200} className="warn">
              按当前设置不足 2 页，无法盖骑缝章。
            </Text>
          )}
        </>
      )}
    </section>
  );
}

export function Inspector(props: Props) {
  const hasDoc = props.pages.length > 0;
  return (
    <aside className="panel panel-right" aria-label="属性">
      {!hasDoc ? (
        <div className="inspector-hint">
          <Text weight="semibold">使用步骤</Text>
          <ol>
            <li>打开要盖章的 PDF</li>
            <li>在左侧导入印章或签名图片</li>
            <li>把印章拖到页面上，调整位置和大小</li>
            <li>需要的话打开骑缝章</li>
            <li>导出 PDF</li>
          </ol>
          <Text size={200} className="muted">
            页面按真实尺寸显示，印章尺寸以毫米为单位，打印出来就是这个大小。
          </Text>
        </div>
      ) : props.selected ? (
        <PlacementSection
          p={props.selected}
          seal={props.selectedSeal}
          pages={props.pages}
          onChange={(patch) => props.onChange(props.selected!.id, patch)}
          onDelete={() => props.onDelete(props.selected!.id)}
          onApplyAll={() => props.onApplyAll(props.selected!.id)}
        />
      ) : (
        <section className="inspector-section">
          <Text weight="semibold">印章</Text>
          <Text size={200} className="muted">
            从左侧把印章拖到页面上，或点印章下方的「盖章」盖到第 {props.currentPage + 1} 页。点选页面上的印章可以调整尺寸、位置和角度。
          </Text>
        </section>
      )}
      {hasDoc && (
        <>
          <Divider />
          <StraddleSection
            pages={props.pages}
            seals={props.seals}
            opts={props.straddle}
            layout={props.straddleLayout}
            onChange={props.onStraddleChange}
          />
        </>
      )}
    </aside>
  );
}
