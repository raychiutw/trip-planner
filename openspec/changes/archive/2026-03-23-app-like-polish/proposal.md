## Why

多項小改動可以累積出明顯的「原生 App 感」：全域按壓效果、Large Title 捲動收合、卡片層次體系、DayNav 滑動 indicator、Day 切換動畫、自動導航至今天。這些都是低到中工作量但高效益的優化。

## What Changes

- **全域 :active 按壓效果**：所有可互動元素加入 scale(0.97) + opacity: 0.7 的按壓回饋
- **Large Title 區域**：頁面頂部大標題 + 捲動時縮進 nav bar 的 iOS 經典設計
- **卡片 Elevation 體系**：tl-card 加輕 shadow，tl-now 加強 shadow + accent 邊框，tl-past 降低透明度
- **DayNav 滑動 indicator**：選中態背景色塊 spring 滑動到目標 pill
- **Day 切換 crossfade**：切換天時淡入滑上動畫
- **自動導航至今天**：旅行期間自動跳到今天 + 當前事件 scrollIntoView

## Capabilities

### New Capabilities
- `native-feel`: 全域按壓 + Large Title + 卡片層次 + DayNav indicator + Day crossfade + 自動導航今天

### Modified Capabilities
（無）

## Impact

- **CSS**：`css/style.css`、`css/shared.css` 大量 CSS 新增
- **React**：`TripPage.tsx`（Large Title、Day crossfade、auto-navigate）、`DayNav.tsx`（sliding indicator）、`StickyNav.tsx`（title 收合）
- **前端**：不影響 API 或資料層
