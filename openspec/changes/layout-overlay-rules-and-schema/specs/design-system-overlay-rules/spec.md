## ADDED Requirements

### Requirement: DESIGN.md 新增 Overlay Pattern Rules section
DESIGN.md SHALL 新增一個 `## Overlay Pattern Rules` section（放在既有 Components section 之後），包含 4 個子小節：決策樹、Pattern 對照表、禁止（anti-patterns）、跨 Phase 一致性對照。

#### Scenario: Reviewer 檢視新 PR 涉及 modal / sheet
- **WHEN** PR reviewer 看到新 overlay component（modal / sheet / cover）
- **THEN** reviewer 可 cite DESIGN.md 的 Overlay Pattern Rules 判定是否正確
- **AND** PR 作者可在同 section 找到自己這個 use case 對應的 canonical pattern

#### Scenario: 新加功能需要決定 overlay 類型
- **WHEN** 開發者新增一個 UI（例：share trip dialog）
- **THEN** 開發者依決策樹（是否 primary action / peek / destructive / wizard）選對 pattern
- **AND** 桌機對照表 + 手機對照表給具體 max-width / close method

### Requirement: 決策樹覆蓋四種情境
Overlay Pattern Rules 的決策樹 SHALL 涵蓋以下四種使用者意圖，每種情境 SHALL 提供桌機 + 手機對應 pattern：
1. Primary action（表單輸入 / 建立 / 編輯）
2. Peek content（快速查看 / 預覽 / filter preview）
3. Destructive confirm（刪除 / 登出 / 不可逆動作）
4. Multi-step wizard（onboarding / 多頁表單）

#### Scenario: 建立 trip 的 primary action
- **WHEN** 使用者點「+ New Trip」button
- **THEN** 決策樹歸類為「primary action」
- **AND** 桌機 pattern = Centered Modal (max-width 1000px)
- **AND** 手機 pattern = Full-screen Cover

#### Scenario: POI detail peek
- **WHEN** 使用者點地圖上的 POI pin 想快速看資訊
- **THEN** 決策樹歸類為「peek content」
- **AND** 桌機 pattern = Popover anchored to pin
- **AND** 手機 pattern = Bottom Sheet (80vh max, drag-able)

#### Scenario: 確認刪除 trip
- **WHEN** 使用者按 trip「刪除」
- **THEN** 決策樹歸類為「destructive confirm」
- **AND** 桌機 pattern = Small Centered Modal (max-width 480px)
- **AND** 手機 pattern = Small Centered Modal

### Requirement: Anti-patterns 明文禁止
Overlay Pattern Rules SHALL 列出以下 5 個明確禁止 pattern：
1. 桌機使用 Bottom Sheet（bottom sheet 是 mobile-only pattern）
2. 同一個 flow 混 Modal 和 Bottom Sheet
3. 無 close method 的 overlay（必有 X / ESC / backdrop tap / swipe down 至少一種）
4. Modal 內再開 Modal（stacked modal）
5. 桌機使用 Full-screen cover（除非 immersive content 如地圖全螢幕）

#### Scenario: PR 違反 anti-pattern
- **WHEN** 某 PR 在桌機放 bottom sheet 作為 filter UI
- **THEN** Reviewer 可 cite anti-pattern 1 要求改為 popover
- **AND** PR 作者參考決策樹選 peek content desktop pattern

### Requirement: 跨 Phase 一致性對照
Overlay Pattern Rules SHALL 包含一節說明與其他 locked decisions 的一致性：
- 3-pane 桌機 layout（Q1）：modal 開啟時 sidebar 不被遮
- Bottom nav 手機常駐（Q3）：full-screen cover 時 nav 被遮自然；bottom sheet 時 nav 部分遮 OK
- Query param URL state（Q4）：primary form modal 可 URL-driven（`?modal=create-trip`）；peek overlay 不進 URL

#### Scenario: Modal 開啟時 sidebar 可見
- **WHEN** 桌機開啟 primary modal
- **THEN** sidebar 不被 overlay 遮（modal center 在 main + right sheet 區域）
- **AND** backdrop dim 只蓋 main + sheet 不蓋 sidebar

### Requirement: DESIGN.md 更新走 `/design-consultation update` 流程
DESIGN.md 的 Overlay Pattern Rules 新增 SHALL 透過 `/design-consultation update` skill 流程 merge，不直接手動 edit DESIGN.md。

#### Scenario: 合併 Overlay Rules 到 DESIGN.md
- **WHEN** Phase 1 tasks 執行 DESIGN.md 更新任務
- **THEN** 使用者或 AI 執行 `/design-consultation update` skill
- **AND** skill 依 DESIGN.md 的 Decisions Log 標準加新 entry
- **AND** Overlay Pattern Rules section 被 append 到 Components section 之後
