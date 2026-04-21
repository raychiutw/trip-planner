## TripMapRail — Sticky Desktop Map Rail 規格

實作來源：PR #202（v2.0.2.0）  
對應 OpenSpec change：`openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`

---

## 顯示條件

- 僅在 `desktop ≥1024px` 下顯示（單斷點）
- `<1024px` 不顯示：行動端由 `MobileBottomNav` 地圖 tab + `/trip/:id/map` route 承擔
- 斷點依據：iPad Pro 13" portrait = 1024px；iPad 11" portrait（812px）維持行動端體驗

---

## Layout

```
desktop ≥1024px：
grid-template-columns: clamp(375px, 30vw, 400px) 1fr
左欄：行程 timeline（可 scroll）
右欄：TripMapRail（sticky，不隨左欄 scroll）
```

- 右欄 `TripMapRail` 高度：`calc(100dvh - var(--nav-h))`
- 右欄 `position: sticky; top: var(--nav-h)`
- 左欄 overflow-y：scroll；右欄 overflow：hidden

---

## 地圖內容

- 全行程所有 days 的 stops 顯示為 pin
- 每天 stops 以 `dayPalette.ts` 的對應色繪 polyline（詳見 `day-palette.md`）
- Pin 點擊：`navigate('/trip/:id/stop/:entryId')`
- 地圖初始 fitBounds：全行程所有 pins 的 bounding box

---

## useLeafletMap 整合

- `fitBounds` single-pin guard：`getZoom()` 可能回 NaN，需 `Number.isFinite(z)` 檢查
- Marker cache：create effect（pins 變動時）+ diff update effect（focus 變動時只 `setIcon` 受影響 marker）
- Supercluster index 建一次，focus 變動用 `clusterRefreshRef.refresh()` 不重建 index

---

## 測試需求

- `trip-map-rail-visibility.test.ts`：≥1024px media 應 render `TripMapRail`；`<1024px` 不應 render
- `trip-map-rail-focus.test.ts`：點 pin 後 `navigate('/trip/:id/stop/:entryId')` 被呼叫
- `trip-map-rail-visibility.test.ts`（兼）：TripPage 不應含 `.trip-sidebar`（sidebar 已刪）

---

## 禁止事項

- 不允許在 `<1024px` 下顯示（避免擠壓行動端行程 timeline）
- 不允許每次 focus 切換全量重建 marker layer（效能問題）
- 不允許 `getZoom()` 回 NaN 時靜默 setView（會造成地圖無反應）
