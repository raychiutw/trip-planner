## Retrofit Scope

本 change 為 **retroactive 補寫**。三個 PR 已於 2026-04-21 完成 merge，本文件記錄已發生的執行順序與驗證狀態，不含待辦事項。

---

## 執行順序（已發生）

### PR #200 — Tier 0 Bug Fix（v2.0.1.1）

merge commit：`a66942d`

**執行內容**：
1. TDD 紅：補 6 組失敗測試（icon 缺失、dead tab、logo link、非整數 fontsize、sheet default、nav entries）
2. TDD 綠：`Icon.tsx` 補 edit/menu SVG；topbar 拿掉三個 dead tab；`TriplineLogo` 改 Link；非整數 px 全改整數；`activeSheet` 初始 null；`PageNav.onClose` 改 optional
3. Dev infra：`vite.config.ts` 加 `optimizeDeps.include: ['leaflet']`
4. 測試：370 → 388（+18）

### PR #201 — Typography + Material Consistency（v2.0.1.2）

merge commit：`0ad5af7`

**執行內容**：
1. TDD 紅：補 36 組失敗測試（DESIGN.md section 存在、token 宣告、CSS 禁用值、tap target、AI pill state）
2. TDD 綠：DESIGN.md 新增 Mobile Type Scale + DV 例外；tokens.css 補 `--font-size-eyebrow` / `--blur-glass`；glass 統一 14px；AI pill 改 Ocean fill；注意事項卡改 warning amber；hardcode px 全 token 化
3. 測試：388 → 424（+36）

### PR #202 — IA 重構 + Desktop Map Rail（v2.0.2.0）

merge commit：`1d26886`

**執行內容**：
1. TDD 紅：補 45 組失敗測試（4-tab route、map rail visibility/focus、dayPalette guard、inline map 不存在、day chip link、map page day query、NaN zoom guard）
2. TDD 綠：`MobileBottomNav` 5→4 tab route-based；新增 `TripMapRail.tsx` + `src/lib/dayPalette.ts` + `src/hooks/useMediaQuery.ts`；拿掉 desktop sidebar；拿掉 inline OceanMap 加「看地圖」chip；OverflowMenu 補 3 入口；TripPage 清 topbar container
3. 測試：424 → 469（+45）

---

## 驗證狀態

| 項目 | 狀態 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 469 / 469 pass |
| CI build | pass（CI 跑 tsc + test + build） |
| Production deploy | 已完成（https://trip-planner-dby.pages.dev/） |
| Canary 監控 | 進行中（task #18） |

---

## 後續待辦（非本 change scope）

- `/qa` dogfood PR 3（task #17）
- `/canary` 監控 v2.0.2.0（task #18）
- `/benchmark` baseline（task #19）
