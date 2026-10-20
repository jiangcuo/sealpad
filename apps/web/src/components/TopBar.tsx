import { Button, Text, Tooltip } from '@fluentui/react-components';
import {
  ArrowDownloadRegular,
  FolderOpenRegular,
  InfoRegular,
  PageFitRegular,
  ZoomInRegular,
  ZoomOutRegular,
} from '@fluentui/react-icons';

interface Props {
  docName: string | null;
  zoom: number;
  canExport: boolean;
  onOpen(): void;
  onExport(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onFit(): void;
  onAbout(): void;
}

export function TopBar(props: Props) {
  const hasDoc = props.docName !== null;
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./favicon.svg" alt="" width={24} height={24} />
        <Text weight="semibold" size={400}>
          印台
        </Text>
        <Text size={200} className="brand-en">
          SealPad
        </Text>
      </div>
      <div className="topbar-actions">
        <Tooltip content="打开 PDF（Ctrl+O）" relationship="description">
          <Button appearance="subtle" icon={<FolderOpenRegular />} onClick={props.onOpen}>
            打开
          </Button>
        </Tooltip>
        <Tooltip content="导出盖章后的 PDF（Ctrl+S）" relationship="description">
          <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={props.onExport} disabled={!props.canExport}>
            导出 PDF
          </Button>
        </Tooltip>
      </div>
      <div className="topbar-doc" title={props.docName ?? undefined}>
        {props.docName && <Text truncate wrap={false}>{props.docName}</Text>}
      </div>
      <div className="topbar-zoom">
        <Tooltip content="缩小" relationship="label">
          <Button appearance="subtle" icon={<ZoomOutRegular />} onClick={props.onZoomOut} disabled={!hasDoc} />
        </Tooltip>
        <Tooltip content="按真实尺寸显示（100%）" relationship="description">
          <Button appearance="subtle" className="zoom-label" onClick={props.onZoomReset} disabled={!hasDoc}>
            {Math.round(props.zoom * 100)}%
          </Button>
        </Tooltip>
        <Tooltip content="放大" relationship="label">
          <Button appearance="subtle" icon={<ZoomInRegular />} onClick={props.onZoomIn} disabled={!hasDoc} />
        </Tooltip>
        <Tooltip content="适合宽度" relationship="label">
          <Button appearance="subtle" icon={<PageFitRegular />} onClick={props.onFit} disabled={!hasDoc} />
        </Tooltip>
        <Tooltip content="关于与使用须知" relationship="label">
          <Button appearance="subtle" icon={<InfoRegular />} onClick={props.onAbout} />
        </Tooltip>
      </div>
    </header>
  );
}
