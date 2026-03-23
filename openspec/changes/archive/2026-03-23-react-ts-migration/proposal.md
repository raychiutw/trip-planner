## Why

前端從 vanilla HTML/CSS/JS 遷移到 React + TypeScript，獲得組件化、型別安全、更好的 IDE 支援和可維護性。API 層（Pages Functions）已是 TypeScript，前端補齊後全棧 TS。CSS 保持不變（已有完整 HIG token 系統）。

## What Changes

- 導入 Vite + React + TypeScript 建置工具鏈
- 4 個 HTML 頁面改為 4 個 React 入口（多入口 Vite build，保留 Cloudflare Access 路徑保護）
- `js/app.js`（1,789 行）拆解為 ~15 個 React 組件
- `js/setting.js`、`js/manage.js`、`js/admin.js` 各自轉為 React 頁面組件
- `js/shared.js`、`js/icons.js`、`js/map-row.js` 轉為 TypeScript 模組
- 測試從手動 innerHTML 改為 Vitest + React Testing Library
- Cloudflare Pages build command 從無 build 改為 `vite build`
- 現有 CSS 檔案保持不變，透過 import 引入

## Capabilities

### New Capabilities
- `vite-react-setup`: Vite + React + TS 多入口建置架構、Cloudflare Pages 整合
- `react-components`: 前端組件化（pages、components、hooks、types）
- `react-testing`: Vitest + React Testing Library 測試架構

### Modified Capabilities

## Impact

- **前端**：`js/` 全部 → `src/`（TSX），`index.html` 等 4 個 HTML 改為 Vite 入口
- **CSS**：不改，改 import 路徑
- **API Functions**：不改
- **測試**：`tests/unit/` 和 `tests/integration/` 全部重寫
- **建置**：新增 `vite.config.ts`、`tsconfig.json`，`package.json` 加依賴
- **部署**：Cloudflare Pages build command 改為 `vite build`
