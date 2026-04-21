## Day Palette — 10 色 Qualitative Palette 規格

實作來源：PR #201（v2.0.1.2 DESIGN.md DV 例外條文）+ PR #202（v2.0.2.0 `src/lib/dayPalette.ts`）  
對應 OpenSpec change：`openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`

---

## 設計系統位置

本 palette 是 **DESIGN.md Color section Data Visualization 例外**的落地實作。

原則：UI chrome 嚴守單一 Ocean accent，Data Visualization（地圖 polyline、chart series）允許使用本 palette。

---

## 10 色定義（Tailwind -500）

| day | 色名 | Tailwind token | hex |
|-----|------|---------------|-----|
| 1 | sky-500 | `--color-sky-500` | #0ea5e9 |
| 2 | teal-500 | `--color-teal-500` | #14b8a6 |
| 3 | amber-500 | `--color-amber-500` | #f59e0b |
| 4 | rose-500 | `--color-rose-500` | #f43f5e |
| 5 | violet-500 | `--color-violet-500` | #8b5cf6 |
| 6 | lime-500 | `--color-lime-500` | #84cc16 |
| 7 | orange-500 | `--color-orange-500` | #f97316 |
| 8 | cyan-500 | `--color-cyan-500` | #06b6d4 |
| 9 | fuchsia-500 | `--color-fuchsia-500` | #d946ef |
| 10 | emerald-500 | `--color-emerald-500` | #10b981 |

---

## dayColor() API（`src/lib/dayPalette.ts`）

```typescript
dayColor(dayNumber: number): string
```

- 輸入：day number（1-based，行程第幾天）
- 輸出：對應色的 hex string
- Wrap：超過 10 天 modulo（`(n - 1) % 10`）
- Guard：`n ≤ 0`、`NaN`、`Infinity`、`-Infinity` 全部 fallback 到 day 1 色（`#0ea5e9`）

---

## 使用場景

- `TripMapRail`：每天 stops 的 Leaflet polyline 顏色
- `DaySection`（未來）：day hero 色條、chip 底色可選用（需另行討論）
- Chart series（未來）：若引入統計圖表，series 顏色使用本 palette

---

## 測試需求

- `dayPalette.test.ts`：
  - 10 色輪流驗證（day 1-10 回正確 hex）
  - Modulo wrap（day 11 = day 1 色）
  - Guard：day 0 / -1 / NaN / Infinity 全部回 `#0ea5e9`

---

## 禁止事項

- 不允許在 UI chrome（button、nav、card）使用本 palette（違反 Ocean 單一 accent 原則）
- 不允許使用 Tailwind `-400` 或 `-600` 等其他色階（統一 `-500`）
- 不允許使用自定義 hex（維護成本高，與 Tailwind token 失去連結）
