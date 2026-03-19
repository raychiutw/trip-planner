## ADDED Requirements

### Requirement: 三套色彩主題定義
系統 SHALL 提供三套色彩主題，每套包含淺色和深色兩組 CSS 變數配置：
- **陽光**（sun）：accent `#F47B5E`，暖沙奶白背景，海藍輔助色
- **晴空**（sky）：accent `#5BA4CF`，冰藍暖白背景，薄荷綠輔助色
- **和風**（zen）：accent `#B8856C`，和紙色背景，抹茶藍鼠輔助色

#### Scenario: 陽光主題淺色模式
- **WHEN** body 有 class `theme-sun` 且無 `dark`
- **THEN** `--accent` 為 `#F47B5E`，`--bg` 為暖白色調，`--text` 為深棕色

#### Scenario: 晴空主題深色模式
- **WHEN** body 有 class `theme-sky` 和 `dark`
- **THEN** `--accent` 為天空藍的亮色變體，`--bg` 為深色，`--text` 為淺色

#### Scenario: 和風主題淺色模式
- **WHEN** body 有 class `theme-zen` 且無 `dark`
- **THEN** `--accent` 為 `#B8856C`，`--bg` 為和紙色調

### Requirement: 主題 class 透過 body element 控制
系統 SHALL 透過 `body` element 的 class 組合控制主題和深淺模式。主題 class 為 `theme-sun`、`theme-sky`、`theme-zen`，與現有 `dark` class 正交組合。

#### Scenario: 主題與模式 class 共存
- **WHEN** 使用者選擇晴空主題 + 深色模式
- **THEN** body class 包含 `theme-sky` 和 `dark`

#### Scenario: 切換主題不影響深淺模式
- **WHEN** 使用者在深色模式下從陽光切換到和風
- **THEN** body class 從 `theme-sun dark` 變為 `theme-zen dark`，`dark` 保持不變

### Requirement: 主題偏好持久化
系統 SHALL 將使用者選擇的主題存入 `localStorage` key `colorTheme`，值為 `sun`、`sky` 或 `zen`。

#### Scenario: 儲存主題偏好
- **WHEN** 使用者選擇晴空主題
- **THEN** `localStorage.getItem('colorTheme')` 回傳 `"sky"`

#### Scenario: 載入時還原主題
- **WHEN** 頁面載入且 `localStorage` 有 `colorTheme` 值 `"zen"`
- **THEN** body 自動套用 `theme-zen` class

#### Scenario: 無儲存值時預設陽光
- **WHEN** 頁面載入且 `localStorage` 無 `colorTheme` key
- **THEN** 系統 fallback 為 `sun` 主題並寫入 localStorage

### Requirement: meta theme-color 動態更新
系統 SHALL 在主題或模式切換時同步更新 `<meta name="theme-color">` 的值，對應當前主題 × 模式的 accent 或背景色。

#### Scenario: 切換主題更新 theme-color
- **WHEN** 主題從陽光切換為晴空（淺色模式）
- **THEN** meta theme-color 更新為晴空主題的對應色值

#### Scenario: 切換深淺模式更新 theme-color
- **WHEN** 深淺模式從淺色切換為深色（任一主題）
- **THEN** meta theme-color 更新為該主題深色版的對應色值
