## ADDED Requirements

### Requirement: 行程切換功能
manage 頁面 SHALL 在載入時呼叫 `GET /api/my-trips` 取得使用者有權限的行程列表，以 dropdown 或 pill 切換顯示。

#### Scenario: 有多個行程
- **WHEN** 使用者有 2 個以上行程權限
- **THEN** 顯示行程切換 UI，預設選擇第一個行程
- **AND** 切換行程時重新載入該行程的 requests

#### Scenario: 僅一個行程
- **WHEN** 使用者只有 1 個行程權限
- **THEN** 自動載入該行程，不顯示切換 UI（或僅顯示行程名稱）

#### Scenario: 無任何行程
- **WHEN** 使用者通過 Access 認證但無行程權限
- **THEN** 顯示「你目前沒有任何行程權限，請聯繫管理者」

### Requirement: 請求列表顯示
manage 頁面 SHALL 顯示選定行程的所有 requests，按 created_at DESC 排序，包含 title、body、reply（若有）、status、時間。

#### Scenario: 有請求且有回覆
- **WHEN** 該行程有已回覆的 requests
- **THEN** 顯示請求卡片，包含原始內容和 Claude 回覆，標記「已處理」

#### Scenario: 有請求但未回覆
- **WHEN** 該行程有未處理的 requests
- **THEN** 顯示請求卡片，無回覆區塊，標記「處理中」

#### Scenario: 無任何請求
- **WHEN** 該行程尚無 requests
- **THEN** 顯示空狀態提示

### Requirement: 送出新請求
manage 頁面 SHALL 提供文字輸入區和送出按鈕，支援 `trip-edit`（行程修改）和 `trip-plan`（問建議）兩種模式。

#### Scenario: 成功送出
- **WHEN** 使用者輸入內容並點擊送出
- **THEN** POST /api/requests
- **AND** 回傳的完整 row 立刻插入列表頂部（不需重新 GET）

#### Scenario: 送出後立即可見
- **WHEN** 送出成功後重整頁面
- **THEN** 剛送出的請求 SHALL 出現在列表中（D1 強一致性保證）

#### Scenario: 空白送出
- **WHEN** 使用者未輸入內容就點擊送出
- **THEN** 不發送請求，顯示提示

### Requirement: 頁面遵循 HIG 規範
manage 頁面 SHALL 遵循現有 CSS HIG 規範（無框線設計、Apple text style tokens、inline SVG icons）。

#### Scenario: 字型大小
- **WHEN** 頁面渲染
- **THEN** 所有文字使用 CSS custom property（--fs-*），無硬編碼 font-size

#### Scenario: 圖示
- **WHEN** 頁面使用圖示
- **THEN** 使用 inline SVG（Material Symbols Rounded），不使用外部圖片或 icon font
