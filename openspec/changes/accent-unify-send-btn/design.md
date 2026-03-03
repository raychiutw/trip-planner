## Context

全站 CSS 變數 `--accent` 與瀏覽器 theme-color meta 目前使用不同色碼。CSS 用 `#C4956A`（奶茶棕），theme-color 用 `#C4704F`（赤陶橘）。edit 頁送出按鈕使用紙飛機 SVG，需改為 filled 向上箭頭以符合現代 chat UI 風格。

現有色彩宣告位置：
- `shared.css :root` — `--accent: #C4956A; --sand: #C4956A`
- `shared.css body.dark` — `--accent: #C4845E; --sand: #D4A373`
- `style.css .print-mode` — 硬寫 `--sand: #C4956A`
- `style.css @media print body` — 硬寫 `--sand: #C4956A`
- `style.css body.dark .info-fab` — fallback `#C4704F`
- `edit.html` — 送出按鈕 inline SVG（紙飛機 path）

## Goals / Non-Goals

**Goals:**
- 統一 `--accent` 與 theme-color 為同一色系（`#C4704F` 赤陶橘）
- 深色模式 accent 調整為同色相提亮版（`#D4845E`），維持可讀性
- edit 頁送出按鈕改為 filled 向上箭頭 SVG
- 所有硬寫的舊色碼同步更新

**Non-Goals:**
- 不改動 theme-color meta 的 JS 邏輯（已經是 `#C4704F`）
- 不改動按鈕尺寸、hover/active 效果、disabled 邏輯
- 不將箭頭 icon 加入 icons.js（僅 edit 頁使用，inline 即可）
- 不調整 `--blue-light`、`--sand-light` 等衍生色（後續可微調）

## Decisions

### 1. 淺色模式 accent 採用 `#C4704F`

**選擇**：直接使用已存在的 theme-color 色碼
**替代方案**：從 Claude App 截圖取色（約 `#D4825A`）
**理由**：`#C4704F` 已經在三個 HTML 的 meta tag 和 JS 中使用。統一到同一色碼最簡單、最一致，不需改動任何 JS。

### 2. 深色模式 accent 採用 `#D4845E`

**選擇**：將 `#C4704F` 的色相（H≈17°）保持不變，提高亮度到 L≈60%
**替代方案**：維持原 `#C4845E` 不動
**理由**：原色 `#C4845E` 色相偏黃（H≈20°），調整為 `#D4845E` 讓深淺模式同色相，視覺連貫。同時亮度足夠在 `#1A1A1A` 背景上保持可讀。

### 3. 送出按鈕 SVG 採用 inline filled 向上箭頭

**選擇**：直接在 `edit.html` 替換 SVG path，不進 icons.js
**替代方案**：在 icons.js 註冊 `arrow-up` icon，用 `iconSpan('arrow-up')`
**理由**：此圖示僅 edit 頁送出按鈕使用，沒有全站復用需求。Inline SVG 最簡單，且按鈕已經用 inline SVG。

### 4. `--sand` 變數同步更新

`--sand` 目前等於 `--accent`（淺色 `#C4956A`、深色 `#D4A373`），需一併更新：
- 淺色：`#C4956A` → `#C4704F`
- 深色：`#D4A373` → `#D4A070`（微調同色相）
- print-mode 硬寫值同步

## Risks / Trade-offs

- **全站色調變化明顯** — accent 從奶茶棕變赤陶橘，所有使用 `var(--accent)` 的元素都會變色（nav pills、active borders、連結等）。→ 這是預期行為，使用者已確認要此方向。
- **衍生色可能需微調** — `--blue-light`（`#F5EDE8`）、`--sand-light`（`#F5EDE0`）是基於舊 accent 調配的淺底色，換色後可能不夠和諧。→ 先不動，視覺驗收後再微調。
- **E2E 測試斷言** — 若測試中有 accent 色碼硬寫斷言會失敗。→ 實作時搜索確認。
