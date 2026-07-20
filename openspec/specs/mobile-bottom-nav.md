> # ⛔ SUPERSEDED（2026-07-20）
>
> **本文件已整份過時，不再是規格。** 現行來源：`DESIGN.md`（§Navigation / §Material & Effects）
> 與 `openspec/specs/css-hig-discipline/spec.md`。
>
> 過時之處（非窮舉，說明為何不逐行保養而是整份退役）：
> - **Tab 組成錯的**：本文寫「行程 / 地圖 / 訊息 / 更多」，現行 primary IA 是
>   **聊天 / 行程 / 地圖 / 收藏**（單一來源 `src/components/shell/navItems.ts`）。
> - **形制錯的**：本文寫 `grid-template-columns: repeat(4, 1fr)` 滿版 bar，
>   現行是 HIG iOS 26 **浮動膠囊**（flex + `--chrome-inset` 21px + `radius-full`）。
> - **材質錯的**：本文規定 `rgba(255,255,255,0.97)` + `blur(var(--blur-glass))`（14px）
>   並「不允許 `blur()` 值偏離 `var(--blur-glass)`」。`--blur-glass` 已於 Regular Glass
>   收斂中**退役**，材質改由 `--glass-tint` / `--glass-filter` 等六個 token 承載。
> - **選擇器錯的**：本文用 `.ocean-bottom-nav-btn`（Ocean 時期命名），現行為 `.tp-global-bottom-nav-btn`。
> - **行為錯的**：捲動隱藏已於 2026-07-20 移除，膠囊常駐。
>
> 以下內容僅保留作為歷史紀錄。

## Mobile Bottom Nav — 4-tab Route-based IA 規格

實作來源：PR #200（v2.0.1.1）+ PR #202（v2.0.2.0）  
對應 OpenSpec change：`openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`

---

## 顯示條件

- 僅在 `mobile ≤760px` media query 下顯示（`@media (max-width: 760px)`）
- 桌機 ≥1024px 不顯示，由 `TripMapRail` + `OverflowMenu` 承擔導航功能

---

## Tab 定義（4 個，由左至右）

| index | label | icon | onClick 行為 | active 判斷 |
|-------|-------|------|-------------|------------|
| 0 | 行程 | `home` SVG | `navigate('/trip/:id')` + `window.scrollTo({top:0})` | `pathname === '/trip/:id'` |
| 1 | 地圖 | `map` SVG | `navigate('/trip/:id/map')` | `/\/trip\/[^/]+\/map$/` 嚴格 regex |
| 2 | 訊息 | `chat` SVG | `navigate('/manage')` | `pathname.startsWith('/manage')` |
| 3 | 更多 | `menu` SVG | 開 `action-menu` sheet | 無 active state |

**Active 判斷注意**：地圖 tab 使用嚴格 regex 避免誤觸 `/manage/map-xxx` 等路徑。

---

## 設計規範

- CSS grid：`grid-template-columns: repeat(4, 1fr)`
- 每個 tab 按鈕：icon（18×18 SVG）+ label（`var(--font-size-caption2)` 11px）
- 觸控目標：`min-height: 44px`（Apple HIG 最小值），padding ≥13px
- Icon stroke：1.75px，對齊 DESIGN.md icon grid
- Active 色：Ocean accent（`var(--color-ocean)`）；inactive 色：muted（`var(--color-muted-fg)`）
- Background：`rgba(255,255,255,0.97)` + `backdrop-filter: blur(var(--blur-glass))`（14px）
- Border-top：1px `var(--color-border)`

---

## 測試需求

- `mobile-bottom-nav-route.test.ts`：4 tab render、active regex 不誤觸 `/manage/map-xxx`
- `mobile-bottom-nav-entries.test.ts`：全部 4 tab 有 `<svg>` icon，iconSize 非 null
- 觸控目標測試：`.ocean-bottom-nav-btn` padding + `min-height: 44px`

---

## 禁止事項

- 不允許 overlay / action（開 sheet）混入前 3 個 tab（第 4 個「更多」為例外）
- 不允許 `font-size` 低於 `var(--font-size-caption2)`（11px）
- 不允許 `blur()` 值偏離 `var(--blur-glass)`
