import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { App } from './App.tsx';
import './app.css';

function usePrefersDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

function Root() {
  const dark = usePrefersDark();
  return (
    // 不要给 FluentProvider 加 className：Fluent 会把它复制到弹窗、提示的 portal 节点上，
    // 让 portal 也变成全屏高度并挡住点击。根节点高度在 app.css 里用 #root > .fui-FluentProvider 设置。
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme}>
      <App />
    </FluentProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
