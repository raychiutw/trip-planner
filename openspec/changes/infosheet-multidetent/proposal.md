## Why

InfoSheet 手機版目前只有單一高度（85dvh），開關為二態（開/關）。iOS 原生 App 的 Sheet 支援多段式（multi-detent）互動，使用者可透過手勢在半版/滿版間切換，體驗更流暢自然。

## What Changes

### InfoSheet 手機版 multi-detent 互動

三段式行為（參考 iOS UISheetPresentationController）：

```
打開 → 半版（~50%）
  ↑ 上滑 → 滿版（100%），繼續捲動看內容
  ↓ 捲到頂 + 繼續下滑 → 縮回半版
  ↓ 再下滑 → 關閉
```

- **半版 detent**（~50dvh）：預設打開高度，顯示內容前半部，背景頁面仍可見
- **滿版 detent**（100dvh）：上滑展開，可捲動查看所有內容
- **關閉**：從半版再下滑即關閉

### 手機版 UI 調整

- **移除 X 關閉按鈕**（手機版 < 768px），改用手勢關閉
- **保留 drag indicator**：頂部白色短線條（36×4px），示意可滑動
- **桌機版不變**：≥768px 維持現行 85dvh + X 按鈕行為

### 手勢實作

- `touchstart` / `touchmove` / `touchend` 事件
- 拖拽超過閾值（如 60px）觸發 detent 切換
- Apple spring easing 動畫（`--transition-timing-function-apple`）
- 捲動與拖拽協調：內容捲到頂部時，繼續下滑才觸發 detent 縮小

## Capabilities

### Modified Capabilities

- `info-bottom-sheet`: 手機版從單一高度改為 multi-detent（半版/滿版/關閉）

## Impact

- `src/components/trip/InfoSheet.tsx` — 新增 touch 手勢邏輯 + detent state
- `css/style.css` — 新增 half/full detent 樣式 + 手機版隱藏 X 按鈕 + drag indicator
- 不影響 QuickPanel（QuickPanel 維持現行行為）
- 不影響桌機版
