---
name: tp-run
description: Use when the user wants to build and start a local development server to preview the trip website at localhost:3000.
user-invocable: true
---

建置並啟動本機開發伺服器，在瀏覽器預覽行程網站。

步驟：
1. `npm run build`（建置所有行程 dist 檔案）
2. `npx serve -l 3000`（背景啟動本機伺服器）
3. 開啟瀏覽器 http://localhost:3000
