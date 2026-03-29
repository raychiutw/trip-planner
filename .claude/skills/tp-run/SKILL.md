---
name: tp-run
description: Use when the user wants to start the local development server with hot reload, mock auth, and local D1 database.
user-invocable: true
---

啟動本機開發環境（Vite + wrangler pages dev + mock auth + 本機 D1）。

## 步驟

1. 確認 `.env.local` 存在（含 DEV_MOCK_EMAIL + ADMIN_EMAIL）
2. 若本機 D1 未初始化：`npm run dev:init`
3. `npm run dev`（concurrently 啟動 Vite + wrangler pages dev）
4. 前端：http://localhost:5173
5. API：http://localhost:8788（wrangler pages dev，自動 proxy）

## 環境說明

- **認證**：DEV_MOCK_EMAIL 免 Cloudflare Access
- **D1**：本機 SQLite（.wrangler/state/），用 `npm run dev:reset` 重置
- **Staging**：`npm run dev:staging`（連 staging D1）
- **Production**：`npm run dev:prod`（連 production D1，危險）
