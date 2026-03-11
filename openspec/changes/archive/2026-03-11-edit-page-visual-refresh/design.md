## Context

edit.html 的 CSS 目前以功能為主、裝飾為輔。issue 項目只有 `padding: 12px 0` 無背景，回覆直接接在問題體下方，空白狀態是純文字。整體風格與 index.html 的卡片化設計不一致。本次僅修改 `css/edit.css`，不動 HTML/JS，所有改善透過 CSS 屬性調整實現。

## Goals / Non-Goals

**Goals:**
- Issue 項目視覺卡片化，與 index.html 的 section 卡片風格一致
- Reply 與問題體之間有明確的視覺分隔
- 空白狀態更有存在感
- Mode pill selected 狀態可區辨性更強
- 所有變更通過 css-hig.test.js 12 條規則
- Dark mode 自動相容（優先靠 token 覆寫，減少 `body.dark` 規則）

**Non-Goals:**
- 不改 HTML 結構或 JS 邏輯
- 不新增 CSS 檔案
- 不調整 shared.css token 定義
- 不做 responsive layout 重構

## Decisions

### D1: Issue 卡片用 `--bg-secondary` 而非 `--accent-bg`

`--accent-bg` 太強烈（暖橘底），用於少量高亮元素（badge、active pill）。`--bg-secondary` 是 index.html section 卡片的標準底色，視覺統一且 dark mode 自動相容。

### D2: Reply 分隔用 `border-top` 而非獨立容器

Reply HTML 由 JS 動態生成，無法包在額外 wrapper 裡。`border-top: 1px solid var(--border)` 配合 `padding-top: 12px` 是最簡潔的方案，不需改 HTML。

### D3: Input Card 統一用 `--bg-secondary`

原本 light 用 `var(--bg)`（= 頁面底色，無區分）、dark 用 `var(--bg-secondary)`。統一後 light 下 input card 有微妙的層次感（`#F5F0E8` vs 頁面 `#FAF9F5`），且可刪除 `body.dark .edit-input-card` 覆寫規則。

### D4: Badge 色值調整而非引入新 token

issue 狀態 badge 的 GitHub 綠/紫是品牌色，不適合抽成全域 token。直接調整 hex 值並補 `body.dark` 覆寫，與 `.issue-mode-badge.mode-plan` 的做法一致。

### D5: Send button 用 `transform: scale()` 微動畫

Disabled → enabled 狀態切換時，按鈕從 0.92 放大到 1.0，配合色彩 transition 增加觸感。`transform` 不影響 layout（不觸發 reflow），效能優於 `width/height` 動畫。

### D6: Nav spacer 改用 `var(--tap-min)` 精確置中

現行 `::before` spacer 36px 與 close btn 44px 不等，標題偏移 4px。改用 `var(--tap-min)` 精確匹配。

## Risks / Trade-offs

- **卡片化增加 DOM paint 面積** → 影響極小，`--bg-secondary` 為純色無漸層，GPU composite 無負擔
- **Badge dark mode hex 值維護成本** → 已有先例（`.issue-mode-badge.mode-plan`），可接受
- **Input card `--bg-secondary` 在 light mode 可能太深** → 實際色差僅 `#FAF9F5` vs `#F5F0E8`，微妙可辨但不突兀；若不滿意可回退為 `var(--bg)`
