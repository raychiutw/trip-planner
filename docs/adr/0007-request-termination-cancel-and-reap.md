# ADR-0007：AI 聊天請求的終結 —— 取消＝停止等待，終結原因獨立成欄

- **Status**：Accepted
- **來源**：2026-07-28 `/grill-with-docs`（「AI 聊天卡在處理中」）

## Context

`trip_requests` 停在 `processing` 就永遠停在那裡。api-server 的 reaper 到 90 分鐘 orphan cap 只 `tmux kill-session`，完全不動 request row；除了 notes AI job 的 10 分鐘超時與 mint-restricted 的 no-consent park，沒有任何機制會替一般聊天請求收屍。

後果不只是「多一個轉圈圖示」：`ChatPage` 的 `composerDisabled` 綁 inflight 請求，所以一筆殭屍請求會讓**整個聊天不能用**；而 api-server 的 `peekPendingRequest` 依 `processing → open, oldest-first` 撈，一筆殭屍還會 head-of-line block 所有行程的隊列。

使用者的訴求其實是兩件事：**「已經沒人在處理了」**（系統該收屍）與**「我不想等了」**（使用者該有出口）。

## Decision

**取消的語意是「停止等待」，不是「中止 AI」。** 按下去只把 request 標成終結、放開輸入框、解開隊列。不追殺 mac mini 上的 claude session —— 那需要一整條新的控制通道，而 claude REPL 沒有安全中斷點，強行中止只會留下更難解釋的半套改動。

**終結原因存成獨立欄位 `terminal_reason`（`cancelled` / `timed_out` / `error` / `needs_consent`），`status` 維持既有四值。**

**兩層收屍，時鐘必須錯開**：

1. api-server 在**確定不會再有人處理**時就地標 `timed_out` —— reaper 收尾、tmux 起不來、REPL 未就緒、skill 未提交。`containmentReady()` 為 false **不標**（暫時性失敗，下輪 cron 會再試）。
2. 100 分鐘牆鐘兜底，lazy 掛在 `GET /requests/:id` 與 SSE 端點，涵蓋 api-server 自己掛掉／mac mini 離線。

**終結後 worker 遲到的 PATCH，`status` 段當 no-op 不丟 400，`reply` 照寫。**

## Considered Options

**把 `cancelled` / `timed_out` 加進 `status`（否決）。** 語意最正，但 SQLite 改 CHECK constraint 只能整張表 swap，而 `trip_requests` 現在有 4 張 children FK（`poi_favorites` companion 映射、`trip_health_reports`、trip_notes linkage、`trip_note_ai_jobs`，其中 3 條 `ON DELETE CASCADE`）。`migrations/0047` 開頭記著這條路造成過 **prod 資料全失** —— D1 每個 statement 獨立 connection，`PRAGMA foreign_keys = OFF` 不持久，`DROP TABLE` 直接 CASCADE 砍光 children。要走就得寫 0047 那套 backup-restore 全套。純 `ALTER TABLE ADD COLUMN` 繞開整個地雷，`GROUP BY terminal_reason` 一樣聚合得到。

**牆鐘設 15 分鐘對齊「AI 健檢 5–15 分鐘」的文案（否決）。** 牆鐘**必須大於** `ORPHAN_MAX_AGE_MS`（90 分鐘），所以取 100 分鐘。短於它，健康 session 還在工作時 request 就被標終結 → session 的 `tripHasPending` 看不到待處理 → 自己 kill → 完全重演 #237（30 分鐘 orphan timeout 誤殺大 request，反覆重做永遠做不完）。使用者體驗不靠這層扛，靠一送出就在的「停止等待」鍵。

**完全靠 `reply` 文字區分終結原因（否決）。** 零 migration，但日後要統計「幾筆是超時死的」只能比對文字或翻 `audit_log`，而 `audit_log` 目前無保留期政策且 rollback 功能在讀它，不適合當長期報表來源。

## Consequences

- **取消不等於行程不會再被改。** entries／days 走 Option E owner 身份 token 經 `hasWritePermission`，不受 companion gate 約束（那個 gate 只掛 `poi-favorites` 三條路徑）。唯一邊界是 `mint-restricted` 只肯為 `open`/`processing` 的 request 簽章，所以既有 token 用到過期（≤1 小時）就再也續不到。UI 文案必須誠實反映這件事，不能講成「已中止」。
- 取消時前端**不寫 `reply`**，那格留給遲到回報。泡泡文案由 `terminal_reason` 驅動。
- 「停止等待」鍵一送出就在，不依賴任何時鐘 —— 也因此 `useRequestSSE` 的 `elapsedMs` 每次 mount 重新計時（重整後顯示錯誤的等候分鐘數）是**獨立**的既有問題，不阻擋這個決策。
- `terminal_reason` 是 additive 欄位 → 上線順序遵 additive 規則：**先套 migration 再 merge**（見 `ARCHITECTURE.md` 的 D1 migration 章節）。
- 一個終結語意拆在兩個欄位，讀取端要記得同時看 `status` 與 `terminal_reason`。這是為了避開 0047 地雷付的代價。
