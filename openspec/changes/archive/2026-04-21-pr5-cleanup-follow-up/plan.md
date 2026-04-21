# Plan: PR 5 Cleanup Follow-up

## 執行順序

簡單到複雜、risk 低到高排序，同時確保 TDD 紅→綠流程：

```
F005 → F004 → F002 → F003 → F006 → F001 → F007
```

| 順序 | Feature | 理由 |
|------|---------|------|
| 1 | F005 OverflowMenu 簡化 | 純邏輯刪除，risk 最低，先暖身 |
| 2 | F004 onClearSheet optional | 純型別修改，影響範圍明確 |
| 3 | F002 DaySection inline style | Refactor 有 risk，但範圍小（2 處）|
| 4 | F003 TripMapRail singleton | DOM 操作，需仔細驗測試 |
| 5 | F006 TriplineLogo 統一 | 跨 2 個頁面，視覺需手動確認 |
| 6 | F001 Dead CSS 清除 | 需先確認 InfoPanel orphan 狀態，print mode 需驗 |
| 7 | F007 QA script 修正 | 最後修正測試腳本，確認整體 QA 通過 |

---

## Commit 策略

每個 Feature 拆兩個 commit（TDD 要求）：

```
test(f005): OverflowMenu needsDivider 行為斷言 [red]
fix(f005): 移除 action branch，簡化 needsDivider 邏輯 [green]

test(f004): MobileBottomNav without onClearSheet 不 crash [red]
fix(f004): onClearSheet 改 optional prop [green]

test(f002): DaySection DOM 不含 inline style attribute [red]
refactor(f002): DaySection inline style 提升至 CSS class [green]

test(f003): TripMapRail 多次 render 只有一個 style 節點 [red]
refactor(f003): TripMapRail singleton style injection [green]

test(f006): StopDetailPage / MapPage header 含 TriplineLogo [red]
fix(f006): 替換 header inline wordmark 為 TriplineLogo [green]

fix(f001): 清除 tokens.css dead CSS rules [green + cleanup]

fix(f007): QA T8 sticky assert 改為三次 scroll snapshot [green]
```

> F001 可豁免單獨 red test commit（grep-based 測試在 F001.1 完成即視為 red），直接刪除後驗通過

---

## 完成條件（Definition of Done）

- [ ] `npx tsc --noEmit` 零 error
- [ ] `npm test` 全綠（含新增的 F002/F003/F004/F005/F006 測試）
- [ ] QA T8 pass（F007 修正後重跑）
- [ ] print mode 手動確認正常（F001 清除後）
- [ ] 視覺 regression：StopDetailPage / MapPage header logo 大小位置正確（F006）
- [ ] bundle size 未增大（dead CSS 刪除後確認）

---

## 不在此 PR

- tokens.css 其他 refactor（只清 PR 3/4 遺留 dead rules）
- TriplineLogo component 本身 refactor
- 新增 OverflowMenu 功能
- QA script 其他 test case 更新（僅修正 T8）
