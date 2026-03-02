## Context

trip-planner 目前的 CSS 架構分為五個檔案：`shared.css`（全域變數、基底樣式）、`style.css`（行程主頁）、`menu.css`（選單）、`edit.css`（AI 編輯頁）、`setting.css`（設定頁）。

現有問題：
- 主色 `--blue: #C4704F`（棕色）命名與值皆不一致，且不符合暖中性色系目標
- `shared.css` 只定義兩級 font-size（`--fs-lg`、`--fs-md`），其餘五個檔案中散落大量硬編碼 px/rem/em 值
- Dark mode 配色部分來自 `body.dark` 覆蓋，部分散在各 CSS 檔案，缺乏集中管理

本次改版目標：以最小侵入範圍（僅改 CSS）完成全站配色與字型系統升級，不動 HTML/JS/JSON。

## Goals / Non-Goals

**Goals:**
- 在 `shared.css` 集中定義暖中性色彩 CSS variables（light 與 dark 兩套）
- 在 `shared.css` 集中定義四級 font-size CSS variables
- 各 CSS 檔案中的硬編碼 font-size 全面替換為四級變數
- 各 CSS 檔案中的配色改為引用新 CSS variables
- 保持視覺結構不變（版型、間距、圓角不受影響）

**Non-Goals:**
- 不修改任何 HTML、JS、JSON 檔案
- 不調整版型、間距、圓角、box-shadow 等非色彩/字型屬性
- 不引入新的 CSS 框架或預處理器
- Icon 內部細節尺寸（`10px`、`8px` 等）不納入變數系統

## Decisions

### 決策一：CSS Variables 集中於 shared.css

**選擇**：所有色彩與 font-size 變數統一定義在 `shared.css` 的 `:root`（light mode）與 `body.dark`（dark mode）區塊。

**理由**：`shared.css` 已是全站共用入口，其他 CSS 檔案皆在其之後載入，因此在此集中定義可確保所有頁面一致繼承，無需各頁面重複宣告。

**捨棄方案**：在各 CSS 檔案各自定義 — 會造成變數重複、覆蓋順序難以追蹤。

---

### 決策二：舊變數名稱 --blue 改為 --accent，並保留向後相容別名

**選擇**：在 `:root` 中定義 `--accent: #8B8580`，同時保留 `--blue: var(--accent)` 別名過渡，讓現有引用 `--blue` 的選擇器不需同步修改。

**理由**：`--blue` 被多個 CSS 檔案引用，若全部同步修改容易遺漏；保留別名可降低 tasks 中的風險，後續再視情況清理別名。

**捨棄方案**：直接全局搜尋替換 `--blue` → `--accent` — 改動範圍大，若有遺漏會造成色彩失效。

---

### 決策三：font-size 硬編碼對映規則

硬編碼值按以下規則對映至四級變數：

| 硬編碼值 | 替換為 |
|----------|--------|
| `2.5rem` | `var(--fs-display)` |
| `1.4rem`、`1.25rem`、`1.2rem` | `var(--fs-lg)` |
| `1.15rem`、`1rem`、`0.9rem`、`0.9em` | `var(--fs-md)` |
| `0.85rem`、`0.85em`、`0.82rem`、`0.8em`、`0.75rem` | `var(--fs-sm)` |
| `10px`、`8px`（icon 內部） | 維持原值，不替換 |

**理由**：各檔案中的硬編碼值分布在 0.75rem～1.4rem 之間，依視覺比例可合理歸入四級；icon 內部細節屬於 icon 實作，不屬於文字排版系統。

---

### 決策四：card-bg 值調整

Light mode 的 `--card-bg` 從原 `#EDE8E3` 調整為 `#F5F0E8`（更淺暖白），以提升與 `#FFFFFF` 背景的對比層次感，同時維持暖色基調。

## Risks / Trade-offs

**[風險] 視覺回歸** → 暖中性色系與原棕色系色相相近，目測差異小；font-size 統一後部分元素尺寸略有差異（最多 ±1–2px）。透過 Playwright E2E 快照比對降低回歸風險。

**[風險] --blue 別名移除時機** → 本次保留 `--blue: var(--accent)` 別名，未來若清理別名需另起 change。若忘記清理，兩個名稱並存會造成語義混亂。緩解：在 tasks.md 中加入 TODO 備註。

**[風險] font-size 對映邊界模糊** → `0.9rem` 與 `1rem` 同歸 `--fs-md`，部分元素原本刻意區分大小。在 tasks 執行時需逐一目視確認，必要時保留例外並加 comment 說明。

**[Trade-off] 別名而非全面替換** → 保留 `--blue` 別名降低風險，但代價是短期內有兩個名稱指向同一顏色，需在未來 clean-up change 中處理。

## Migration Plan

1. 更新 `shared.css`：新增 `--fs-display`、`--fs-sm`，更新色彩變數，新增 `--accent` 並設 `--blue` 別名
2. 逐一替換各 CSS 檔案的硬編碼 font-size（style.css → menu.css → edit.css → setting.css）
3. 逐一更新各 CSS 檔案的配色引用
4. 執行完整測試（`npm test`），確認 pre-commit hook 通過
5. Commit（不自動 push）

**回滾策略**：git revert 單一 commit 即可還原，因所有變更均集中於 CSS 檔案，不影響 JS/HTML/JSON 邏輯。
