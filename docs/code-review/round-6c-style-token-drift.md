# Round 6c style token drift fix (v2.33.56)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.56-style-helper → master)
**Module**: src/ + css/ — 10 個 component / page CSS-in-JS 區塊
**LOC**: ~30 行 fallback 拔除 + 1 個 guard test

## 背景

backlog #124 (Round 6c) "style helper" 原 finding 描述為「TimelineRail /
TripMapRail / EditEntryPage 各自 inline-style 計算 priority 顏色，可抽
`lib/priorityStyles.ts`」。實際 audit 發現：

- 大多數 `--color-priority-*` 使用都在 `<style>` template literal CSS 區塊內
  （非 React inline-style props），抽 JS helper 不適用
- 卻發現**真的 bug**：27+ 個 `var(--color-priority-high-dot, #c0392b)` 寫死的
  fallback hex 跟現在 token `#C13515` 不一致

## 對比

| Source | Hex | RGB |
|--------|-----|-----|
| `css/tokens.css` `--color-priority-high-dot` | `#C13515` | (193, 53, 21) — terracotta |
| 27 個寫死的 fallback | `#c0392b` | (192, 57, 43) — Flat UI red (舊) |

若 CSS variable 因任何原因失效（極端情況），user 會看到舊紅而非預期 terracotta，
silent 偏離 design system。

## 解法

**Strip 所有 stale fallback**（非 update value），原則：

1. CSS variable 支援度在 2026 全 browser ~100%（IE11 已 deprecated 多年）
2. Token 未定義 = CSS file 沒載入 = UI 整體已壞，fallback 救不了
3. 留 fallback 就會 drift，是長期 maintenance 負擔
4. Strip 後 token miss 直接 inherit/transparent，視覺上更容易 spot 問題

## Affected files (10 個)

| File | Changes |
|------|---------|
| `src/components/shared/AlertPanel.tsx` | 5 處 |
| `src/components/shared/ConflictModal.tsx` | 3 處 |
| `src/components/shared/ConfirmModal.tsx` | 7 處 |
| `src/components/trip/TravelPill.tsx` | 5 處 |
| `src/components/trip/CustomPoiForm.tsx` | 1 處 (destructive) |
| `src/components/trip/TimelineRail.tsx` | 2 處 (inline style) |
| `src/pages/NewTripPage.tsx` | 1 處 |
| `src/pages/AddStopPage.tsx` | 2 處 (destructive) |
| `src/pages/AccountPage.tsx` | 6 處 |
| `src/pages/EntryActionPage.tsx` | 3 處 |

## Regression test

`tests/unit/no-stale-terracotta-fallback.test.ts`：

- walk `src/` + `css/` 全部 .ts / .tsx / .css
- grep 兩 pattern: `#c0392b` (case-insensitive) + `rgba(192, 57, 43, ...)`
- 未來任何 PR 偷渡舊 fallback 回來都會 fail

驗證 `css/tokens.css` 仍含 canonical token (對齊 DESIGN.md)。

## 為何不抽 `lib/priorityStyles.ts`

原 defer 設想是 JS helper，但實際 27+ usage 是 CSS-in-JS template
literal，已用 CSS custom property 串接 — token 本身就是 helper。
另外 2 處 React inline-style 也用 string template 寫 `var(--token)`，
JS 層沒可抽的 logic。

結論：**stale fallback 才是真 bug，token system 設計已正確**。

## Status

- ✅ 27 個 stale fallback 全清
- ✅ tsc clean
- ✅ 2394 / 2394 全綠 (+2)
- ✅ 1 個 architectural guard test 鎖未來不回退
- ✅ #124 style helper portion closes (OceanMap 拆分仍待 mockup 決策)
