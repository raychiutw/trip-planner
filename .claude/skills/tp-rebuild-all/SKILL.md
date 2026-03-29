---
name: tp-rebuild-all
description: Use when the user wants to run a full quality-rule rebuild across all trip itineraries in one batch operation.
user-invocable: true
---

批次重建所有行程 MD 檔案，逐一執行 R0-R18 品質規則全面重整。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 步驟

1. 掃描 `data/trips-md/` 下所有行程目錄取得行程清單
2. 逐一對每個行程執行 `/tp-rebuild` 的重整邏輯（含 before/after tp-check）
3. 每完成一個行程顯示進度 + tp-check 完整模式 report（after-fix）
4. 全部完成後執行 `npm run build` 更新 dist
5. `npm test` 驗證
6. 不自動 commit（由使用者決定）

## 進度顯示格式

```
處理中：1/4 okinawa-trip-2026-Ray
✓ 完成 1/4：okinawa-trip-2026-Ray
tp-check: 🟢 10  🟡 2  🔴 0

處理中：2/4 okinawa-trip-2026-HuiYun
✓ 完成 2/4：okinawa-trip-2026-HuiYun
tp-check: 🟢 11  🟡 1  🔴 0

...

全部完成！4/4 行程已重整。
npm test 結果：✓ 全部通過
```

僅允許編輯：
  data/trips-md/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

