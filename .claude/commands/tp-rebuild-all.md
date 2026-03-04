批次重建所有行程 JSON，逐一執行 R1-R10 品質規則全面重整。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 步驟

1. 讀取 `data/trips.json` 取得所有行程檔案清單
2. 逐一對每個行程執行 `/tp-rebuild` 的重整邏輯（R1-R10）
3. 每完成一個行程顯示進度：`✓ 完成 2/4：okinawa-trip-2026-HuiYun`
4. 全部完成後執行 `npm test` 驗證
5. 不自動 commit（由使用者決定）

## 進度顯示格式

```
處理中：1/4 okinawa-trip-2026-Ray
✓ 完成 1/4：okinawa-trip-2026-Ray

處理中：2/4 okinawa-trip-2026-HuiYun
✓ 完成 2/4：okinawa-trip-2026-HuiYun

...

全部完成！4/4 行程已重整。
npm test 結果：✓ 全部通過
```

✅ 允許修改的檔案：
   data/trips/*.json（僅行程 JSON 檔案）

🚫 其他所有檔案一律不得修改

## 品質規則

完整 R1-R10 品質規則定義在 `/tp-rebuild` skill 中，本 skill 對每個行程套用相同規則。
