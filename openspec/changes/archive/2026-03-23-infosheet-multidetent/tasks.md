## 1. InfoSheet detent state + CSS

- [x] 1.1 `src/components/trip/InfoSheet.tsx`：新增 `detent` state（'half' | 'full'），開啟時預設 'half'
- [x] 1.2 `css/style.css`：手機版 `@media (max-width: 767px)` 半版 50dvh + 滿版 .detent-full 100dvh
- [x] 1.3 `css/style.css`：手機版隱藏 .sheet-close-btn（display: none）
- [x] 1.4 `css/style.css`：detent 切換動畫（transition height + apple spring easing）

## 2. Touch 手勢拖拽

- [x] 2.1 `InfoSheet.tsx`：touchstart — 記錄起始 Y，判斷 scrollTop === 0
- [x] 2.2 `InfoSheet.tsx`：touchmove — 計算 deltaY，即時 translateY 跟手，scrollTop===0 時 preventDefault
- [x] 2.3 `InfoSheet.tsx`：touchend — 根據 deltaY 決定目標：半版↑滿版 / 半版↓關閉 / 滿版↓半版
- [x] 2.4 拖拽時暫時移除 transition，放開後恢復

## 3. 捲動與拖拽協調

- [x] 3.1 滿版時內容可正常捲動（不攔截 touch）
- [x] 3.2 滿版 scrollTop === 0 + 下拉才觸發拖拽
- [x] 3.3 半版時 body scroll lock 保持（不捲動背景）

## 4. 桌機版不動

- [x] 4.1 確認 ≥768px 不套用 detent CSS，X 按鈕可見

## 5. 驗證

- [x] 5.1 npx tsc --noEmit 全過
- [x] 5.2 npm test 全過
