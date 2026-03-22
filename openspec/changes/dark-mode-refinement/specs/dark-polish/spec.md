## ADDED Requirements

### Requirement: Zen Dark 與 Sun Dark 視覺差異化
Zen dark SHALL 透過降低飽和度與 Sun dark 拉開差異，複製淺色模式的差異策略。

#### Scenario: 切換 Sun dark 和 Zen dark
- **WHEN** 使用者在 dark mode 切換 Sun 和 Zen 主題
- **THEN** SHALL 有明顯的視覺差異（Sun 偏暖棕、Zen 偏灰暖）

### Requirement: Dark mode elevated surface
Dark mode 的不同層級元素 SHALL 有不同亮度，產生空間深度感。

#### Scenario: 卡片在暗色背景上浮起
- **WHEN** dark mode 顯示 timeline 卡片
- **THEN** 卡片 SHALL 有頂部微光 highlight（rgba 白色）區隔於背景

### Requirement: Dark mode shadow 替換為 glow
Dark mode 的浮動元素 SHALL 使用 accent glow 取代不可見的黑色 shadow。

#### Scenario: FAB 按鈕在 dark mode
- **WHEN** dark mode 顯示 FAB 按鈕
- **THEN** SHALL 有微弱的 accent 色 glow 效果

### Requirement: Dark mode separator 精緻化
Dark mode 的分隔線 SHALL 使用半透明白色，提升可見度。

#### Scenario: Timeline 虛線在 dark mode
- **WHEN** dark mode 顯示 timeline segment 虛線
- **THEN** SHALL 使用 rgba(255,255,255,0.12) 而非固定深色
