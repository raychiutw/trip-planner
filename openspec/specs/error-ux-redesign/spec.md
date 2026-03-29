## ADDED Requirements

### Requirement: 結構化錯誤碼系統

#### Scenario: ErrorCode enum（前後端共用）
- **GIVEN** src/types/api.ts
- **THEN** SHALL 定義 16 個錯誤碼：NET_(2) + AUTH_(3) + PERM_(3) + DATA_(5) + SYS_(3)
- **AND** SHALL 提供 ERROR_MESSAGES（每碼對應繁體中文訊息）
- **AND** 前端 src/lib/errors.ts 和後端 functions/api/_errors.ts SHALL 從同一來源 import

#### Scenario: 後端 AppError + middleware catch
- **WHEN** API handler 遇到錯誤
- **THEN** SHALL throw new AppError('CODE', 'detail')
- **AND** middleware catch SHALL 用 instanceof AppError 判斷
- **AND** 預期錯誤（AppError）SHALL 回傳 { error: { code, message, detail } }
- **AND** 非預期錯誤 SHALL 回傳 SYS_INTERNAL + 記錄 api_logs

#### Scenario: 前端 ApiError + 向下相容
- **WHEN** apiFetch 收到非 200 response
- **THEN** SHALL 解析為 ApiError（支援新舊格式 sniff）
- **AND** 新格式 { error: { code } } SHALL 直接用 code
- **AND** 舊格式 { error: "string" } SHALL 從 status + 訊息 sniff 出 code
- **AND** fetch 失敗（TypeError / AbortError）SHALL 產生 NET_TIMEOUT / NET_OFFLINE

### Requirement: 錯誤 UI 元件

#### Scenario: Toast 通知系統
- **THEN** SHALL 支援 5 種類型：error, success, info, offline, online
- **AND** SHALL 支援多個 Toast 堆疊顯示
- **AND** SHALL 3 秒自動消失（可自訂 duration）
- **AND** SHALL 頂部 iOS 風格滑入動畫
- **AND** SHALL 有 role="alert" + aria-live="polite"
- **AND** error severity=minor SHALL 不跳 Toast

#### Scenario: ErrorPlaceholder
- **WHEN** 資料載入失敗
- **THEN** SHALL 在原位顯示灰色區塊 + 錯誤原因 + 「重新整理頁面」提示
- **AND** SHALL 內嵌 ReportButton（收集 context + POST /api/reports）

#### Scenario: 離線回報暫存
- **WHEN** ReportButton POST 失敗（離線）
- **THEN** SHALL 存入 localStorage pendingErrorReports（上限 10 筆）
- **AND** 上線後 SHALL flushPendingReports 自動送出
- **AND** 送出成功 SHALL 清除暫存，失敗保留

### Requirement: POST /api/reports（公開端點）

#### Scenario: 正常回報
- **WHEN** POST /api/reports 帶有效 body（tripId 必填）
- **THEN** SHALL 回傳 201 + INSERT error_reports

#### Scenario: 蜜罐防護
- **WHEN** body 含 website 或 email_confirm 欄位
- **THEN** SHALL 回傳 200（假裝成功）但 SHALL NOT 寫入 DB

#### Scenario: Rate limit
- **WHEN** 同 tripId + URL 30 秒內重複回報
- **THEN** SHALL 回傳 429

#### Scenario: 不需認證
- **THEN** middleware SHALL 放行 POST /api/reports（公開端點白名單）

### Requirement: Sentry 自動上報

#### Scenario: SYS_* 錯誤
- **WHEN** apiFetch 解析出 SYS_* 開頭的 ErrorCode
- **THEN** SHALL Sentry.captureException + tags { errorCode, category: 'system' }

### Requirement: 消除靜默失敗

#### Scenario: useTrip day 載入失敗
- **WHEN** fetchDay 或 fetchAllDays 發生 ApiError
- **THEN** SHALL 呼叫 showErrorToast（依 severity）

#### Scenario: useTrip doc 載入失敗
- **WHEN** fetchAllDocs 發生 ApiError
- **THEN** severity=minor SHALL 不跳 Toast
- **AND** severity > minor SHALL 跳 Toast

#### Scenario: 100% 繁體中文
- **THEN** 全部 API error detail SHALL 為繁體中文
- **AND** SHALL NOT 含英文錯誤訊息

### Requirement: 資料異常偵測 + Telegram 通知

#### Scenario: daily-report 異常偵測
- **WHEN** daily-report.js 執行
- **THEN** SHALL 檢查：空行程、孤立 trip_pois、使用者錯誤回報（24h）、POI 缺 google_rating > 30%
- **AND** 有異常 SHALL 加入報告 + 發送 Telegram 通知

#### Scenario: Telegram 通知
- **GIVEN** TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID（GitHub Secrets / .env.local）
- **WHEN** 偵測到資料異常
- **THEN** SHALL 透過 Telegram Bot API sendMessage 發送
- **AND** 未設定 token 時 SHALL 靜默跳過
