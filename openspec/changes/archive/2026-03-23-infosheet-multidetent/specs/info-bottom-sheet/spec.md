## MODIFIED Requirements

### Requirement: InfoSheet 手機版 multi-detent
手機版（< 768px）InfoSheet SHALL 支援兩段式高度：半版（50dvh）和滿版（100dvh）。預設開啟為半版。

#### Scenario: 預設開啟半版
- **WHEN** InfoSheet 在手機版開啟
- **THEN** 面板高度 SHALL 為 50dvh，背景頁面上半部仍可見

#### Scenario: 上滑切換滿版
- **WHEN** 使用者在半版狀態上滑超過 60px
- **THEN** 面板 SHALL 展開至 100dvh 滿版

#### Scenario: 滿版內容捲動
- **WHEN** 面板為滿版且內容超出可視範圍
- **THEN** 使用者 SHALL 可在面板內正常捲動內容

#### Scenario: 捲到頂 + 下滑縮回半版
- **WHEN** 面板為滿版且 scrollTop === 0 時使用者下滑超過 60px
- **THEN** 面板 SHALL 縮回 50dvh 半版

#### Scenario: 半版下滑關閉
- **WHEN** 面板為半版狀態時使用者下滑超過 60px
- **THEN** InfoSheet SHALL 關閉

### Requirement: 手機版移除 X 關閉按鈕
手機版（< 768px）InfoSheet SHALL 不顯示 X 關閉按鈕，改用手勢關閉。

#### Scenario: 手機版無 X 按鈕
- **WHEN** 在手機版（< 768px）開啟 InfoSheet
- **THEN** `.sheet-close-btn` SHALL 為 `display: none`

### Requirement: 保留 drag indicator
手機版 InfoSheet SHALL 保留頂部 drag indicator（白色短線條 36×4px），示意可滑動。

#### Scenario: drag indicator 可見
- **WHEN** InfoSheet 在手機版開啟
- **THEN** `.sheet-handle` SHALL 顯示在面板頂部

### Requirement: 拖拽跟手動畫
拖拽過程中面板 SHALL 即時跟手移動（transform: translateY），放開後用 Apple spring easing 動畫到目標位置。

#### Scenario: 拖拽跟手
- **WHEN** 使用者觸摸 drag indicator 或在 scrollTop===0 時下滑
- **THEN** 面板 SHALL 即時跟隨手指位置移動

#### Scenario: 放開後動畫
- **WHEN** 使用者放開手指
- **THEN** 面板 SHALL 用 `var(--transition-timing-function-apple)` 動畫到目標 detent 或關閉

### Requirement: 桌機版不變
桌機版（≥ 768px）InfoSheet SHALL 維持現行行為：固定高度 + X 關閉按鈕 + 無 multi-detent。

#### Scenario: 桌機版無 detent
- **WHEN** 在桌機版（≥ 768px）開啟 InfoSheet
- **THEN** 面板 SHALL 為固定高度，X 按鈕可見，不支援拖拽切換
