## Architecture

```
  前端（React SPA）
  ┌─────────────────────────────────────────────────┐
  │  useApi ──→ ApiError class ──→ 錯誤分類引擎      │
  │                                    │             │
  │              ┌─────────┬───────────┼─────┐       │
  │         Toast(頂部)  ErrorPlaceholder  ErrorBoundary │
  │              │         └─ ReportButton             │
  │              │                                     │
  │         Sentry.captureException                    │
  └────────────────────────────────────────────────────┘
                        │
  後端（Cloudflare Pages Functions）
  ┌────────────────────────────────────────────────────┐
  │  AppError class ← _errors.ts（ErrorCode enum）      │
  │       ↓                                            │
  │  _middleware.ts catch: instanceof AppError?          │
  │    是 → errorResponse(code, status)                 │
  │    否 → SYS_INTERNAL + Sentry                      │
  │                                                    │
  │  POST /api/reports → D1 error_reports + Telegram   │
  └────────────────────────────────────────────────────┘
```

### 錯誤碼共用

`src/types/api.ts` 定義 ErrorCode enum，前端 `src/lib/errors.ts` 和後端 `functions/api/_errors.ts` 都從這裡 import。單一來源。

### 錯誤流

1. API 端點遇到錯誤 → `throw new AppError('DATA_NOT_FOUND')`
2. `_middleware.ts` catch → `instanceof AppError` → 回傳 `{error: {code, message, detail}}`
3. 前端 `useApi` 收到 → 解析為 `ApiError`（支援新舊格式 sniff）
4. 錯誤分類引擎 → 依 code 前綴決定嚴重度 → 觸發對應 UI
5. SYS_* → 自動上報 Sentry + Telegram

### NET_* 前端產生

- `fetch` TypeError → `NET_OFFLINE`
- `AbortController` timeout → `NET_TIMEOUT`
- 不出現在 API response

## Key Decisions

| 決定 | 選擇 | 理由 |
|------|------|------|
| API 錯誤 pattern | throw + catch（非 helper function） | 更乾淨，middleware 統一處理 |
| catch 判斷 | 單一 catch + instanceof | AppError 用其 code；其他才 Sentry |
| Toast 位置 | 頂部 iOS 風格 | 使用者習慣 |
| Toast 堆疊 | 每個獨立，不合併 | 使用者看到每個錯誤 |
| 自動重試 | 不做 | 提示重新整理即可 |
| ReportButton 位置 | ErrorPlaceholder 內部 | 緊鄰錯誤才有上下文 |
| /api/reports 認證 | 公開端點 + rate limit + 蜜罐 | 使用者多為未登入 |
| 離線回報 | localStorage 暫存，上線自動送，上限 10 筆 | 旅行場景弱網 |
| 401 公開頁 | Toast 提示，不中斷瀏覽 | 瀏覽不需認證 |
| D1 vs Telegram | D1 主路徑（失敗告知使用者），Telegram 靜默 | 不丟資料 |
| Toast color | tokens.css — destructive-bg/success-bg/secondary | 和行程頁風格一致 |
| 部署策略 | 同一個 PR，migration 先跑 | 向下相容 sniff 確保不壞 |

## Data Model

```sql
CREATE TABLE error_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  url TEXT,
  error_code TEXT,
  error_message TEXT,
  user_agent TEXT,
  context TEXT,  -- JSON: 頁面狀態、day_num 等
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Error Code Table

```
NET_TIMEOUT          連線逾時，請檢查網路
NET_OFFLINE          目前離線，顯示快取資料
AUTH_REQUIRED        請先登入
AUTH_EXPIRED         登入已過期，請重新登入
AUTH_INVALID         認證失敗，請重新登入
PERM_DENIED          你沒有此操作的權限
PERM_ADMIN_ONLY      僅管理員可操作
PERM_NOT_OWNER       這不是你的行程
DATA_NOT_FOUND       找不到這筆資料
DATA_VALIDATION      資料格式不正確
DATA_CONFLICT        這筆資料已經存在
DATA_ENCODING        文字編碼有誤，請用 UTF-8
DATA_SAVE_FAILED     儲存失敗，請再試一次
SYS_INTERNAL         系統發生錯誤，已通知開發團隊
SYS_DB_ERROR         資料庫忙碌中，請稍後再試
SYS_RATE_LIMIT       操作太頻繁，請稍等
```

## UI 元件規格

### Toast
- 位置：頂部，從上滑入（iOS 通知風格）
- 堆疊：多個可同時存在，垂直排列
- 時長：3 秒自動消失
- 顏色：錯誤 `bg-destructive-bg text-destructive`，成功 `bg-success-bg text-success`，一般 `bg-secondary text-foreground`
- 手機版全寬（padding-h），桌面版最大 400px 置中
- `role="alert"` + `aria-live="polite"`

### ErrorPlaceholder
- 原位灰色區塊，跟隨父容器寬度
- 顯示：錯誤原因 + 「重新整理頁面」提示文字
- 內嵌 ReportButton
- 無重試按鈕

### ReportButton
- 最小觸控 44px
- 按下 → 收集 context（URL, tripId, dayNum, errorCode, UA, timestamp）
- POST /api/reports → Toast「已回報」/ Toast「回報失敗」
- 離線 → 存 localStorage，上線自動送

## Severity Mapping

| 嚴重度 | 情境 | 呈現 |
|--------|------|------|
| 輕微 | 單筆 doc 載入失敗 | 只有 ErrorPlaceholder |
| 中等 | Day/POI 載入失敗 | ErrorPlaceholder + Toast |
| 嚴重 | 行程不存在、系統錯誤 | 全頁 ErrorBoundary |
| 背景 | 網路恢復、儲存成功 | 只有 Toast |
