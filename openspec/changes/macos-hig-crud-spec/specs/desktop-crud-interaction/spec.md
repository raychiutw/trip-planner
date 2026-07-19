## ADDED Requirements

### Requirement: CRUD 動詞語意區分

桌機 CRUD 動作 SHALL 依 macOS HIG 語意選字：**新增 (New)** = 建立新資料（行程/筆記）；**加入 (Add)** = 把現有景點加進行程；**移除 (Remove)** = 解除收藏或從備選清單移除（可復原、不銷毀資料）；**刪除 (Delete)** = 真正銷毀資料。收藏/備選的動作 MUST 用「移除」而非「刪除」。

#### Scenario: 收藏動作用「移除」

- **WHEN** 使用者在收藏或備選清單上要拿掉一筆
- **THEN** UI 文案 SHALL 顯示「移除」而非「刪除」，且不銷毀底層 POI 資料

#### Scenario: 銷毀資料才用「刪除」

- **WHEN** 動作會永久銷毀行程/景點/筆記資料
- **THEN** UI 文案 SHALL 用「刪除」

### Requirement: 可復原刪除直接執行並提供 undo

單筆、可復原的刪除 SHALL 直接執行，不跳確認視窗，並提供 undo（底部「已刪除・復原」toast，對齊 macOS `⌘Z` 語意）。此類操作 MUST NOT 使用 Alert 二次確認。

#### Scenario: 刪除單一景點

- **WHEN** 使用者刪除一個行程景點（可復原）
- **THEN** 系統 SHALL 立即刪除並顯示底部「已刪除・復原」toast，且 SHALL NOT 跳出確認視窗

#### Scenario: 移除收藏

- **WHEN** 使用者移除一筆收藏
- **THEN** 系統 SHALL 立即移除並可即刻還原，且 SHALL NOT 跳出確認視窗

### Requirement: 不可逆刪除必須 Alert 確認

不常發生且不可逆的刪除（如刪除整趟行程）SHALL 跳出 Alert 二次確認。Alert MUST 具備：可獨立理解的標題（含對象名稱）、說明將永久刪除哪些資料、以動詞命名的按鈕。

#### Scenario: 刪除整趟行程

- **WHEN** 使用者從 overflow 選單選擇刪除整趟行程
- **THEN** 系統 SHALL 跳出 Alert，標題如「刪除『京都五日行』？」、說明「行程、景點、筆記與共編資料將永久刪除」、按鈕為「取消」與紅色「刪除行程」

### Requirement: 破壞性按鈕樣式與 Alert 按鈕排列

破壞性按鈕 MUST 使用系統紅色、MUST NOT 套用 Tripline 品牌主色、MUST NOT 設為主要/預設按鈕。Alert 按鈕 SHALL 置於右下角橫排、預設按鈕在最右；預設按鈕 MUST 只執行安全動作（避免 Enter 誤觸破壞），故高誤觸風險時 Cancel SHALL 為預設按鈕。按鈕文字 MUST 用動詞（「刪除行程」），MUST NOT 用「確定／是／否」等脫離語境的字。

#### Scenario: 破壞按鈕非預設

- **WHEN** 一個 Alert 含破壞性動作（刪除）
- **THEN** 破壞按鈕 SHALL 為紅色、非預設；Cancel SHALL 為預設按鈕（Enter 觸發安全動作）

#### Scenario: 按鈕用動詞

- **WHEN** 任何確認 Alert 呈現
- **THEN** 按鈕文字 SHALL 為描述結果的動詞，SHALL NOT 為「確定／是／否」

### Requirement: macOS 動作入口（非 iOS 手勢）

桌機 CRUD 動作入口 SHALL 用 macOS 載體：**新增**走 toolbar 標準 `＋` / 標題列按鈕（可綁 `⌘N`）；**單筆動作**走 hover 顯示列尾按鈕 + 右鍵 contextual menu（+ `Delete` 鍵）；**undo** 走 `⌘Z` / 底部 toast；**批次**走 `⌘/⇧` 多選 + toolbar/選單刪除。桌機 MUST NOT 使用 FAB（Material 浮動鈕）或 hamburger 選單，MUST NOT 依賴 iOS 滑動刪除手勢。

#### Scenario: 新增入口

- **WHEN** 使用者要新增行程或景點
- **THEN** 入口 SHALL 為 toolbar/標題列的標準 `＋` 或按鈕（非 FAB）

#### Scenario: 單筆動作入口

- **WHEN** 使用者要對清單中單筆項目執行刪除/移除
- **THEN** 系統 SHALL 提供 hover 顯示的列尾動作與右鍵 contextual menu（非滑動手勢）

#### Scenario: 批次刪除

- **WHEN** 使用者以 `⌘/⇧`-點擊多選後刪除
- **THEN** 系統 SHALL 提供 toolbar/選單刪除；僅永久刪除時 SHALL 再以 Alert 確認
