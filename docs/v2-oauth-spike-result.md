# V2 OAuth Day 0 Spike — Result

**Date:** 2026-04-25
**Runner:** Claude (Opus 4.7) on Ray's branch `feat/v2-day0-spike`
**Related plan:** `docs/v2-oauth-server-plan.md`

---

## TL;DR

✅ **GREEN — 進 V2-P1。**

Panva `oidc-provider` 在 Cloudflare Pages Functions + `nodejs_compat` flag 下能 `import` 並 `new Provider()` instantiate 成功，`issuer` 正確回傳。沒有 fallback 必要。

---

## 驗證步驟（Plan 的 Step 1-5）

### Step 1 — `nodejs_compat` flag 加進 wrangler.toml

```toml
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]
```

### Step 2 — `npm install oidc-provider`

```
added 45 packages, and audited 699 packages in 5s
```

> ⚠️ **依賴帶入 5 個 vulnerability**（1 moderate / 4 high），但全部為 pre-existing 的 build-tools 鏈（`vite-plugin-pwa` → `workbox-build` → `@rollup/plugin-terser` → `serialize-javascript`、`postcss` XSS in stringify）— **不是 `oidc-provider` 引入**。此 spike 不處理。

### Step 3 — Minimal endpoint

`functions/api/oauth/spike.ts`：

```ts
import Provider from 'oidc-provider';

export const onRequestGet: PagesFunction = async () => {
  try {
    const provider = new Provider('https://trip-planner-dby.pages.dev', {
      clients: [{ client_id: 'test-client', client_secret: '...', redirect_uris: [...] }],
    });
    return new Response(JSON.stringify({ ok: true, issuer: provider.issuer }));
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: ... }), { status: 500 });
  }
};
```

### Step 4 — Local test

```bash
npx wrangler pages dev dist --local --port 8788 --compatibility-flag=nodejs_compat &
curl http://localhost:8788/api/oauth/spike
```

**Response：**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "message": "oidc-provider imported + instantiated inside CF Pages Functions (nodejs_compat)",
  "issuer": "https://trip-planner-dby.pages.dev"
}
```

### Step 5 — 判定

| 判定維度 | 結果 |
|---------|------|
| `oidc-provider` import 不 crash | ✅ |
| `new Provider(...)` instantiate 成功 | ✅ |
| `provider.issuer` 讀出正確 URL | ✅ |
| Handler HTTP 200 | ✅ |
| **進 V2-P1？** | **✅ YES** |

---

## 觀察（不阻擋進入 V2-P1，但要注意）

### 觀察 1：runtime warning

wrangler 啟動時，log 有一行：

```
oidc-provider WARNING: Unsupported runtime. Use Node.js v22.x LTS, or a later LTS release.
```

**解讀**：
- `oidc-provider` 內部有 runtime detection；CF Workers 的 `globalThis` / `process.version` 不符合它判斷為 Node.js 的條件
- **Import 和 instantiate 都照跑** — warning 不是 error
- 未來 `oidc-provider` 版本若收緊 runtime check（refuse to run if unsupported）可能 break

**V2-P1 對應**：
- pin `oidc-provider` major version（避免自動升級撞 breaking 變更）
- V2-P7 audit 前要跑完整 conformance test（authorization_code / refresh_token / revocation grants + CSRF + PKCE + JWKS）確認沒有功能被 runtime-gated

### 觀察 2：只驗到 instantiate，沒驗 callback handler

Plan 原本期待驗 `GET /oauth/.well-known/openid-configuration`，此 spike 只驗到 `provider.issuer`。

**為何跳過 well-known 驗證**：
- `oidc-provider` v8+ 暴露的是 Koa `app.callback()`，返回 Node `http.IncomingMessage` → `http.ServerResponse` handler
- CF Workers 用的是 Fetch `Request` / `Response` — 需要 adapter 層把 Fetch API 轉成 Node HTTP API 呼叫 Koa handler
- 此 adapter 是 V2-P1 的實作重點，不是 Day 0 要做的事

**V2-P1 要做的 adapter**：建立 `src/server/oidc-fetch-adapter.ts`，把 Fetch Request/Response pair 轉成 `oidc-provider` 期望的 Node HTTP I/O。可參考 [`koa-to-worker`](https://www.npmjs.com/search?q=koa%20workers) 類工具，或自寫（< 100 行）。

### 觀察 3：Cold-start overhead 未測

`new Provider()` instantiate 的成本（內部建 JWKS / 初始化 Koa app）在 Workers cold-start 時會累計。此 spike 沒量 latency。

**V2-P1 要量**：
- 第一次 request（cold）: 期望 < 500ms
- 後續（warm）: 期望 < 50ms
- 若 cold > 1s，考慮 Durable Object 包 provider 以共用 instance

### 觀察 4：D1 adapter 還沒寫

Spike 用 `oidc-provider` 預設 in-memory adapter — 不持久化。正式實作要寫 D1 adapter（Plan Section「D1 Adapter interface 草稿」）。

---

## 下一步（V2-P1 啟動 checklist）

在 V2-P1 `feat/v2-p1-identity-core` branch 上：

- [ ] 建 migration `00XX_oauth_models.sql`（`oauth_models` + indexes — plan Section 末尾）
- [ ] 實作 `src/server/oauth-d1-adapter.ts`（6 個 method：`upsert` / `find` / `findByUserCode` / `findByUid` / `consume` / `destroy` / `revokeByGrantId`）
- [ ] 建 `src/server/oidc-fetch-adapter.ts`（Fetch ↔ Node HTTP bridge）
- [ ] 測量 cold-start / warm latency（若 cold > 1s → DO migration）
- [ ] 跑 `oidc-provider` 官方 conformance test（`openid-certification`）
- [ ] Book External security audit（Trail of Bits / Cure53 lead time 4-8 週）
- [ ] **Prerequisite:** 前 session Day-0 demand 驗證 2 件（Access deny log + 第三方 dev interview）— 見 `docs/2026-04-24-saas-pivot-roadmap.md`

---

## 如果 spike fail 了會怎樣（紀錄 fallback 路徑，現在不用）

**Fallback：** `@openauthjs/openauth` + Cloudflare KV binding

- 14 週 → 12 週（openauthjs 成熟度較低但 CF 原生，不用寫 adapter）
- 破壞 D1-only convention（多一個 binding）
- 長期成本估算：tripline 現規模 stays in free tier up to 10k DAU

---

## 本 PR 產出

- `wrangler.toml` — 加 `compatibility_flags = ["nodejs_compat"]`
- `package.json` + `package-lock.json` — `oidc-provider` 加進 dependencies
- `functions/api/oauth/spike.ts` — Day 0 spike endpoint（留著當 V2-P1 起點參考；V2-P1 會 rewrite）
- `docs/v2-oauth-spike-result.md` — 本文
