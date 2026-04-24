# V2 OAuth Server 實作計畫

**Date:** 2026-04-25
**Decision owner:** Ray Chiu
**Status:** Day 0 spike pending

---

## TL;DR

- **選擇**：Panva `oidc-provider` + 自寫 D1 adapter + CF Pages Functions
- **先做 Day 0 spike**（1-2 天）驗證 `oidc-provider` 跑得了 CF Workers runtime（靠 `nodejs_compat` flag）
- **若 spike 過**：繼續 14 週 phased implementation（V2-P1 → V2-P7）
- **若 spike fail**：fallback 到 `@openauthjs/openauth`（accept KV binding）

---

## 選擇脈絡

### 為何不是其他選項

2026-04-24 session 原 plan 是 `@openauthjs/openauth`，但官方 adapter 只支援 KV 不支援 D1。Codex 也實地驗證過（https://openauth.js.org/）。

2026-04-25 session 重新評估，跨語言 OAuth server（Authelia / Rauthy / Ory Hydra）全部排除因為：

| Constraint | 結果 |
|-----------|------|
| 要 deploy 到 Cloudflare | V8 isolates = JS/TS（+ WASM） only — Go/Java/Python runtime 都不能跑 |
| Cloudflare Containers | 2024 beta / waitlist / enterprise，未普及 |
| WASM OAuth servers | 既有 Rust servers（Rauthy 等）無 WASM build |

能 deploy 到 CF 的真實選擇剩：
1. **`@openauthjs/openauth`** — KV only（破壞 D1-only convention）
2. **Panva `oidc-provider` + 自寫 D1 adapter**（**選這個**）
3. **自寫 TS from scratch**（16+ 週，security 風險高）

### 為何 Panva `oidc-provider`

- **OAuth 2.0 / OIDC spec reference implementation** — 7 年老牌，比 openauthjs alpha 穩定非常多
- **Adapter pattern** — 可自寫 D1 adapter（~200 行 TS 實作 `Adapter` interface）
- **MIT license、社群大** — StackOverflow / GitHub issues 豐富
- **支援 `nodejs_compat`** — CF Workers 2024 中推出的 Node compat 應足以跑（Day 0 spike 要驗）
- **Workload 可控** — 14 週 vs openauthjs 12 週（+2 週 adapter 時間，值得換 D1 + 成熟度）

---

## Day 0 Spike（1-2 天）

**目的**：驗證 `oidc-provider` 可在 CF Pages Functions（`nodejs_compat` flag）跑起來，基本 GET `/oauth/.well-known/openid-configuration` 有正確 response。

### Step 1 — 加 nodejs_compat flag

```toml
# wrangler.toml
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]  # 新增
```

### Step 2 — Install `oidc-provider`

```bash
npm install oidc-provider
npm install -D @types/oidc-provider
```

**潛在 risk**：`oidc-provider` 內部依賴 `koa`（Node HTTP server framework）。Workers 不是 Node HTTP model — 要驗證 `koa` 能否在 V8 isolates + nodejs_compat 下 instantiate。

**Fallback 若 `koa` 不 work**：改用 Panva 的**低階 lib 組合**（`jose` + `@panva/hkdf` + 自己 wire route handler），放棄 turnkey `oidc-provider`。這是 DIY route（跟 Option C 類似），14 週 → 18 週。

### Step 3 — Minimal spike Worker

建立 `functions/api/oauth/well-known/openid-configuration.ts`：

```ts
import Provider from 'oidc-provider';

// Hardcoded config for spike only — production config 在 V2-P1 做
const provider = new Provider('https://trip-planner-dby.pages.dev', {
  clients: [{
    client_id: 'test-client',
    client_secret: 'test-secret',
    redirect_uris: ['https://example.com/cb'],
  }],
});

export const onRequestGet: PagesFunction = async () => {
  const url = new URL('https://trip-planner-dby.pages.dev/oauth/.well-known/openid-configuration');
  // oidc-provider 的 Koa app 用 callback 取得 handler
  // 注意：這段是 pseudo-code，真實 glue 要驗證
  const response = await provider.callback()(url);
  return response;
};
```

**實際 glue code 要 trial-and-error** — 這正是 spike 的目的。

### Step 4 — Local test

```bash
npm run dev  # wrangler pages dev
curl http://localhost:8788/oauth/.well-known/openid-configuration
```

**期待 output**：JSON 含 `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`。

### Step 5 — Spike 結果判定

| 結果 | 決定 |
|------|------|
| ✅ `openid-configuration` 正確 response | 進 V2-P1（14 週 implementation） |
| ⚠️ Workers crash 但可 debug | 繼續 1 天 debug；若無法解，fallback |
| ❌ `oidc-provider` 根本不能 import（e.g. require `http.Server`） | Fallback 到 `@openauthjs/openauth` + KV |

Spike 結果寫到 `docs/v2-oauth-spike-result.md`（spike 做完後建）。

---

## 14 週 Phased Implementation（spike 過後）

### V2-P1 Identity core（Week 1-2）

- D1 migration：`users`, `auth_identities`（provider-agnostic schema，預留 Apple / LINE / local）
- `functions/api/oauth/` scaffold + D1 adapter 正式版
- Google OIDC 接入（tripline 當 OAuth **Client** 到 Google）
- User 註冊 / 登入 flow（session cookie + CSRF）
- **Deliverable**: `sign in with Google` 能進 tripline

### V2-P2 Local password（Week 3-4）

- Email + 密碼註冊（argon2id hash）
- Email verification（寄 token + confirm endpoint）
- 登入 flow

### V2-P3 忘記密碼（Week 5）

- 寄重設連結
- Token 1h TTL
- 重設密碼 + 舊 session 失效

### V2-P4 OAuth Server 基本（Week 6-8）

- Tripline 開始當 **Authorization Server**（不只是 Client）
- `/oauth/authorize` endpoint（PKCE + consent screen）
- `/oauth/token` endpoint（authorization_code / refresh_token grants）
- `/.well-known/jwks.json` + key rotation

### V2-P5 Token + Consent screen（Week 9-10）

- Consent screen UI（React page on tripline）
- Refresh token flow
- Token revocation endpoint
- Scope management

### V2-P6 Security hardening（Week 11-12）

- Rate limit（per-IP + per-client）
- PKCE enforcement
- Redirect URI strict matching
- Audit log（既有 audit_log table 擴充）
- Opaque session cookie + SHA-256 hash（非 JWT）

### V2-P7 Developer docs + audit + launch（Week 13-14）

- OAuth developer docs（client registration / integration guide）
- External security audit（Trail of Bits / Cure53 booking 4-8 週 lead time，建議 V2-P1 就 book）
- Public launch 宣告

---

## D1 Adapter interface 草稿

Panva `oidc-provider` 的 [`Adapter`](https://github.com/panva/node-oidc-provider/blob/main/lib/models/adapter.js) interface 要實作這幾個 method：

```ts
// src/server/oauth-d1-adapter.ts
import type { D1Database } from '@cloudflare/workers-types';

interface AdapterPayload {
  [key: string]: unknown;
  jti?: string;
  iat?: number;
  exp?: number;
}

export class D1Adapter {
  constructor(private db: D1Database, private name: string) {
    // name = Session / AuthorizationCode / AccessToken / RefreshToken / ...
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    await this.db
      .prepare('INSERT OR REPLACE INTO oauth_models (name, id, payload, expires_at) VALUES (?, ?, ?, ?)')
      .bind(this.name, id, JSON.stringify(payload), Date.now() + expiresIn * 1000)
      .run();
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const row = await this.db
      .prepare('SELECT payload, expires_at FROM oauth_models WHERE name = ? AND id = ?')
      .bind(this.name, id)
      .first<{ payload: string; expires_at: number }>();
    if (!row) return undefined;
    if (row.expires_at < Date.now()) return undefined;
    return JSON.parse(row.payload);
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    // device flow — 之後 V2-P5 再做
    throw new Error('device flow not implemented');
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    // session lookup by session uid
    const row = await this.db
      .prepare('SELECT payload FROM oauth_models WHERE name = ? AND json_extract(payload, "$.uid") = ?')
      .bind(this.name, uid)
      .first<{ payload: string }>();
    return row ? JSON.parse(row.payload) : undefined;
  }

  async consume(id: string): Promise<void> {
    // mark authorization_code as used (one-shot)
    await this.db
      .prepare('UPDATE oauth_models SET payload = json_set(payload, "$.consumed", ?) WHERE name = ? AND id = ?')
      .bind(Date.now(), this.name, id)
      .run();
  }

  async destroy(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM oauth_models WHERE name = ? AND id = ?')
      .bind(this.name, id)
      .run();
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM oauth_models WHERE json_extract(payload, "$.grantId") = ?')
      .bind(grantId)
      .run();
  }
}
```

**D1 schema**：
```sql
CREATE TABLE oauth_models (
  name TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,     -- JSON
  expires_at INTEGER NOT NULL,  -- unix ms
  PRIMARY KEY (name, id)
);
CREATE INDEX idx_oauth_models_expires ON oauth_models(expires_at);
CREATE INDEX idx_oauth_models_grant ON oauth_models((json_extract(payload, '$.grantId')));
```

---

## Risk + mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `oidc-provider` 依賴的 `koa` 在 `nodejs_compat` 下無法 instantiate | **Medium** | Day 0 spike 驗證；fail 則 fallback `@openauthjs/openauth` |
| `jose` / `crypto` 模組 Workers 支援度 | Low | Workers 已支援 Web Crypto API；`oidc-provider` 用 `jose` 應該 compatible |
| D1 adapter 有效能瓶頸（concurrent session write） | Low-Medium | Tripline 現階段規模 << D1 write capacity；未來 scale 時再換 adapter 到 Durable Objects |
| `expires_at` 清掃 — D1 不自動 TTL | Medium | Cron Trigger 每小時跑 `DELETE WHERE expires_at < now`；或 lazy delete on `find` |
| Cloudflare Pages Functions cold start 延遲 | Low | Pages Functions warm-up 快；OAuth token path 不是超 hot-path |

---

## 下一步

1. **先做 Day 0 spike**（1-2 天）— 現在啟動
2. **Spike 結果 commit 成 `docs/v2-oauth-spike-result.md`**
3. **若 green-light**：開 branch `feat/v2-p1-identity-core` 開始 V2-P1
4. **若 red-light**：切換 fallback（`@openauthjs/openauth` + KV），更新 roadmap

## 相關資源

- [Panva oidc-provider](https://github.com/panva/node-oidc-provider)
- [Panva oidc-provider docs](https://github.com/panva/node-oidc-provider/blob/main/docs/README.md)
- [Cloudflare Workers nodejs_compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [既有 OAuth design doc](design-sessions/lean-master-design-20260424-163000-oauth-server.md)
- [Roadmap](2026-04-24-saas-pivot-roadmap.md)
