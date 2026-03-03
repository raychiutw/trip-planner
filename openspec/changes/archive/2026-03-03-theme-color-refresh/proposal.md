## Why

現有 light mode 配色存在多處視覺問題：accent 色（`#8B8580` 暖灰）飽和度偏低，難以與內容區塊區隔；頁面底色 `#FFFFFF` 與 `--gray-light: #FAF9F7` 數值細微差異導致維護混亂；day-header 在 light mode 下呈現低對比暖灰，視覺辨識度不足；suggestion 卡片的 high/medium 優先度背景（0.08 opacity）在亮色環境下幾乎看不出色差，且 low 優先度以橘色圓點表示語意不直覺；桌機字型未隨螢幕尺寸調整，desktop 視覺密度與行動版相同，顯得寬鬆不精緻。本次改版針對上述五項痛點進行精準修正，不影響 dark mode 既有外觀、HTML 結構與 JS 邏輯。

## What Changes

- **Item 7 — 桌機字型縮小一級**：在 `@media (min-width: 768px)` 中覆蓋四個 font-size 變數，display/lg/md/sm 各縮小一階，行動版維持不變
  - `--fs-display: 2rem`（原 `2.5rem`）
  - `--fs-lg: 1.125rem`（原 `1.25rem`）
  - `--fs-md: 1rem`（原 `1.125rem`）
  - `--fs-sm: 0.8125rem`（原 `0.875rem`）
- **Item 10 — Light mode day-header 改用卡片底色**：day-header 在 light mode 改為 `background: var(--card-bg); color: var(--text);`，以暖米色底色配深色文字取代現有低對比暖灰背景；dark mode 保持 `var(--blue)`（`#C4845E` 橘色）不變
- **Item 12 — Light mode 頁面底色微調**：`--white` 從 `#FFFFFF` 改為 `#FAF9F5`；`--gray-light` 從 `#FAF9F7` 改為 `#FAF9F5`，兩值對齊消除維護歧義；`--card-bg: #F5F0E8` 不變，保留卡片與底色之間的層次對比
- **Item 17 — Suggestion 優先度色彩強化**：
  - High/medium 亮色背景 opacity 從 `0.08` 提高至 `0.15`
  - Low 優先度新增亮色背景 `rgba(34, 197, 94, 0.10)` / 深色背景 `rgba(34, 197, 94, 0.15)`
  - Low 圓點從橘色 `#F97316` 改為綠色 `#22C55E`
- **Item 18 — Light mode accent 改為 Claude 橘**：`--accent` 從 `#8B8580` 改為 `#C4956A`；dark mode `--accent: #C4845E` 不變；edit 頁 send 按鈕改為圓形箭頭上傳風格，disabled 狀態使用灰色

## Scope

**包含：**
- `css/shared.css`：Item 7（桌機 font-size media query）、Item 12（`--white`、`--gray-light` 值）、Item 18（light mode `--accent`）
- `css/style.css`：Item 10（light mode day-header 覆蓋規則）、Item 17（suggestion 背景 / 圓點色彩）
- `css/edit.css`：Item 18（send 按鈕圓形箭頭樣式、disabled 灰色）

**不包含：**
- Dark mode 任何變更（`body.dark` 所有值維持不變）
- HTML 結構變更
- JS / JSON 邏輯變更
- 任何測試檔案新增或修改（純 CSS 視覺調整，無 render 函式變更）
