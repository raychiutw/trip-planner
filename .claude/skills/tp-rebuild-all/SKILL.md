---
name: tp-rebuild-all
description: Use when batch-rebuilding all trip itineraries to fix quality rule violations.
user-invocable: true
---

批次重建所有行程，逐一執行 R0-R18 品質規則全面重整。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## API 設定

API 設定、curl 模板、Windows encoding 注意事項見 tp-shared/references.md

## 步驟

1. 取得所有行程清單：
   ```bash
   curl -s "https://trip-planner-dby.pages.dev/api/trips"
   ```
2. 逐一對每個行程執行 `/tp-rebuild` 的重整邏輯（含 before/after tp-check）
3. 每完成一個行程顯示進度 + tp-check 完整模式 report（after-fix）
4. 全部完成後顯示總結

## 進度顯示格式

```
處理中：1/7 okinawa-trip-2026-Ray
✓ 完成 1/7：okinawa-trip-2026-Ray
tp-check: 🟢 10  🟡 2  🔴 0

處理中：2/7 okinawa-trip-2026-HuiYun
✓ 完成 2/7：okinawa-trip-2026-HuiYun
tp-check: 🟢 11  🟡 1  🔴 0

...

全部完成！7/7 行程已重整。
```

## 注意事項

- 所有資料讀寫均透過 API，不操作本地檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
