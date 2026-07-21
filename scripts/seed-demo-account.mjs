#!/usr/bin/env node
/**
 * 建立 Google Play 送審用的 demo 帳號並匯入範例行程。
 *
 * 為什麼是 HTTP 而不是 `wrangler d1 execute --remote`：
 *   1. prod 的 CLOUDFLARE_API_TOKEN 已失效，D1 remote 走不通；
 *   2. 更重要的是 —— 密碼雜湊是 PBKDF2，手寫 SQL 得自己算 hash 塞進 users，
 *      算錯了要到審核員登入失敗才會發現。走正式 signup 端點就由 production
 *      code 自己雜湊，格式永遠對。
 *
 * 冪等：帳號已存在（SIGNUP_EMAIL_TAKEN）就跳過建立直接登入；行程同名已存在
 * 就跳過匯入。可重複執行。
 *
 * 用法：
 *   node scripts/seed-demo-account.mjs --base http://localhost:8788
 *   node scripts/seed-demo-account.mjs --base https://trip-planner-dby.pages.dev
 *
 * 帳密預設 demo@demo.com / demo1234（owner 於 2026-07-21 指定），可用
 * --email / --password 覆寫。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../docs/demo/demo-trip.json');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const baseUrl = arg('base', 'http://localhost:8788').replace(/\/$/, '');
const email = arg('email', 'demo@demo.com');
const password = arg('password', 'demo1234');
const displayName = arg('name', 'Tripline 範例帳號');

/**
 * 每個 mutating 請求都要帶 Origin —— `_middleware.ts` 的 isAllowedOrigin 是
 * CSRF 防線，缺了會被擋。用 baseUrl 自身當 Origin 即為同源。
 */
const origin = new URL(baseUrl).origin;
let sessionCookie = '';

async function call(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 記住 session cookie 供後續請求使用。
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(';')[0];
    if (pair) sessionCookie = sessionCookie ? `${sessionCookie}; ${pair}` : pair;
  }

  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* 非 JSON 錯誤頁 */ }
  return { status: res.status, body: parsed, text };
}

function fail(step, res) {
  console.error(`\n✘ ${step} 失敗 — HTTP ${res.status}`);
  console.error(res.text.slice(0, 500));
  process.exit(1);
}

console.log(`目標站台：${baseUrl}`);
console.log(`帳號：${email}\n`);

// ---- 1. 建立帳號（已存在則跳過）----
// privacyConsent 一律送出：尚未部署同意 gate 的站台會忽略這個欄位，部署後則為必填。
const signup = await call('/api/oauth/signup', {
  body: { email, password, displayName, privacyConsent: true },
});

if (signup.status < 400) {
  console.log('✓ 帳號已建立');
} else if (signup.body?.error?.code === 'SIGNUP_EMAIL_TAKEN' || /EMAIL_TAKEN/.test(signup.text)) {
  console.log('· 帳號已存在，跳過建立');
} else {
  fail('建立帳號', signup);
}

// ---- 2. 登入取得 session ----
// signup 成功時本身就會發 session，但走一次 login 才能驗證「審核員拿這組帳密
// 真的登得進去」—— 這正是 Google Play 送審要確認的事。
sessionCookie = '';
const login = await call('/api/oauth/login', { body: { email, password } });
if (login.status >= 400) fail('登入', login);
if (!sessionCookie) fail('登入（未取得 session cookie）', login);
console.log('✓ 登入成功，審核員可用這組帳密進入');

// ---- 3. 匯入範例行程（同名已存在則跳過）----
const demoTrip = JSON.parse(readFileSync(FIXTURE, 'utf-8'));
const tripName = demoTrip.meta.name;

// 用 /api/my-trips 而不是 /api/trips —— 後者只列 published=1 的公開行程，
// 而匯入的行程是 published=0，所以拿 /api/trips 判斷會永遠判定「不存在」，
// 每跑一次就多匯入一份重複行程（冪等性形同虛設）。
const existing = await call('/api/my-trips', { method: 'GET' });
const ownTrips = existing.body?.trips ?? existing.body;
const alreadyThere = Array.isArray(ownTrips)
  && ownTrips.some((trip) => trip?.name === tripName);

if (alreadyThere) {
  console.log(`· 「${tripName}」已存在，跳過匯入`);
} else {
  const imported = await call('/api/trips/import', { body: demoTrip });
  if (imported.status >= 400) fail('匯入範例行程', imported);
  console.log(`✓ 已匯入「${tripName}」`);
}

console.log('\n完成。Google Play Console 送審欄位可填：');
console.log(`  帳號：${email}`);
console.log(`  密碼：${password}`);
