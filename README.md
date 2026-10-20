<p align="center">
  <img src="apps/desktop/icon.svg" width="96" alt="印台 SealPad" />
</p>

<h1 align="center">印台 SealPad</h1>

<p align="center">离线、开源的 PDF 盖章与签名工具。文件只在你的电脑上处理，不上传、不需要账号。</p>

<p align="center">
  <a href="https://github.com/jiangcuo/sealpad/actions/workflows/ci.yml"><img src="https://github.com/jiangcuo/sealpad/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
</p>

<p align="center">简体中文 · <a href="README.en.md">English</a></p>

---

## 能做什么

- **按真实尺寸盖章**：页面和印章都以毫米计算，42 mm 的公章打印出来就是 42 mm。支持拖动、缩放、旋转、方向键微调，也可以直接输入毫米数。
- **骑缝章**：左侧或右侧，可设置页码范围、跳过封面、双面打印只盖奇数页、垂直位置；页数太多时可以分组，每组盖一枚完整的章。导出时把印章真正切开，每页只嵌入属于自己的那一条。
- **印章库**：导入扫描件或照片，自动去掉白色背景、裁掉空白，保存在本机。
- **每页都盖**：一键把同一个印章或签名盖到所有页面的相同位置。
- **网页版和桌面版**：同一套界面。网页版打开即用；桌面版（Windows / macOS / Linux）使用系统文件对话框，后续会加入扫码手写签名、Word 导入、数字签名等只有桌面端能做的功能。

## 使用

| 版本 | 地址 | 说明 |
| --- | --- | --- |
| 网页版 | https://jiangcuo.github.io/sealpad/ | 纯前端，文件不离开浏览器 |
| 桌面版 | [Releases](https://github.com/jiangcuo/sealpad/releases) | Windows 10/11（x64、ARM64）、macOS 12+、Linux（AppImage / deb） |

> 桌面版安装包暂未签名。Windows 首次运行可能出现 SmartScreen 提示，macOS 需要在「系统设置 → 隐私与安全性」里允许打开。

## 使用须知

1. **只能制作和使用本人或本单位有权使用的印章和签名。** 伪造、变造他人印章属于违法行为，责任由使用者承担。
2. 在 PDF 上贴印章图片，**不等于**具有法律效力的电子签章。需要防篡改和法律效力时，应使用基于数字证书的电子签名（见路线图第四阶段）。
3. 印台不联网、不收集任何数据。印章和文档都只保存在你的设备上。

## 路线图

- [x] **第一阶段（MVP）**：导入 PDF、预览、真实尺寸拖放印章、骑缝章、导出；导入图片印章并去白底
- [ ] **第二阶段：印章与签名**
  - 印章设计器：公章、合同章、财务章、发票章、名章等预设模板，文字转路径保存为 SVG（使用思源宋体等开源字体）
  - 扫码手写签名（桌面版）：电脑开启一次性局域网服务，手机扫码手写后上传；带随机 token、5 分钟过期、签完即关
  - 鼠标 / 触控板手写签名，压感笔迹平滑
  - 导出时可选的印泥仿真效果（随机浓淡、毛边）
- [ ] **第三阶段：Word 与批量**
  - Word 导入（桌面版）：Windows 调用 Word，其他平台调用 LibreOffice 转成 PDF
  - 按「甲方」「乙方」「盖章」「日期」等关键词自动建议盖章位置
  - 同一模板批量盖章
- [ ] **第四阶段：安全与法律效力**
  - PAdES 数字签名 + 文档锁定（DocMDP），增量保存不破坏已有签名
  - 防提取：带章页面整体转为图片
  - 印章加密存储、使用前输入 PIN、用章日志（时间、文档名、文档哈希）

## 开发

需要 Node.js 22.13+ 和 pnpm 10。桌面版另外需要 Rust stable 和 [Tauri 2 的系统依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
pnpm install

pnpm dev            # 网页版开发服务器 http://localhost:5173
pnpm test           # 核心库单元测试
pnpm typecheck      # 类型检查
pnpm build          # 构建网页版到 apps/web/dist
pnpm e2e            # 端到端测试（先运行 pnpm build，首次需要 pnpm --filter @sealpad/web exec playwright install chromium）

pnpm desktop:dev    # 桌面版开发模式
pnpm desktop:build  # 打包桌面版安装包
```

### 目录结构

```
packages/core     纯 TypeScript 核心库：坐标换算、骑缝章切分、去白底、PDF 盖章导出（浏览器和 Node 都能跑）
apps/web          React + Fluent UI 界面；网页版和桌面版共用
apps/desktop      Tauri 2 桌面壳（Rust），前端直接使用 apps/web 的构建结果
docs/design.md    设计文档
```

设计思路、坐标系约定和各阶段的技术方案见 [docs/design.md](docs/design.md)。

## 许可证

[Apache-2.0](LICENSE)。依赖均为宽松许可（pdf.js：Apache-2.0；pdf-lib、React、Fluent UI：MIT；Tauri：MIT / Apache-2.0），不引入 AGPL 等传染性许可的库。
