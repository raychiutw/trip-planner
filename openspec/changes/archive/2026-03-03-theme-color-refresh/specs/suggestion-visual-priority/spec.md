## MODIFIED Requirements

參考 `openspec/specs/suggestion-visual-priority/spec.md`（建議卡片優先度背景色、圓點規則）。

### Requirement: 建議卡片優先度背景色強化

系統 SHALL 依 priority 欄位顯示以下背景色，opacity 較前版提高以增強視覺識別度：

| 優先度 | 亮色背景 | 深色背景 |
|--------|---------|---------|
| high | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.12)` |
| medium | `rgba(234, 179, 8, 0.15)` | `rgba(234, 179, 8, 0.12)` |
| low | `rgba(34, 197, 94, 0.10)` | `rgba(34, 197, 94, 0.15)` |

高亮色背景 opacity 從原 `0.08` 提高至 `0.15`；medium 亮色從 `0.08` 提高至 `0.15`；low 優先度原無底色，現新增綠色背景。

#### Scenario: high 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=high 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(239, 68, 68, 0.15)` 淡紅色（原 `0.08`，現 `0.15`）

#### Scenario: medium 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=medium 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(234, 179, 8, 0.15)` 淡黃色（原 `0.08`，現 `0.15`）

#### Scenario: low 優先度卡片亮色模式

- **WHEN** 亮色模式渲染 priority=low 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(34, 197, 94, 0.10)` 淡綠色（原無底色，現新增）

#### Scenario: low 優先度卡片深色模式

- **WHEN** 深色模式渲染 priority=low 的建議卡片
- **THEN** 卡片背景 SHALL 為 `rgba(34, 197, 94, 0.15)` 淡綠色

#### Scenario: high/medium 深色模式背景維持不變

- **WHEN** 深色模式渲染 priority=high 的建議卡片
- **THEN** 卡片背景 SHALL 維持 `rgba(239, 68, 68, 0.12)`（與前版相同）

---

### Requirement: 建議卡片優先度圓點色彩更新

每張建議卡片標題前方的 8px 圓點 SHALL 依優先度顯示以下顏色：

| 優先度 | 圓點顏色 | 說明 |
|--------|---------|------|
| high | `#EF4444` | 紅色，不變 |
| medium | `#EAB308` | 黃色，不變 |
| low | `#22C55E` | 綠色（原 `#F97316` 橘色，現改為綠色） |

#### Scenario: low 圓點改為綠色

- **WHEN** 渲染 priority=low 的建議卡片
- **THEN** 標題前方圓點 SHALL 顯示 `#22C55E` 綠色（原 `#F97316` 橘色）

#### Scenario: high/medium 圓點色彩不變

- **WHEN** 渲染 priority=high 的建議卡片
- **THEN** 標題前方圓點 SHALL 顯示 `#EF4444` 紅色（與前版相同）
