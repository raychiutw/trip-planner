## ADDED Requirements

### Requirement: Open/Closed pill badge

每個 issue item 的 header 區域 SHALL 在 title 前方顯示一個 pill badge，標示該 issue 的狀態。

- Open badge：綠色底（`#238636`）、白色文字、circle-dot 圖示、文字「Open」
- Closed badge：紫色底（`#8957e5`）、白色文字、check-circle 圖示、文字「Closed」

Badge SHALL 為圓角 pill 形狀（`border-radius: 999px`），字級 `--fs-sm`。

#### Scenario: Open issue 顯示綠色 badge

- **WHEN** issue 的 `state` 為 `open`
- **THEN** issue item header SHALL 在 title 前方顯示綠色底的「Open」pill badge，含 circle-dot 圖示

#### Scenario: Closed issue 顯示紫色 badge

- **WHEN** issue 的 `state` 為 `closed`
- **THEN** issue item header SHALL 在 title 前方顯示紫色底的「Closed」pill badge，含 check-circle 圖示

#### Scenario: 深色模式 badge 外觀

- **WHEN** 使用者切換至深色模式
- **THEN** badge 的綠色（`#238636`）與紫色（`#8957e5`）底色 SHALL 維持不變，白色文字不受深色模式影響

### Requirement: 移除舊狀態指示

`.issue-item` SHALL NOT 使用左邊框顏色區分 open/closed 狀態。`.issue-item.closed` SHALL NOT 套用 `opacity: 0.55`。

#### Scenario: Issue item 無左邊框顏色

- **WHEN** 任一 issue item 渲染完成
- **THEN** 該 issue item SHALL NOT 具有狀態相關的左邊框顏色（`border-left-color`）

#### Scenario: Closed issue 不降低透明度

- **WHEN** issue 的 `state` 為 `closed`
- **THEN** issue item SHALL 以完整不透明度顯示（無 `opacity` 降低）

### Requirement: 桌機版 title 字級放大

桌機版（≥768px）的 `.issue-item-title` SHALL 使用 `--fs-md` 字級。手機版維持 `--fs-sm`。

#### Scenario: 桌機版 title 使用 --fs-md

- **WHEN** 使用者在 ≥768px 裝置查看 issue 列表
- **THEN** `.issue-item-title` 的 font-size SHALL 為 `var(--fs-md)`

#### Scenario: 手機版 title 維持 --fs-sm

- **WHEN** 使用者在 <768px 裝置查看 issue 列表
- **THEN** `.issue-item-title` 的 font-size SHALL 為 `var(--fs-sm)`
