import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link,
  Text,
} from '@fluentui/react-components';

interface Props {
  open: boolean;
  firstRun: boolean;
  onClose(): void;
}

export function AboutDialog({ open, firstRun, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !firstRun && onClose()} modalType={firstRun ? 'alert' : 'modal'}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{firstRun ? '使用须知' : '关于印台 SealPad'}</DialogTitle>
          <DialogContent className="about">
            <Text>印台是一个离线、开源的 PDF 盖章与签名工具。使用前请确认：</Text>
            <ol>
              <li>
                <strong>只能制作和使用本人或本单位有权使用的印章和签名。</strong>
                伪造、变造他人印章属于违法行为，责任由使用者自行承担。
              </li>
              <li>
                在 PDF 上贴印章图片，<strong>不等于</strong>具有法律效力的电子签章。需要防篡改和法律效力时，应使用基于数字证书的电子签名（已列入路线图）。
              </li>
              <li>所有文件和印章都只在这台设备上处理和保存，不会上传，也不收集任何使用数据。</li>
            </ol>
            <Text size={200} className="muted">
              Apache-2.0 开源 ·{' '}
              <Link href="https://github.com/jiangcuo/sealpad" target="_blank" rel="noreferrer">
                github.com/jiangcuo/sealpad
              </Link>
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose} data-testid="about-ok">
              {firstRun ? '我已了解' : '关闭'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
