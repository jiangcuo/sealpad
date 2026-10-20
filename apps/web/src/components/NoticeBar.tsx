import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';

export interface Notice {
  intent: 'info' | 'success' | 'warning' | 'error';
  title: string;
  text: string;
}

export function NoticeBar({ notice, onDismiss }: { notice: Notice; onDismiss(): void }) {
  return (
    <div className="notice">
      <MessageBar intent={notice.intent} layout="multiline">
        <MessageBarBody>
          <MessageBarTitle>{notice.title}</MessageBarTitle>
          {notice.text}
        </MessageBarBody>
        <MessageBarActions
          containerAction={<Button appearance="transparent" aria-label="关闭" icon={<DismissRegular />} onClick={onDismiss} />}
        />
      </MessageBar>
    </div>
  );
}
