## Context

InfoSheet 手機版目前 `position: fixed; height: 92dvh`，開/關二態透過 `translateY(100%) / translateY(0)` 切換。需改為三段式：半版（50dvh）→ 滿版（100dvh）→ 關閉，透過 touch 手勢切換。桌機版不動。

## Goals / Non-Goals

**Goals:**
- 手機版 multi-detent（半版 50% / 滿版 100%）
- touch 手勢拖拽切換 detent + 關閉
- 內容捲動與拖拽協調（scrollTop === 0 時才觸發拖拽）
- 手機版移除 X 關閉按鈕
- 保留 drag indicator（白色短線條）

**Non-Goals:**
- 不改桌機版（≥768px 維持現行 X 按鈕 + 固定高度）
- 不做中間 detent（只有半版和滿版）
- 不做 snap 到任意位置（只 snap 到 50% 或 100%）

## Decisions

### D1: Detent state 管理

**選擇**：`detent` state（`'half' | 'full'`）+ `isOpen` 搭配

```typescript
const [detent, setDetent] = useState<'half' | 'full'>('half');
// isOpen=true + detent='half' → 半版
// isOpen=true + detent='full' → 滿版
// isOpen=false → 關閉
// 開啟時預設 detent='half'
```

### D2: 手勢拖拽實作

**選擇**：原生 touch event + `translateY` 即時跟手

- `touchstart`：記錄起始 Y，判斷是否在 drag indicator 區域或 scrollTop === 0
- `touchmove`：計算 deltaY，即時設定 `transform: translateY(${delta}px)`
- `touchend`：根據 deltaY 方向和距離決定目標 detent 或關閉
  - 半版 + 上拉 > 60px → 滿版
  - 半版 + 下拉 > 60px → 關閉
  - 滿版 + scrollTop===0 + 下拉 > 60px → 半版
  - 半版回彈 + 下拉 > 120px → 關閉（快速甩）

### D3: 捲動與拖拽協調

**選擇**：只在 `scrollTop === 0` 且向下拖時才觸發 detent 切換

- 滿版時，內容可正常捲動
- 捲到頂部後繼續下拉 → 觸發拖拽（sheet 跟手移動）
- 內容不在頂部時，下拉 = 正常捲動

### D4: CSS 高度切換

**選擇**：
```css
/* 手機版 */
@media (max-width: 767px) {
  .info-sheet-panel { height: 50dvh; }  /* 預設半版 */
  .info-sheet-panel.detent-full { height: 100dvh; }  /* 滿版 */
  .sheet-close-btn { display: none; }  /* 隱藏 X */
}
```

### D5: 動畫

**選擇**：detent 切換用 `transition: height var(--transition-duration-slow) var(--transition-timing-function-apple)`，拖拽跟手時暫時移除 transition。

## Risks / Trade-offs

**[風險] 捲動和拖拽衝突**
→ 緩解：用 `scrollTop === 0` 判斷，並在拖拽開始時 `preventDefault` 阻止捲動。

**[風險] 桌機版觸控螢幕**
→ 緩解：用 `@media (max-width: 767px)` 限制，桌機版即使有觸控也不啟用 multi-detent。
