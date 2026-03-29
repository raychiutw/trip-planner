---
name: tp-shutdown
description: Use when the user wants to stop the local development server (Vite + wrangler pages dev).
user-invocable: true
---

關閉本機開發伺服器（Vite port 5173 + wrangler port 8788）。

## 步驟

1. 終止 `npm run dev` 啟動的 concurrently 程序
2. 確認 port 5173 和 8788 已釋放

```bash
# Windows
taskkill /F /IM node.exe 2>/dev/null || true
# 或精確找 port
netstat -ano | findstr ":5173\|:8788"
```
