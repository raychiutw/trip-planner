# Plan: 本機開發環境 — 多環境切換 + Mock Auth + 一鍵初始化

**Status: ARCHIVED** (merged PR #138, 2026-03-29)

## 動機

目前開發迴圈太慢：改 API code 要 push 到 staging 才能測試，且寫入 API 被 Cloudflare Access 擋住。需要本機完整 stack（前端 + API + DB + mock auth）。

## 需求

```
npm run dev:init         → 一鍵建本機 SQLite（migrations + 匯入資料）
npm run dev              → vite + wrangler 並行（local SQLite + mock auth）
npm run dev:staging      → vite + wrangler（staging D1 + mock auth）
npm run dev:prod         → vite + wrangler（prod D1 + mock auth，唯讀建議）
```

## 設計

### 1. Mock Auth（`_middleware.ts`）

偵測 `DEV_MOCK_EMAIL` env var → 注入假 auth，跳過 JWT 驗證。

```typescript
// 在 handleAuth 最前面加
if (env.DEV_MOCK_EMAIL) {
  const email = env.DEV_MOCK_EMAIL.toLowerCase();
  (context.data as Record<string, unknown>).auth = {
    email,
    isAdmin: email === (env.ADMIN_EMAIL || '').toLowerCase(),
    isServiceToken: false,
  };
  return context.next();
}
```

- `DEV_MOCK_EMAIL` 放在 `.env.local`（已在 .gitignore，不進版控）
- 預設值 `lean.lean@gmail.com`（不進版控）
- Production 不會有這個 env var → 不影響線上

### 2. Env 型別（`_types.ts`）

```typescript
DEV_MOCK_EMAIL?: string;  // 加到 Env interface
```

### 3. Vite proxy 修正（`vite.config.ts`）

目前 proxy 打 production — 改為打本地 wrangler：

```typescript
proxy: process.env.MOCK_API ? {} : {
  '/api': {
    target: 'http://localhost:8788',  // 改為本地 wrangler pages dev
    changeOrigin: true,
  },
},
```

### 4. package.json scripts

```json
"dev:init": "node scripts/init-local-db.js",
"dev": "concurrently -n vite,api -c cyan,green \"vite\" \"wrangler pages dev dist --d1=DB --local --port 8788\"",
"dev:staging": "concurrently -n vite,api -c cyan,yellow \"vite\" \"wrangler pages dev dist --env preview --port 8788\"",
"dev:prod": "concurrently -n vite,api -c cyan,red \"vite\" \"wrangler pages dev dist --port 8788\""
```

### 5. 本機 SQLite 初始化腳本（`scripts/init-local-db.js`）

一鍵初始化：

```javascript
// 1. 跑所有 migrations（建表）
execSync('npx wrangler d1 migrations apply trip-planner-db --local');

// 2. 從最新 backup 匯入資料（pois + trip_pois + trip_entries + trip_days + trips 等）
//    讀 backups/ 目錄找最新快照，逐表 INSERT
const backupDir = findLatestBackup();
for (const table of ['trips', 'trip_days', 'trip_entries', 'pois', 'trip_pois', ...]) {
  const rows = JSON.parse(fs.readFileSync(`${backupDir}/${table}.json`));
  // 批次 INSERT INTO table VALUES (...)
}

// 3. 驗證
console.log('Local DB ready: X trips, Y entries, Z pois');
```

### 6. `.env.local` 範例

新增 `.env.local.example`（進版控，給其他開發者參考）：

```
# Copy to .env.local and customize
DEV_MOCK_EMAIL=your-email@example.com
ADMIN_EMAIL=lean.lean@gmail.com
```

## 安全考量

- `DEV_MOCK_EMAIL` 只在 `.env.local`，不進版控
- Production Env 有 `DEV_MOCK_EMAIL?: string` 但值 undefined → mock 不觸發
- Vite proxy 改指本地 → 開發不再意外寫入 production
- CSRF 保護保持不變（localhost origin 已被允許）

## 執行順序

```
1. _types.ts — 加 DEV_MOCK_EMAIL
2. _middleware.ts — mock auth 邏輯
3. scripts/init-local-db.js — 本機 DB 初始化
4. vite.config.ts — proxy 改 localhost:8788
5. package.json — 4 個 dev scripts + concurrently 依賴
6. .env.local.example — 範例檔（進版控）
7. 測試：npm run dev:init → npm run dev → 驗證
```

## 影響範圍

| 檔案 | 變更 |
|------|------|
| `functions/api/_types.ts` | +1 行 |
| `functions/api/_middleware.ts` | +8 行 |
| `scripts/init-local-db.js` | 新增 ~80 行 |
| `vite.config.ts` | proxy target 改 1 行 |
| `package.json` | +4 scripts + concurrently dep |
| `.env.local.example` | 新增 3 行 |
| `CLAUDE.md` | 加開發環境說明 |

## 不做的事

- 不改 wrangler.toml（現有 env.preview 已夠用）
- 不建獨立的 mock server（直接用 wrangler pages dev）
- 不改 Cloudflare Access 設定
- 不做 hot-reload wrangler（wrangler pages dev 已內建）
