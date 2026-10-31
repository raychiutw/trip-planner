/**
 * POST /api/oauth/login — V2-P2
 * 走 HTTP 邊界（tests/api/http.ts）；原本檢查 mock DB 呼叫形狀的斷言，改讀真實 D1 的資料變化
 * （auth_identities.last_used_at、session_devices、rate_limit_buckets、auth_audit_log）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { hashPassword } from '../../src/server/password';
import { sha256Base64 } from '../../functions/api/_utils';

const PREFIX = 'oauth-login-test';
const PASSWORD = 'correct-pass';

let db: D1Database;
let seq = 0;
let passwordHash: string;
const userIds: string[] = [];
const ips: string[] = [];
const emailKeys: string[] = [];

beforeAll(async () => {
  db = await createTestDb();
  passwordHash = await hashPassword(PASSWORD);
}, 30_000);

afterAll(async () => {
  for (const id of userIds) {
    await db.prepare('DELETE FROM session_devices WHERE user_id = ?').bind(id).run();
    await db.prepare('DELETE FROM auth_audit_log WHERE user_id = ?').bind(id).run();
    await db.prepare('DELETE FROM auth_identities WHERE user_id = ?').bind(id).run();
    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }
  for (const ip of ips) {
    await db.prepare('DELETE FROM auth_audit_log WHERE ip_hash = ?').bind(await sha256Base64(ip)).run();
    await db.prepare('DELETE FROM rate_limit_buckets WHERE bucket_key = ?').bind(`login:${ip}`).run();
  }
  for (const k of emailKeys) await db.prepare('DELETE FROM rate_limit_buckets WHERE bucket_key = ?').bind(`login:${k}`).run();
  await disposeMiniflare();
});

const api = () => createApi({ env: mockEnv(db, { SESSION_SECRET: 'session-secret-test' }) });

function freshIp(): string {
  const ip = `10.33.0.${++seq}`;
  ips.push(ip);
  return ip;
}

async function seedUser(name: string, opts: { provider?: 'local' | 'google'; hash?: string | null } = {}) {
  const id = `${PREFIX}-${name}-${++seq}`;
  const email = `${PREFIX}-${name}-${seq}@x.com`;
  emailKeys.push(email);
  await db.prepare('INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)').bind(id, email, name).run();
  await db
    .prepare('INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, password_algo) VALUES (?, ?, ?, ?, ?)')
    .bind(id, opts.provider ?? 'local', email, opts.hash === undefined ? passwordHash : opts.hash, opts.hash === null ? null : 'pbkdf2')
    .run();
  userIds.push(id);
  return { id, email };
}

async function login(body: unknown, ip = freshIp()) {
  return api().request('POST', 'https://x.com/api/oauth/login', {
    json: body,
    headers: { 'CF-Connecting-IP': ip },
  });
}

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

const bucket = (key: string) =>
  db.prepare('SELECT count, locked_until FROM rate_limit_buckets WHERE bucket_key = ?').bind(key)
    .first<{ count: number; locked_until: number | null }>();

describe('POST /api/oauth/login', () => {
  it('400 LOGIN_INVALID_INPUT when email or password missing', async () => {
    const r1 = await login({ email: 'a@b.com' });
    expect(r1.status).toBe(400);
    expect(await errorCode(r1)).toBe('LOGIN_INVALID_INPUT');
    const r2 = await login({ password: 'pwd123' });
    expect(r2.status).toBe(400);
  });

  it('401 LOGIN_INVALID when email not found (generic — no enum leak)', async () => {
    const res = await login({ email: `${PREFIX}-unknown@x.com`, password: 'whatever' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('LOGIN_INVALID');
    emailKeys.push(`${PREFIX}-unknown@x.com`);
  }, 30_000);

  it('401 LOGIN_INVALID when password wrong（錯誤碼與查無此人相同；不發 session、不更新 last_used_at）', async () => {
    const u = await seedUser('wrongpw');
    const res = await login({ email: u.email, password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('LOGIN_INVALID');
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const identity = await db.prepare("SELECT last_used_at FROM auth_identities WHERE user_id = ? AND provider = 'local'")
      .bind(u.id).first<{ last_used_at: string | null }>();
    expect(identity!.last_used_at).toBeNull();
  }, 60_000);

  it('happy path: 200 + Set-Cookie + last_used_at update + session 與稽核寫入', async () => {
    const u = await seedUser('happy');
    const ip = freshIp();
    const res = await login({ email: u.email, password: PASSWORD }, ip);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; userId: string; email: string };
    expect(json.ok).toBe(true);
    expect(json.userId).toBe(u.id);
    expect(json.email).toBe(u.email);
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=/);

    const identity = await db.prepare("SELECT last_used_at FROM auth_identities WHERE user_id = ? AND provider = 'local'")
      .bind(u.id).first<{ last_used_at: string | null }>();
    expect(identity!.last_used_at).toBeTruthy();
    const session = await db.prepare('SELECT COUNT(*) AS n FROM session_devices WHERE user_id = ? AND revoked_at IS NULL')
      .bind(u.id).first<{ n: number }>();
    expect(session!.n).toBe(1);
    const audit = await db.prepare("SELECT outcome FROM auth_audit_log WHERE event_type = 'login' AND user_id = ?")
      .bind(u.id).first<{ outcome: string }>();
    expect(audit!.outcome).toBe('success');
  }, 60_000);

  it('email lowercase + trim before lookup', async () => {
    const u = await seedUser('mixed');
    const res = await login({ email: `  ${u.email.toUpperCase()}  `, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { userId: string }).userId).toBe(u.id);
  }, 30_000);

  it('still 401 even if DB returns identity with NULL password_hash (e.g. only Google identity)', async () => {
    const u = await seedUser('googleonly', { provider: 'google', hash: null });
    const res = await login({ email: u.email, password: 'whatever' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('LOGIN_INVALID');
  }, 30_000);

  it('429 LOGIN_RATE_LIMITED when IP locked（即使密碼正確也不給登入）', async () => {
    const u = await seedUser('iplocked');
    const ip = freshIp();
    await db
      .prepare('INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until) VALUES (?, ?, ?, ?)')
      .bind(`login:${ip}`, 6, Date.now(), Date.now() + 60_000).run();
    const res = await login({ email: u.email, password: PASSWORD }, ip);
    expect(res.status).toBe(429);
    expect(await errorCode(res)).toBe('LOGIN_RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  }, 30_000);

  it('429 LOGIN_RATE_LIMITED when email bucket locked（換 IP 也擋；訊息與 IP 鎖定相同，不洩漏帳號存在）', async () => {
    const u = await seedUser('emaillocked');
    await db
      .prepare('INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until) VALUES (?, ?, ?, ?)')
      .bind(`login:${u.email}`, 6, Date.now(), Date.now() + 60_000).run();
    const res = await login({ email: u.email, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(await errorCode(res)).toBe('LOGIN_RATE_LIMITED');
  }, 30_000);

  it('Failed login bumps rate limit counters (defence in depth)', async () => {
    const ip = freshIp();
    const email = `${PREFIX}-bump-unknown@x.com`;
    emailKeys.push(email);
    const res = await login({ email, password: 'wrong' }, ip);
    expect(res.status).toBe(401);

    // ipKey + emailKey 兩個 bucket 都累加
    expect((await bucket(`login:${ip}`))!.count).toBe(1);
    expect((await bucket(`login:${email}`))!.count).toBe(1);
    // 失敗事件有稽核
    const audit = await db
      .prepare("SELECT outcome, failure_reason FROM auth_audit_log WHERE event_type = 'login' AND ip_hash = ?")
      .bind(await sha256Base64(ip)).first<{ outcome: string; failure_reason: string }>();
    expect(audit).toMatchObject({ outcome: 'failure', failure_reason: 'unknown_email' });
  }, 30_000);

  it('連續失敗超過上限後鎖定（暴力破解防護）：第 6 次起回 429，即使密碼正確', async () => {
    const u = await seedUser('bruteforce');
    const ip = freshIp();
    for (let i = 0; i < 6; i++) expect((await login({ email: u.email, password: 'bad-guess' }, ip)).status).toBe(401);
    const res = await login({ email: u.email, password: PASSWORD }, ip);
    expect(res.status).toBe(429);
    expect(await errorCode(res)).toBe('LOGIN_RATE_LIMITED');
  }, 120_000);

  it('Successful login resets rate limit counters', async () => {
    const u = await seedUser('reset');
    const ip = freshIp();
    // 先失敗兩次，兩個 bucket 都有計數
    for (let i = 0; i < 2; i++) await login({ email: u.email, password: 'bad-guess' }, ip);
    expect((await bucket(`login:${ip}`))!.count).toBe(2);
    expect((await bucket(`login:${u.email}`))!.count).toBe(2);

    const res = await login({ email: u.email, password: PASSWORD }, ip);
    expect(res.status).toBe(200);
    // 成功後兩個 bucket 都被清掉
    expect(await bucket(`login:${ip}`)).toBeNull();
    expect(await bucket(`login:${u.email}`)).toBeNull();
  }, 60_000);
});
