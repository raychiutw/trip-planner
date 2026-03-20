# Engineer C 修改報告 — Group F + G

## Group F（MEDIUM，16 項）

| # | 檔案 | 改動 | 狀態 |
|---|------|------|------|
| F.1 | `css/style.css:425` | `.hw-grid` gap 從 `4px` 改為 `var(--spacing-1)` | 完成 |
| F.2 | `src/components/trip/DayNav.tsx` | 每個 pill button 加 `aria-describedby={showTooltip ? tooltipId : undefined}`；tooltip span 加 `id={tooltipId}`（`dn-tooltip-${dayNum}`） | 完成 |
| F.3 | `src/components/trip/SpeedDial.tsx:132` | trigger 內的 hardcoded `<svg><path d="M12 8l-6 6h12z" /></svg>` 改為 `<Icon name="expand_less" />` | 完成 |
| F.4 | `src/components/trip/SpeedDial.tsx:127` | trigger button 加 `aria-controls="speedDialItems"` | 完成 |
| F.5 | `src/hooks/useTrip.ts` | `mapDayResponse` 補齊 `updated_at` → `updatedAt` 的 snake_case fallback 映射（camelCase 優先，fallback snake_case） | 完成 |
| F.6 | `src/hooks/useTrip.ts:66` | `fetchDay` 的 `catch {}` 改為 `catch (err) { console.warn('fetchDay failed:', err); return null; }` | 完成 |
| F.7 | `src/components/trip/DayNav.tsx:82` | 確認 cleanup 函式（行 94-98）在 ResizeObserver 不支援時也正確移除 scroll listener — 已正確，不需修改 | 跳過（已正確） |
| F.8 | `src/components/trip/DayNav.tsx:103` | 確認 `scrollPillIntoView(btn)` 已有 `if (btn)` guard（行 107） — 已正確，不需修改 | 跳過（已正確） |
| F.9 | `src/components/trip/InfoSheet.tsx:102` | `classList.add('dragging')` 前加註釋：`// Direct DOM mutation — React state not needed for CSS-only transition control`；`classList.remove('dragging')` 前同樣加上相同註釋 | 完成 |
| F.10 | `src/lib/drivingStats.ts:70` | `String(text).match(...)` 前加 `if (!text) return` guard | 完成 |
| F.11 | `src/lib/drivingStats.ts:104-109` | 確認 `day.date \|\| ''` 和 `day.dayOfWeek ? ...` 已有適當 null check — 已正確，不需修改 | 跳過（已正確） |
| F.12 | `src/pages/TripPage.tsx:100` | `weather_json` 取值改用 `'weather_json' in` type guard；`WeatherDay` 轉型移除 `as unknown as`，改用 `as WeatherDay` | 完成 |
| F.13 | `src/pages/TripPage.tsx:153` | `toHotelData(hotel as unknown as Record<string, unknown>)` 改為 `typeof hotel === 'object'` guard + `hotel as Record<string, unknown>` | 完成 |
| F.14 | `src/pages/TripPage.tsx:160` | `toTimelineEntry(e as unknown as Record<string, unknown>)` 改為 `typeof e === 'object' && e !== null` guard + `e as Record<string, unknown>` | 完成 |
| F.15 | `src/pages/TripPage.tsx:417-418` | MD 產出和 CSV 產出兩處的 `e.travel as Record<string, unknown> \| null \| undefined` 改為 `e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null` | 完成 |
| F.16 | `src/hooks/useSwipeDay.ts:52` | magic number `1.2` 抽為模組頂層常數 `const SWIPE_DIRECTION_RATIO = 1.2`，並附說明用途的 JSDoc 註釋 | 完成 |

## Group G（LOW，8 項）

| # | 檔案 | 改動 | 狀態 |
|---|------|------|------|
| G.1 | `src/hooks/useTrip.ts:164-171` | 確認 doc content `JSON.parse` 已有 try-catch（行 168-170）— 已正確，不需修改 | 跳過（已正確） |
| G.2 | `src/components/trip/DayNav.tsx:48` | 確認 `longPressTimer` 宣告型別 `useRef<ReturnType<typeof setTimeout> \| null>(null)` 一致 — 已正確，不需修改 | 跳過（已正確） |
| G.3 | `src/components/trip/SpeedDial.tsx:106` | backdrop `div` 前加說明用途的行內註釋 | 完成 |
| G.4 | `src/pages/TripPage.tsx:305-311` | `RawDay` 從 `Record<string, unknown> & {...}` 拆為三個具體型別：`RawDayEntry`（timeline entry 欄位）、`RawHotel`（hotel 欄位）、`RawDay`（day 頂層欄位） | 完成 |
| G.5 | `src/pages/TripPage.tsx:837` | `sheetContent` memo 的依賴陣列移除未使用的 `handleDownloadOpen` | 完成 |
| G.6 | `src/components/trip/InfoSheet.tsx:60` | 確認 `closeBtnRef.current?.focus()` 已有 optional chaining — 已正確，不需修改 | 跳過（已正確） |
| G.7 | `src/hooks/useSwipeDay.ts:65-66` | `touchstart`/`touchend` listener 前加說明 `passive: true` 原因的註釋 | 完成 |
| G.8 | `css/style.css:192` | `.tl-flag` clip-path 的 `10px` 為幾何形狀切角定義，非語意間距/圓角 token，不屬於 token 替換範疇 — 評估後跳過 | 跳過（非 token） |

## 踩坑記錄

- `useTrip.ts`：Task #14（engineer-a）已大幅更新，`mapDayResponse` 已有完整欄位逐一映射（與任務描述中的 `as unknown as Day` 現況不符），F.5 只需補 `updated_at` fallback。
- `InfoSheet.tsx`：`as unknown as` 已由 task #14 移除，行號與任務描述有偏移，需重新定位。
