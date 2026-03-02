# Spec: nav-pills-overflow

Nav pills 天數溢出處理機制（全裝置）。

## HTML 結構

```html
<div class="dh-nav-wrap" id="navWrap">
    <button class="dh-nav-arrow" id="navArrowL">‹</button>
    <div class="dh-nav" id="navPills">...</div>
    <button class="dh-nav-arrow" id="navArrowR">›</button>
</div>
```

## 溢出偵測

`initNavOverflow()`（在 `js/app.js`）：

1. 計算 `.dh-nav` 容器可容納的 pill 數量
2. 若 pill 總數超過可容納數量，啟用溢出模式
3. 監聽 `.dh-nav` 的 scroll 事件，呼叫 `updateNavArrows()`

## 漸層遮罩

- 左右加 CSS pseudo-element 或 `mask-image` 漸層遮罩
- 僅在對應方向有溢出時顯示（透過 class `overflow-left` / `overflow-right` 控制）

## 箭頭按鈕

- **桌機 ≥768px**：左右箭頭可見
- **手機 <768px**：箭頭 `display: none`，僅靠漸層遮罩 + 手指滑動
- 點擊箭頭平滑捲動一頁可見數量的寬度
- 到達邊界時 `visibility: hidden`（保留空間避免版面跳動）

## 狀態更新

`updateNavArrows()`：
- `scrollLeft <= 0` → 隱藏左箭頭，移除 `overflow-left`
- `scrollLeft + clientWidth >= scrollWidth` → 隱藏右箭頭，移除 `overflow-right`
