import { useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import { DeleteRegular, ImageAddRegular, SparkleRegular } from '@fluentui/react-icons';
import { round, type SealAsset } from '@sealpad/core';

export const SEAL_DRAG_TYPE = 'application/x-sealpad-seal';

interface Props {
  seals: SealAsset[];
  urls: Map<string, string>;
  persistent: boolean;
  canStamp: boolean;
  onImport(): void;
  onAddSample(): void;
  onStamp(id: string): void;
  onDelete(id: string): void;
}

export function SealLibrary(props: Props) {
  const [pendingDelete, setPendingDelete] = useState<SealAsset | null>(null);
  return (
    <aside className="panel panel-left" aria-label="印章库">
      <div className="panel-header">
        <Text weight="semibold">印章库</Text>
        <Button size="small" appearance="primary" icon={<ImageAddRegular />} onClick={props.onImport}>
          导入
        </Button>
      </div>
      {!props.persistent && (
        <Text size={200} className="panel-hint warn">
          当前浏览器禁用了本地存储，印章库在关闭页面后会清空。
        </Text>
      )}
      {props.seals.length === 0 ? (
        <div className="library-empty">
          <Text size={300}>还没有印章或签名</Text>
          <Text size={200} className="muted">
            导入扫描或拍照的印章、签名图片，白色背景会自动去掉。
          </Text>
          <Button icon={<SparkleRegular />} onClick={props.onAddSample}>
            添加示例印章
          </Button>
        </div>
      ) : (
        <ul className="seal-list">
          {props.seals.map((seal) => (
            <li
              key={seal.id}
              className="seal-item"
              draggable={props.canStamp}
              onDragStart={(e) => {
                e.dataTransfer.setData(SEAL_DRAG_TYPE, seal.id);
                e.dataTransfer.effectAllowed = 'copy';
                const img = e.currentTarget.querySelector('img');
                if (img) e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
              }}
              data-testid="seal-item"
            >
              <div className="seal-thumb checker">
                <img src={props.urls.get(seal.id)} alt={seal.name} draggable={false} />
              </div>
              <div className="seal-meta">
                <Text weight="semibold" size={300} truncate wrap={false} title={seal.name}>
                  {seal.name}
                </Text>
                <div className="seal-sub">
                  <Badge size="small" appearance="tint" color={seal.kind === 'seal' ? 'danger' : 'informative'}>
                    {seal.kind === 'seal' ? '印章' : '签名'}
                  </Badge>
                  <Text size={200} className="muted">
                    {round(seal.widthMm)} × {round(seal.heightMm)} mm
                  </Text>
                </div>
                <div className="seal-actions">
                  <Tooltip content="盖到当前页，也可以直接拖到页面上" relationship="description">
                    <Button size="small" disabled={!props.canStamp} onClick={() => props.onStamp(seal.id)}>
                      盖章
                    </Button>
                  </Tooltip>
                  <Tooltip content="从印章库删除" relationship="label">
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      aria-label={`删除 ${seal.name}`}
                      onClick={() => setPendingDelete(seal)}
                    />
                  </Tooltip>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Text size={200} className="panel-foot muted">
        印章只保存在这台设备上。仅限使用本人或本单位有权使用的印章。
      </Text>
      <Dialog open={pendingDelete !== null} onOpenChange={(_, d) => !d.open && setPendingDelete(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除印章</DialogTitle>
            <DialogContent>
              从印章库删除「{pendingDelete?.name}」？当前文档里用到它的印章也会一并移除。
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingDelete(null)}>取消</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  if (pendingDelete) props.onDelete(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </aside>
  );
}
