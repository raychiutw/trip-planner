# Round 11 — OceanMap internals split (v2.33.57)

**日期**: 2026-05-24
**PR**: TBD (refactor/v2.33.57-oceanmap-split → master)
**Module**: `src/components/trip/OceanMap.tsx` + new 5 files
**LOC**: OceanMap 606 → 303 (-50%); new files +508; total +205

## 背景

backlog #130 — OceanMap.tsx 606 LOC monolith 含 20 個 hook 混合 markers /
viewport / segments 三個 concern。Round 6c defer 想拆乾淨。User
2026-05-24 確認「無關 UI 不用 mockup」可直接做。

## 拆分結果

| File | LOC | 角色 |
|------|-----|------|
| `src/lib/mapTypes.ts` | 31 | MapPin / MapPinType / Coord pure type |
| `src/lib/mapHelpers.ts` | 239 | markerStyle / markerContent / segmentStyle / buildSegments pure helper |
| `src/hooks/useMapMarkers.ts` | 120 | markersRef + prevFocusRef + 2 effect (create / focus-diff) |
| `src/hooks/useMapViewport.ts` | 88 | fitDoneRef + 3 effect (fit / resize / pan) |
| `src/hooks/useMapSegments.ts` | 30 | SegmentPair[] via useMemo |
| `src/components/trip/OceanMap.tsx` | **303** | Compose shell + Segment subcomponent + JSX |

## 風險緩解（per architecture mockup）

### R1 — Effect 順序變動 → ✅

`OceanMap.tsx` 三個 hook call 順序：`useMapMarkers` → `useMapViewport` → `useMapSegments`
對齊原檔 line 220 → 299 → 343 effect 順序。Architectural guard test 鎖住。

### R2 — useEffect deps 漏掉或多加 → ✅

逐 effect copy-paste，dep array 一字不動。Refactor 前後 grep 確認所有
dep arrays 完全相同。

### R3 — StrictMode double-mount 行為改變 → ✅

每個 hook cleanup 保持原樣（markers 移除 listener + map=null；fitDone reset；
polyline setMap(null)）。既有 4 個 OceanMap unit + integration test 全綠 (33 pass)。

## Backward compat

`OceanMap.tsx` re-export `markerStyle` / `markerContent` / `buildSegments` /
`MarkerStyle` / `SegmentPair`。
`useMapData.ts` re-export `MapPin` / `MapPinType`，`useRoute.ts` re-export `Coord`。
17+ 個既有 caller 完全不動。

## 同步解 lib→hooks reverse import

原 `lib/mapHelpers.ts` 若直接 import `MapPin` / `Coord` from `hooks/` 會違反
v2.33.54 立的 leaf rule。把這 2 個 type 抽到 `lib/mapTypes.ts`，hooks
re-export。`tests/unit/lib-no-reverse-import.test.ts` 仍綠。

## Tests

- `tests/unit/round-11-oceanmap-split.test.ts` — 9 個 architectural guard
  (lib leaf-ness / 3 hook 單一職責 / OceanMap compose shell / hook call 順序 /
   backward-compat re-export)
- 既有 4 個 OceanMap test 全綠 (33 pass)
- 2 個 source-grep test 更新路徑 (v2_31_93 / v2_31_87)
- 全 suite 2403 / 2403 (+9 從 2394)

## Status

- ✅ OceanMap.tsx 606→303 (-50%)
- ✅ 4 個 module + 1 type 檔，單一職責清楚
- ✅ tsc clean
- ✅ #130 closes
- ✅ Round 6c (#124) defer 完整收尾
