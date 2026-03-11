## Context

edit.html 字級整體比行程頁小一級，需對齊。僅修改 `css/edit.css`，不動 HTML/JS。

## Goals / Non-Goals

**Goals:**
- 編輯頁字級與行程頁同類元素對齊
- 通過 css-hig.test.js 全部規則

**Non-Goals:**
- 不改 badge 類字級（`.issue-badge`、`.issue-mode-badge` 維持 `--fs-caption`）
- 不改 HTML 結構或 JS 邏輯
- 不調整 shared.css token 定義

## Decisions

### D1: 標題對齊 `.tl-title` 但 mobile 用 `--fs-callout`

行程頁 `.tl-title` 統一用 `--fs-title3`（1.25rem），但 issue 標題常為完整句子（比景點名長），mobile 用 `--fs-callout`（1rem）更合適，desktop 則完整對齊為 `--fs-title3`。

### D2: 回覆本文用 `--fs-body` 與行程頁內容文字一致

行程頁的 `.tl-body`、`.col-detail`、`.info-box` 等內容區域皆用 `--fs-body`。回覆區是 edit 頁的主要閱讀區域，對齊為 `--fs-body` 提升可讀性。

### D3: code 元素用 `--fs-callout` 維持視覺比例

回覆本文升至 `--fs-body` 後，code 維持 `--fs-footnote` 會過小。改用 `--fs-callout`（比 body 小一級）維持正常比例。

### D4: Mode pill 升至 `--fs-callout`

行程頁 `.dn` 按鈕為 `--fs-body`，mode pill 作為同層級操作元素，從 `--fs-footnote` 升至 `--fs-callout` 較合適。

## 字級對照表

| 元素 | 修改前 | 修改後 | 行程頁參考 |
|------|--------|--------|-----------|
| `.issue-item-title` (mobile) | `--fs-footnote` | `--fs-callout` | `.tl-title` = `--fs-title3` |
| `.issue-item-title` (≥768px) | `--fs-body` | `--fs-title3` | `.tl-title` = `--fs-title3` |
| `.issue-item-body` | `--fs-footnote` | `--fs-callout` | `.tl-desc` = `--fs-callout` |
| `.issue-item-meta` | `--fs-caption` | `--fs-footnote` | `.tl-duration` = `--fs-footnote` |
| `.issue-reply` | `--fs-footnote` | `--fs-body` | `.tl-body` = `--fs-body` |
| `.issue-reply code` | `--fs-footnote` | `--fs-callout` | 比本文小一級 |
| `.edit-mode-pill` | `--fs-footnote` | `--fs-callout` | `.dn` = `--fs-body` |
