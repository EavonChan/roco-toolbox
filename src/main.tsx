import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// 设计 tokens（DESIGN1，2026-11-28）：只定义 :root 变量，不加任何选择器规则，
// 现有页面的 class 生成结果与渲染结果都不变；原语（src/ui/kit）与后续区块从这里取值。
import './ui/kit/tokens.css';
import './index.css';
import { reloadWhenUpdated } from './pwa/autoUpdate';

// 部署新版本后自动刷新一次，省得手机用户自己找"刷新"（旧页面跑的是旧 JS）
if ('serviceWorker' in navigator) {
  reloadWhenUpdated({
    controlled: navigator.serviceWorker.controller !== null,
    subscribe: (onChange) => navigator.serviceWorker.addEventListener('controllerchange', onChange),
    reload: () => window.location.reload(),
  });
}

/**
 * 小组页纯本地预览（2026-11-19）：`npm run dev` 打开 `?mock=group` 即可。
 * 假后端必须在首屏渲染前装好，否则第一轮请求会打到真实服务端（开发环境会连正式站）。
 * 生产构建里 DEV 恒为 false，这个分支连同 `src/dev/**` 都不会进包。
 */
async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')) {
    await import('./dev/mockGroup').then((module) => module.installGroupMock());
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
