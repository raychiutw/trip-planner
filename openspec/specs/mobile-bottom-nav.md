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
