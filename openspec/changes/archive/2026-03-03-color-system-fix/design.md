## Context

全站色彩系統以 `css/shared.css` 的 `:root` 與 `body.dark` 為核心，其他 CSS 檔案引用變數。目前存在三大結構性問題：

1. **變數設計缺陷**：`--gray-light` 與 `--white` 同為 `#FAF9F5`，導致用 `--gray-light` 做邊線、背景的元素不可見
2. **缺乏語意色與 hover 變數**：紅/綠狀態色與互動 hover 全部硬寫，深淺模式各自為政
3. **深色模式覆蓋寫法不一致**：部分用 `!important` 硬寫、部分缺 override、部分 specificity 衝突

CSS 檔案架構維持不變：shared.css（變數）→ menu.css / style.css / edit.css / setting.css

## Goals / Non-Goals

**Goals:**
- 所有色彩都由 `shared.css` 的 CSS 變數控制，消除硬寫色碼
- 淺色/深色模式行為對稱一致
- 新增 `--hover-bg` 統一 hover 互動底色
- 新增語意色變數（`--error`、`--error-bg`、`--success`）
- 修正所有已知的對比度、不可見元素、specificity 問題
- 維持測試全過

**Non-Goals:**
- 不改變現有色彩風格（暖中性色系）
- 不調整 accent 色（已在 accent-unify-send-btn 完成）
- 不新增 JS 邏輯
- 不改動 JSON 資料結構
- 不處理 print mode 細節（僅確保深色列印不破版）

## Decisions

### D1：`--gray-light` 改值而非移除

**選擇**：將 `--gray-light` 從 `#FAF9F5` 改為 `#EDEBE8`（淺色），深色維持 `#343130`。

**替代方案**：移除 `--gray-light` 全部改用 `--border` 或 `--card-bg`。

**理由**：`--gray-light` 在 13 處被引用（scrollbar、menu-drawer、sidebar border、color-mode-card 等），直接改值最小侵入性。新值 `#EDEBE8` 介於 `--white`(`#FAF9F5`) 和 `--card-bg`(`#F5F0E8`) 之間，提供足夠區分。

### D2：三層色彩層級體系

建立明確的背景色層級：

```
淺色模式                          深色模式
Level 0: --bg (#FAF9F5)          Level 0: --bg (#1A1A1A)
Level 1: --card-bg (#F5F0E8)     Level 1: --card-bg (#2B2B2B)
Level 2: --hover-bg (#EDE8E0)    Level 2: --hover-bg (#3D3A37)
```

`--hover-bg` 是新變數，用於所有互動 hover 底色，取代散落各處的硬寫值。

**替代方案**：不新增變數，直接用 `--blue-light`。

**理由**：`--blue-light` 語意不明確（名稱暗示藍色但實際是暖淺色），且深色模式 `--blue-light: #302A25` 與 `--card-bg: #2B2B2B` 差距過小（hover 幾乎看不出）。新增專用 `--hover-bg` 語意更清晰。

### D3：語意色用 CSS 變數定義於 shared.css

```css
:root {
    --error: #D32F2F;
    --error-bg: #FFEBEE;
    --success: #10B981;
}
body.dark {
    --error: #FCA5A5;
    --error-bg: rgba(220, 38, 38, 0.12);
    --success: #6EE7B7;
}
```

**替代方案**：語意色不做變數，保持硬寫。

**理由**：同一語意色（如紅色警告）在 5+ 處使用，且深淺模式需要不同值。變數化後維護方便，也利於未來新增主題。

### D4：map-link hover 策略

**淺色模式**：hover 改為 `background: var(--hover-bg); color: var(--text)`（從暗色翻轉改為同調加深）。
**深色模式**：hover 改為 `background: var(--hover-bg); color: var(--text)`。

**替代方案**：保留原深色翻轉設計。

**理由**：原 `#333` 翻轉在暖白頁面上視覺跳動太大，不符合全站柔和 hover 風格。全站其他 hover（`.col-row`、`.menu-item`、`.sidebar-toggle`）都用底色加深而非翻轉。

### D5：edit-send-btn 深色修正方式

**選擇**：將 `body.dark .edit-send-btn` 改為 `body.dark .edit-send-btn:disabled`，只覆蓋 disabled 狀態。

**替代方案**：提高 `:not(:disabled)` 的 specificity。

**理由**：限定 `:disabled` 是最小改動、最清晰的語意表達，不需要 specificity hack。

### D6：opacity 移除策略

**選擇**：`.hw-update-time` 和 `.countdown-date` 移除 `opacity: 0.7`，改用 `color: var(--text-muted)`。

**理由**：`opacity` 疊加在已經對比度不足的 `--gray` 上更糟。`--text-muted` 已經傳達「次要」語意。

## Risks / Trade-offs

- **[視覺微調]** `--gray-light` 改值後 menu-drawer、scrollbar、color-mode-card 的外觀會微變 → 預期中的改善，不是副作用
- **[測試斷言]** 部分 unit test 可能硬寫舊色碼 → 搜索並更新，commit 前 pre-commit hook 會攔截
- **[E2E snapshot]** Playwright 截圖可能因顏色改變而失敗 → 需要更新 baseline
- **[map-link hover 風格改變]** 從暗色翻轉改為底色加深，視覺感受不同 → 與全站一致的改善
