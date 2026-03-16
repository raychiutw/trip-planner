---
name: tp-rebuild
description: Use when the user wants to fully audit and fix all quality rule violations in a single trip itinerary without changing the timeline order or adding/removing stops.
user-invocable: true
---

全面重整單一行程 MD 檔案，依 R0-R15 品質規則逐項檢查並修正。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 輸入方式

- 指定 tripId：`/tp-rebuild okinawa-trip-2026-Ray`
- 未指定：讀取 `data/dist/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips-md/{tripId}/` 下的所有 MD 檔案
2. **tp-check（before-fix）**：執行完整模式 report，顯示修正前的品質狀態
3. 逐項檢查 R0-R15 品質規則（定義在 `tp-quality-rules` skill 中），修正不合格的 MD 內容
4. 同步更新 checklist.md、backup.md、suggestions.md
5. 確認 travel 分鐘數
6. 執行 `npm run build` 更新 dist
7. 執行 `git diff --name-only`：
   → 只有 `data/trips-md/{tripId}/**` + `data/dist/**` → OK
   → 有其他檔案被改 → `git checkout` 還原非白名單檔案
8. `npm test`
9. **tp-check（after-fix）**：執行完整模式 report，確認修正結果
10. 不自動 commit（由使用者決定）

## 重整範圍

檢查現有行程 MD 的每個欄位是否符合 R0-R15，修正不符規則的部分。
**不改 timeline 順序、不新增/移除景點**，只確保現有內容符合品質規則。

僅允許編輯：
  data/trips-md/{tripId}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

## 品質規則參照

完整 R0-R15 品質規則定義在 `tp-quality-rules` skill 中。
