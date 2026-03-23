---
name: tp-rebuild-all
description: 批次重建所有行程 MD 檔案，逐一執行品質規則全面重整。適用於全域規則更新後需要同步所有行程內容時。
---

# tp-rebuild-all

批次重建所有行程 MD 檔案，逐一執行品質規則全面重整。

## 步驟
1. **掃描行程**：掃描 `data/trips-md/` 下所有行程目錄。
2. **逐一重整**：對每個行程執行 `tp-rebuild` 技能。
3. **顯示進度**：每完成一個行程顯示進度及 `tp-check` Report。
4. **執行 Build**：全部完成後執行 `npm run build` 更新 dist。
5. **跑測試**：執行 `npm test` 驗證。
6. **不自動 commit**：由使用者決定。

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
