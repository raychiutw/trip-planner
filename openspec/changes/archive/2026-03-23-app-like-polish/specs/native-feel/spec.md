## ADDED Requirements

### Requirement: 全域 :active 按壓效果
所有可互動元素 SHALL 在 :active 狀態有 scale + opacity 的視覺回饋。

#### Scenario: 點擊 DayNav pill
- **WHEN** 使用者按下 DayNav pill
- **THEN** pill SHALL 顯示 scale(0.97) + opacity: 0.7 的效果
- **THEN** 鬆手後 SHALL 在 80ms 內恢復原狀

### Requirement: Large Title 捲動收合
頁面頂部 SHALL 顯示行程大標題，捲動時 SHALL 縮進 StickyNav。

#### Scenario: 頁面頂部顯示大標題
- **WHEN** 頁面載入且捲動位置在頂部
- **THEN** SHALL 顯示 large-title 區域（行程名 + 日期範圍）
- **THEN** StickyNav 中 SHALL 不重複顯示標題

#### Scenario: 捲動後標題縮進 nav
- **WHEN** 使用者向下捲動使 large-title 離開視窗
- **THEN** StickyNav 中 SHALL 以 fade-in 顯示 inline 標題

### Requirement: 卡片 Elevation 三層體系
Timeline 卡片 SHALL 根據時間狀態有不同的視覺層次。

#### Scenario: 當前事件卡片突出
- **WHEN** 事件為 tl-now（當前正在進行）
- **THEN** 卡片 SHALL 有更強的 shadow + accent 邊框 + 微 scale

#### Scenario: 過去事件卡片淡化
- **WHEN** 事件為 tl-past
- **THEN** 卡片 SHALL 無 shadow，背景降低透明度

### Requirement: DayNav Sliding Indicator
DayNav 的選中態 SHALL 有一個背景色塊以 spring 動畫滑動到目標 pill。

#### Scenario: 切換選中的天
- **WHEN** 使用者點擊不同天的 pill
- **THEN** 背景 indicator SHALL 以 spring 動畫滑到新位置
- **THEN** 動畫 SHALL 使用 var(--ease-spring) 或類似的 spring curve

### Requirement: Day 切換 crossfade 動畫
切換天數時，day content SHALL 有淡入滑上的進場動畫。

#### Scenario: 從 Day 1 切換到 Day 2
- **WHEN** currentDayNum 從 1 變為 2
- **THEN** 新的 day content SHALL 以 fadeSlideIn 動畫進場（opacity 0→1, translateY 12px→0）
- **THEN** 動畫 duration SHALL 約 300ms

### Requirement: 自動導航至今天
旅行期間載入頁面時，系統 SHALL 自動跳到今天的行程。

#### Scenario: 今天在行程範圍內
- **WHEN** localToday 落在行程的日期範圍內
- **THEN** SHALL 自動 switchDay 到今天
- **THEN** 若有 tl-now 事件，SHALL scrollIntoView 到該事件

#### Scenario: 今天不在行程範圍
- **WHEN** localToday 不在行程日期範圍內
- **THEN** SHALL 保持預設行為（顯示第一天）
