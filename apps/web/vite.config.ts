import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 网页版部署到 GitHub Pages 的子路径，桌面版从 Tauri 本地协议加载，
// 统一用相对路径就都能工作。
export default defineConfig({
  base: process.env.SEALPAD_BASE ?? './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
});
