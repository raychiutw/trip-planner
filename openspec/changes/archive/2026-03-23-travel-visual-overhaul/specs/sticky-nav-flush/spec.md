## MODIFIED Requirements

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
在桌面版（≥768px），nav pills MUST 相對於整個 sticky-nav 的可視寬度視覺置中，不受左側 brand 與右側空間寬度差異影響。

#### Scenario: 桌面版 pills 頁面置中
- **WHEN** 使用者在桌面版（≥768px）檢視行程
- **THEN** Day pills 在 sticky-nav 中視覺置中，不因左右區塊寬度差異而偏移

### Requirement: nav-brand 顯示行程名稱
`nav-brand` 元素 SHALL 動態顯示當前行程的 `trip.name`（行程短名稱），不再硬編碼顯示 "Trip Planner"。當 trip 資料尚未載入時，SHALL 顯示 fallback 文字 "Trip Planner"，避免空白閃爍。

行程名稱 SHALL 以單行顯示，超長時以 `text-overflow: ellipsis` 截斷，不換行。

#### Scenario: 行程載入後 nav-brand 顯示行程名稱
- **WHEN** 行程資料載入完成（`trip.name` 有值）
- **THEN** `.nav-brand` 元素文字內容 SHALL 等於 `trip.name`，不顯示 "Trip Planner"

#### Scenario: 行程載入前 nav-brand 顯示 fallback
- **WHEN** 頁面初始載入，trip 資料尚未回傳
- **THEN** `.nav-brand` 元素文字內容 SHALL 為 "Trip Planner"，不顯示空白

#### Scenario: 行程名稱過長時截斷顯示
- **WHEN** `trip.name` 超過 nav-brand 可用寬度
- **THEN** 文字 SHALL 以 `ellipsis` 截斷於單行，不換行，不撐開 sticky-nav 高度

### Requirement: 移除 nav-actions 區塊
`sticky-nav` 中的 `.nav-actions` 區塊（包含列印按鈕與設定連結）SHALL 從 TripPage 的 JSX 中移除。相關功能（列印模式、設定頁導航）已整合至 Speed Dial。

CSS 中對應的 `.nav-actions`、`.nav-action-btn`、`.nav-action-label` 樣式 SHALL 一併移除或標記為已廢棄。

#### Scenario: sticky-nav 不含列印與設定按鈕
- **WHEN** 使用者開啟行程頁，sticky-nav 渲染完成
- **THEN** sticky-nav 內 SHALL NOT 存在列印模式按鈕或設定連結，`.nav-actions` 元素 SHALL NOT 存在於 DOM
