// 把 pdf.js 运行时需要的静态资源（中文字体映射 CMap、标准字体、解码器 wasm、ICC 色彩配置）
// 从 node_modules 复制到 public/pdfjs/，网页版和桌面版都从这里加载，不依赖任何 CDN。
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = join(pdfjsRoot, dir);
  if (existsSync(src)) cpSync(src, join(target, dir), { recursive: true });
}
console.log(`pdf.js assets → ${target}`);
