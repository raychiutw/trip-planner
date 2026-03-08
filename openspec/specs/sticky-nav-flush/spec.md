## ADDED Requirements

### Requirement: sticky-nav 貼齊視窗頂部
sticky-nav 元件 SHALL 在滾動時貼齊視窗頂部（top: 0），不保留上方間距。MUST 維持 border-radius: 12px 圓角外觀。左右與下方 margin MUST 為 0。

深色模式下，底部邊線 MUST 使用 `rgba(255,255,255,0.15)` 半透明白色，確保在深色背景上清晰可辨。

#### Scenario: 手機版滾動時 sticky-nav 貼頂
- **WHEN** 使用者在手機版（<768px）向下滾動頁面
- **THEN** sticky-nav 固定在視窗最頂部（top: 0），與瀏覽器頂部無間距，圓角保留

#### Scenario: 桌機版滾動時 sticky-nav 貼頂
- **WHEN** 使用者在桌機版（≥768px）向下滾動頁面
- **THEN** sticky-nav 固定在視窗最頂部（top: 0），水平置中，圓角保留

#### Scenario: 深色模式底線清晰可辨
- **WHEN** 使用者切換至深色模式
- **THEN** sticky-nav 底部邊線使用半透明白色（rgba(255,255,255,0.15)），在深色背景上可辨識

### Requirement: Day pill 不被 scroll container 裁切
`.dh-nav` 容器 MUST 保留足夠的垂直 padding（至少 2px），使 Day pill（`.dn`）的 border-radius 不被 `overflow-x: auto` 產生的隱性 `overflow-y: auto` 裁切。

#### Scenario: Day pill 圓角完整顯示
- **WHEN** 行程有多個 Day，nav pills 在 `.dh-nav` 內渲染
- **THEN** 每個 pill（含 active 狀態）的四角圓角完整可見，無裁切

### Requirement: 桌面版 nav pills 視覺置中
在桌面版（≥768px），nav pills MUST 相對於整個 sticky-nav 的可視寬度視覺置中，不受左側 brand 與右側 actions 寬度差異影響。

#### Scenario: 桌面版 pills 頁面置中
- **WHEN** 使用者在桌面版（≥768px）檢視行程
- **THEN** Day pills 在 sticky-nav 中視覺置中，不因左右區塊寬度差異而偏移
