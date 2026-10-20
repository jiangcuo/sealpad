import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Radio,
  RadioGroup,
  Slider,
  Spinner,
  Text,
} from '@fluentui/react-components';
import {
  createId,
  cropImage,
  hasTransparency,
  opaqueBounds,
  removeWhiteBackground,
  round,
  type RgbaImage,
  type SealAsset,
  type SealKind,
} from '@sealpad/core';
import { decodeImageFile, rgbaToCanvas, rgbaToPng } from '../lib/image.ts';
import type { OpenedFile } from '../platform/index.ts';
import { NumberField } from './NumberField.tsx';

interface Props {
  file: OpenedFile | null;
  onCancel(): void;
  onSave(seal: SealAsset): Promise<void>;
}

const DEFAULT_WIDTH: Record<SealKind, number> = { seal: 40, signature: 45 };

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

export function ImportSealDialog({ file, onCancel, onSave }: Props) {
  const [source, setSource] = useState<RgbaImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SealKind>('seal');
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH.seal);
  const [removeBg, setRemoveBg] = useState(true);
  const [threshold, setThreshold] = useState(40);
  const [autoCrop, setAutoCrop] = useState(true);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setSource(null);
    setError(null);
    if (!file) return;
    setName(stripExtension(file.name));
    setKind('seal');
    setWidthMm(DEFAULT_WIDTH.seal);
    setThreshold(40);
    setAutoCrop(true);
    let cancelled = false;
    decodeImageFile(file)
      .then((img) => {
        if (cancelled) return;
        setSource(img);
        // 已经是透明底的图片默认不再去底
        setRemoveBg(!hasTransparency(img));
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const processed = useMemo(() => {
    if (!source) return null;
    let img = removeBg ? removeWhiteBackground(source, { paperThreshold: threshold }) : source;
    if (autoCrop) {
      const b = opaqueBounds(img, 8, 2);
      if (b) img = cropImage(img, b);
    }
    return img;
  }, [source, removeBg, threshold, autoCrop]);

  useEffect(() => {
    if (processed && canvasRef.current) rgbaToCanvas(processed, canvasRef.current);
  }, [processed]);

  const heightMm = processed ? (widthMm * processed.height) / processed.width : 0;

  const save = async () => {
    if (!processed) return;
    setSaving(true);
    try {
      const png = await rgbaToPng(processed);
      await onSave({
        id: createId(),
        name: name.trim() || (kind === 'seal' ? '印章' : '签名'),
        kind,
        widthMm,
        heightMm,
        png,
        pixelWidth: processed.width,
        pixelHeight: processed.height,
        createdAt: Date.now(),
        origin: 'import',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={file !== null} onOpenChange={(_, d) => !d.open && onCancel()}>
      <DialogSurface className="import-dialog">
        <DialogBody>
          <DialogTitle>导入印章或签名</DialogTitle>
          <DialogContent>
            <div className="import-layout">
              <div className="import-preview checker">
                {error ? (
                  <Text className="warn">{error}</Text>
                ) : processed ? (
                  <canvas ref={canvasRef} data-testid="import-preview" />
                ) : (
                  <Spinner size="small" label="正在读取图片…" />
                )}
              </div>
              <div className="import-form">
                <Field label="名称" size="small">
                  <Input size="small" value={name} onChange={(_, d) => setName(d.value)} data-testid="import-name" />
                </Field>
                <Field label="类型" size="small">
                  <RadioGroup
                    layout="horizontal"
                    value={kind}
                    onChange={(_, d) => {
                      const k = d.value as SealKind;
                      setKind(k);
                      setWidthMm(DEFAULT_WIDTH[k]);
                    }}
                  >
                    <Radio value="seal" label="印章" />
                    <Radio value="signature" label="签名" />
                  </RadioGroup>
                </Field>
                <NumberField
                  label="实际宽度"
                  unit="mm"
                  value={widthMm}
                  min={5}
                  max={200}
                  step={0.5}
                  hint={processed ? `高度按比例为 ${round(heightMm)} mm。公章通常 38–42 mm。` : undefined}
                  onCommit={setWidthMm}
                />
                <Checkbox checked={removeBg} label="去掉白色背景" onChange={(_, d) => setRemoveBg(d.checked === true)} />
                {removeBg && (
                  <Field label={`去底强度：${threshold}`} hint="纸张发灰、有阴影时调高；笔迹变淡时调低" size="small">
                    <Slider min={10} max={120} value={threshold} onChange={(_, d) => setThreshold(d.value)} />
                  </Field>
                )}
                <Checkbox checked={autoCrop} label="自动裁掉四周空白" onChange={(_, d) => setAutoCrop(d.checked === true)} />
                <Text size={200} className="muted">
                  建议用扫描件或正面平拍的照片，分辨率越高越清晰。图片只保存在本机。
                </Text>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel}>取消</Button>
            <Button appearance="primary" disabled={!processed || saving} onClick={save} data-testid="import-save">
              {saving ? '保存中…' : '加入印章库'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
