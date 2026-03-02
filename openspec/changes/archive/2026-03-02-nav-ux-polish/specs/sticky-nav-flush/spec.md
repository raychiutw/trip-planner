## ADDED Requirements

### Requirement: sticky-nav 貼齊視窗頂部
sticky-nav 元件 SHALL 在滾動時貼齊視窗頂部（top: 0），不保留上方間距。MUST 維持 border-radius: 12px 圓角外觀。左右與下方 margin MUST 為 0。

#### Scenario: 手機版滾動時 sticky-nav 貼頂
- **WHEN** 使用者在手機版（<768px）向下滾動頁面
- **THEN** sticky-nav 固定在視窗最頂部（top: 0），與瀏覽器頂部無間距，圓角保留

#### Scenario: 桌機版滾動時 sticky-nav 貼頂
- **WHEN** 使用者在桌機版（≥768px）向下滾動頁面
- **THEN** sticky-nav 固定在視窗最頂部（top: 0），水平置中，圓角保留
