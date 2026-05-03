# Email + Trigger Silent-Fail Fix via Mac Mini Tailscale

> **Date:** 2026-05-02 · **Owner:** Ray (lean.lean@gmail.com)
> **Status:** Plan + 6 questions resolved → 進入 Build 階段
> **PR strategy:** 單一 PR（user 拍板）
> **Parallel with:** `2026-05-02-osm-integration-trip-modal-v2`（互不依賴）

---

## Why

### 痛點 1 — Email 完全發不出去（silent fail 30+ 天）

`curl https://trip-planner-dby.pages.dev/api/public-config | jq .features.emailVerification` → `false`。CF Pages prod 沒設 `RESEND_API_KEY` 或 `EMAIL_FROM`，4 個 endpoint 全 silent-skip：

```ts
if (env.RESEND_API_KEY && env.EMAIL_FROM) { ... }
// 缺 → 整段 skip，API 仍回 200「驗證信會寄至信箱」
```

涉及：`functions/api/oauth/{send-verification,forgot-password,reset-password}.ts` + `functions/api/permissions.ts:81-105`。

### 痛點 2 — Resend 需要 verified domain，user 沒自家 domain

`trip-planner-dby.pages.dev` 是 CF Pages 預設 domain，user 沒 DNS 控制權，不能用作 from address。Resend 不能寄。

### 痛點 3 — vendor lock-in

跟 OSM 整合決策一致：能脫離 vendor 就脫。mac mini 已具備 always-on infrastructure。

### 痛點 4 — 即時觸發 silent-fail（trigger fetch 7+ 天沒運作）

D1 audit：過去 14 天 15 筆 `trip_requests`，**只有 1 筆 `processed_by='api'`（4/25）**，其餘 13 筆 + 4/26 之後全部 `processed_by='job'`（15 分鐘 cron 兜底）。

根因：
- `functions/api/requests.ts:173` `fetch(${TRIPLINE_API_URL}/trigger?source=api)` — silent `catch {}` 吞錯
- 既有 `TRIPLINE_API_URL=https://ray-chiudemac-mini.tail2750c0.ts.net/tripline/api`：
  - Tailscale serve 是 `tailnet only`（funnel 沒對外） → CF workerd 連不到
  - 路徑 `/tripline/api` 是 Caddy 規則，但 tailscale serve 直接打 18789（openclaw），沒過 Caddy
- → 兩條路都不通，全靠 15 分鐘 cron

User 體感：每筆 chat 訊息要等 0-15 分鐘才有回覆（不是即時 < 3s）。

**修法跟 Email PR 100% 重疊**（同 Tailscale funnel 8443 setup + 同 silent-skip → audit + telegram pattern），併同個 PR。

---

## What Changes

完全脫 Resend，改用 **mac mini Gmail SMTP via Tailscale Funnel**；同時修好即時觸發 silent-fail。

```
[browser POST /api/oauth/send-verification 或 /api/requests]
       │
       ▼
[CF Pages Functions]
   email path: src/server/email.ts → fetch ${TRIPLINE_API_URL}/internal/mail/send
   trigger path: functions/api/requests.ts → fetch ${TRIPLINE_API_URL}/trigger?source=api
   兩者 Authorization: Bearer ${TRIPLINE_API_SECRET}
   失敗 → audit_log + Telegram alert (silent-skip / silent-catch 改寫)
       │
       │ HTTPS via Tailscale Funnel 8443 (~200ms)
       ▼
[Mac mini ray-chiudemac-mini :6688]
   既有 endpoint (修好觸發路徑):
     POST /trigger?source=api   ← 既有，被 funnel 通了即時
     GET  /health
   新 endpoint:
     POST /internal/mail/send   ← 新，nodemailer Gmail SMTP
   Auth: Bearer TRIPLINE_API_SECRET (複用)
```

**4 件事全部不要**（user 拍板）：
- ❌ `email_outbox` D1 table
- ❌ `mailer-scheduler.ts` + 第二個 launchd plist
- ❌ Mac mini down 時的 fallback / retry
- ❌ Resend SDK / fetch code

**保留 + 改寫**：
- ✅ silent-skip / silent-catch 改 audit_log + Telegram alert（Q11 reuse audit_log）

---

## Capabilities

### New Capabilities

- `mac-mini-mailer` — `tripline-api-server` `/internal/mail/send` endpoint（auth / body schema / Gmail SMTP）
- `email-sync-via-tunnel` — CF Functions sync await mac mini tunnel email send

### Modified Capabilities

- `auth-email-flow` — 4 個 endpoint silent-skip 改 audit + telegram + throw
- `trip-invitation-email-flow` — permissions.ts:81-105 拔 silent return
- **`request-trigger-observability`** — `functions/api/requests.ts:166-185` `catch {}` 改 audit + telegram alert

### Removed Capabilities

- `resend-http-email`（implicit）— 既有 `src/server/email.ts:56` fetch Resend 的路徑全拔

---

## Impact

### Mac mini setup（user 自己跑）

```bash
# 1. (Q8 複用) 確認 GitHub Actions daily-report 用的 GMAIL_USERNAME + GMAIL_APP_PASSWORD
#    從 GH repo Settings → Secrets 看到密碼後拿來用
#    (不另申請新 App Password)

# 2. (Q9 .env.local) 加 env 到 .env.local
#    GMAIL_USERNAME=lean.lean@gmail.com
#    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
#    EMAIL_FROM=Tripline <lean.lean@gmail.com>

# 3. 安裝 nodemailer
cd /Users/ray/Projects/trip-planner
bun add nodemailer
bun add -D @types/nodemailer

# 4. 開 Tailscale Funnel 8443 對外暴露 6688
sudo tailscale funnel --bg --https=8443 http://127.0.0.1:6688

# 5. 確認對外可達
curl https://ray-chiudemac-mini.tail2750c0.ts.net:8443/health
# 應該回 {"running":...,"lastProcessed":...,"processedCount":...,"uptime":...}

# 6. 重啟 tripline-api-server (load 新 env + 新 endpoint)
launchctl unload ~/Library/LaunchAgents/com.tripline.api-server.plist
launchctl load ~/Library/LaunchAgents/com.tripline.api-server.plist
```

### CF Pages env vars（user 在 dashboard 改）

```
# 改 (從舊 path 改成新 funnel 8443 path)
TRIPLINE_API_URL=https://ray-chiudemac-mini.tail2750c0.ts.net:8443
   ← 既有 trigger 用 + 新 mailer 用，**同個 env，不另設 MAILER_TUNNEL_URL**
   ← endpoint = ${TRIPLINE_API_URL}/trigger?source=api 或 /internal/mail/send

EMAIL_FROM=Tripline <lean.lean@gmail.com>
TELEGRAM_BOT_TOKEN=xxx     ← 複用既有 daily-check (silent-skip alert 用)
TELEGRAM_CHAT_ID=6527604594  ← 複用既有

# 拔掉
RESEND_API_KEY  ← 拔 (不再需要 Resend)
```

→ prod + preview 兩 env 都改。

### Code 改動

| 檔案 | 改動 |
|---|---|
| `scripts/tripline-api-server.ts` | 新增 `POST /internal/mail/send` endpoint + `getTransporter()` helper（nodemailer） |
| `src/server/email.ts` | 改寫 `sendEmail()`：fetch Resend → fetch `${TRIPLINE_API_URL}/internal/mail/send`，sync await |
| `functions/api/oauth/send-verification.ts:67-84` | silent-skip → audit_log + Telegram alert + 失敗 throw 給 user 看到 500（Q7） |
| `functions/api/oauth/forgot-password.ts:105-122` | 同上（**Q7 全 endpoint 含 forgot-password 都誠實顯示失敗**，不例外回 200） |
| `functions/api/oauth/reset-password.ts:119-138` | 同上 |
| `functions/api/permissions.ts:81-105` | 同上（拔 silent `return;`） |
| **`functions/api/requests.ts:166-185`** | **trigger silent `catch {}` → audit_log + Telegram alert（trigger fail 也記）** |
| `functions/api/_audit.ts` | 加 `recordEmailEvent(env, kind, details)` helper（**Q11 reuse audit_log，table_name='email'**） |
| `functions/api/_alert.ts` | **新** — `alertAdminTelegram(env, msg)` workerd `fetch` Telegram API |
| `package.json` | `bun add nodemailer` + `@types/nodemailer` (devDep) |
| `.dev.vars.example` | 加 `GMAIL_USERNAME` + `GMAIL_APP_PASSWORD` + `EMAIL_FROM` 範例註解；移除 `RESEND_API_KEY` 註解 |
| `CLAUDE.md` | Required env 段落 update：拔 RESEND_API_KEY，加 GMAIL_*；註明 TRIPLINE_API_URL 改 funnel 8443 |

### `tripline-api-server.ts` 新 endpoint（範例）

```ts
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USERNAME || '';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || '';
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!GMAIL_USER || !GMAIL_PASS) throw new Error('GMAIL_USERNAME or GMAIL_APP_PASSWORD not set');
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
  }
  return transporter;
}

// Bun.serve fetch handler 內加：
if (url.pathname === '/internal/mail/send' && req.method === 'POST') {
  if (!verifyAuth(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json() as { to?: string; subject?: string; html?: string; template?: string };
  if (!body.to || !body.subject || !body.html) {
    return Response.json({ error: 'missing to/subject/html' }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `Tripline <${GMAIL_USER}>`,
      to: body.to, subject: body.subject, html: body.html,
    });
    const elapsed = Date.now() - t0;
    log(`mail sent: template=${body.template} to=${body.to} messageId=${info.messageId} ${elapsed}ms`);
    return Response.json({ ok: true, messageId: info.messageId, elapsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`mail send failed: template=${body.template} to=${body.to} error=${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

### CF Functions `src/server/email.ts` 改寫

```ts
export async function sendEmail(env: Env, opts: {
  to: string; subject: string; html: string; template: string;
}): Promise<void> {
  const url = env.TRIPLINE_API_URL;
  if (!url) throw new Error('TRIPLINE_API_URL not configured');

  const res = await fetch(`${url}/internal/mail/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TRIPLINE_API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts),
    signal: AbortSignal.timeout(10_000),  // 10s timeout
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Mailer responded ${res.status}: ${errText}`);
  }
}
```

### 4 個 oauth/permissions endpoint silent-skip 改寫範例（Q7 全部回 500）

```ts
// functions/api/oauth/send-verification.ts
try {
  await sendEmail(context.env, { to: email, subject, html, template: 'verification' });
  await recordEmailEvent(context.env, 'sent', { template: 'verification', to: email });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  await recordEmailEvent(context.env, 'failed', { template: 'verification', to: email, error: msg });
  await alertAdminTelegram(context.env, `Email send fail: verification → ${email} (${msg})`);
  return json({ error: '驗證信寄送失敗，請稍後再試' }, 500);  // Q7 — 誠實 UX
}
```

### `functions/api/requests.ts:166-185` 改寫範例（trigger silent-catch fix）

```ts
// 原本：try { await fetch(...) } catch {}
// 改成：
if (env.TRIPLINE_API_URL) {
  context.waitUntil((async () => {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(env.TRIPLINE_API_URL + '/trigger?source=api', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.TRIPLINE_API_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId: newRow ? (newRow as Record<string, unknown>).id : null }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Trigger responded ${res.status}`);
      // 成功不需要 audit（trigger 是 fire-and-forget，cron 也會 backup）
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordEmailEvent(env, 'trigger-failed', { error: msg, requestId: newRow?.id });
      await alertAdminTelegram(env, `Trigger fetch fail: ${msg} (cron 15min 兜底)`);
    }
  })());
}
```

→ 注意：trigger 失敗仍 OK（cron 15 分鐘兜底），但有 audit + alert 不再 silent。

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-02 | 完全脫 Resend，改 mac mini Gmail SMTP via Tailscale Funnel | mac mini infra 已具備；無需 verified domain；脫 vendor |
| 2026-05-02 | Tailscale Funnel 8443 → 6688，不動既有 443 → 18789 | 「只開 6688」要求；不影響 openclaw |
| 2026-05-02 | mailer endpoint 加進既有 `tripline-api-server` 而非獨立 service | trip-planner 內部 admin API 性質一致 |
| 2026-05-02 | 複用 `TRIPLINE_API_SECRET` for mailer auth | 少一個 env |
| 2026-05-02 | 不做 mac mini down 時的 fallback | user 信任 mac mini uptime |
| 2026-05-02 | 不寫 outbox 不寫 scheduler，sync await | 「直接發信不要排程」 |
| 2026-05-02 | 單一 PR | 跟 OSM PR 模式一致 |
| 2026-05-02 | sync await mac mini 寄完才回 user | UX 跟原本同 |
| **2026-05-02** | **併進 Trigger silent-fail fix** | 同根因（Tailscale funnel + silent-catch）+ 同 helper（audit + telegram alert）；setup 100% 重疊 |
| **2026-05-02** | **MAILER_TUNNEL_URL 併進 TRIPLINE_API_URL** | 同 mac mini server 上 trigger + mailer 兩 endpoint，同 funnel 8443，少一個 env |
| **2026-05-02** | **Q7: 全部 endpoint 失敗顯示失敗（含 forgot-password）** | UX > 安全；trip-planner 是私人圈 app，email enumeration 風險低 |
| **2026-05-02** | **Q8: 複用 daily-report Gmail App Password** | 少一組密碼管 |
| **2026-05-02** | **Q9: GMAIL env 放 .env.local** | 跟現有 pattern 一致 |
| **2026-05-02** | **Q10: 不加 Funnel ACL** | Bearer 32+ char 已強保護；CF IP 變動風險不值 |
| **2026-05-02** | **Q11: reuse audit_log（table_name='email'）** | trip-planner 規模小，統一 audit 表省心 |
| **2026-05-02** | **Q12: 不加 rate limit** | abuse 出現再加，當前不需要 |

---

## Resolved Questions（6 questions answered 2026-05-02）

| # | 問題 | 答 | 實作影響 |
|---|---|---|---|
| 7 | 寄信失敗時 user UX | B — 全部 endpoint 都顯示「失敗」 | 4 endpoint 失敗 throw 500「寄送失敗」訊息 |
| 8 | Gmail App Password | A — 複用 daily-report 那組 | mac mini .env.local 用既有 GMAIL_USERNAME / GMAIL_APP_PASSWORD |
| 9 | mac mini env 位置 | A — `.env.local` | 不動 launchd plist EnvironmentVariables |
| 10 | Funnel ACL | B — 只靠 Bearer | tunnel 不加 IP allowlist |
| 11 | email log 表 | A — reuse `audit_log` | `recordEmailEvent` 寫 `audit_log` with `table_name='email'`，diff_json 塞 metadata |
| 12 | rate limit | B — 不加 | mac mini server 無 middleware |

---

## PR Plan

### Commit 順序

1. `feat(deps): bun add nodemailer + @types/nodemailer`
2. `feat(mailer): tripline-api-server add /internal/mail/send endpoint with nodemailer Gmail SMTP`
3. `feat(audit): add recordEmailEvent helper (reuse audit_log) + alertAdminTelegram helper`
4. `feat(server): replace src/server/email.ts Resend fetch with mac mini tunnel fetch`
5. `fix(oauth): replace silent-skip in send-verification with audit + telegram + 500 on fail`
6. `fix(oauth): replace silent-skip in forgot-password (誠實 UX, no enumeration exception)`
7. `fix(oauth): replace silent-skip in reset-password`
8. `fix(permissions): replace silent return in trip invitation`
9. **`fix(api): replace silent catch in /api/requests trigger with audit + telegram alert`**
10. `chore: update .dev.vars.example + CLAUDE.md required env section (拔 RESEND_API_KEY, 加 GMAIL_*)`

### 部署順序

1. **先在 mac mini setup**（步驟 1-6 in Impact section）
2. **CF Pages dashboard 改 env vars**（TRIPLINE_API_URL 改 funnel 8443; 加 EMAIL_FROM + TELEGRAM_*; 拔 RESEND_API_KEY）
3. Code PR ship → CF Pages auto deploy
4. **驗證 1**: `curl prod/api/public-config | jq .features.emailVerification` → 應回 `true`
5. **驗證 2**: 在 prod 觸發 forgot password → 應該 1-3s 內收到信
6. **驗證 3**: 在 prod 送 chat 訊息 → 觀察 mac mini api-server.log 應該有 `source: api` 出現（不是只有 `source: job`）
7. 確認 OK → 拔掉 prod RESEND_API_KEY env

---

## Build Phase 入口

```bash
git checkout -b feat/email-and-trigger-silent-fail-fix
# 走 /tp-team pipeline:
# Build → /simplify → /tp-code-verify → /review → /cso --diff → /qa → /ship → /land-and-deploy
```

---

## Operational Runbook

### 寄信失敗排查順序

1. `tail -f scripts/logs/api-server/$(date -u +%Y-%m-%d).log` — 看 mac mini 日誌
2. D1: `SELECT * FROM audit_log WHERE table_name='email' ORDER BY created_at DESC LIMIT 50`
3. 看 Telegram chat 6527604594 admin alert
4. `curl https://ray-chiudemac-mini.tail2750c0.ts.net:8443/health` — 看 mac mini 在線
5. `tailscale funnel status` — 看 funnel 對外通

### 即時觸發失敗排查順序（trigger silent-fail 修好後）

1. D1: `SELECT * FROM audit_log WHERE table_name='email' AND json_extract(diff_json, '$.kind')='trigger-failed' ORDER BY created_at DESC LIMIT 20`
2. D1: `SELECT date(created_at) as day, processed_by, COUNT(*) FROM trip_requests WHERE created_at >= datetime('now','-7 days') GROUP BY day, processed_by ORDER BY day DESC` — 觀察 api vs job 比例
3. mac mini api-server.log 看 `source: api` 是否出現

### Mac mini 重開後

- Tailscale 自動恢復（macOS 啟動）
- tripline-api-server 自動 KeepAlive 重啟
- Funnel 設定 persistent，自動重新對外
- 不需手動操作
