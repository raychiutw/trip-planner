// @vitest-environment node
/**
 * 註冊必須同意個資條款
 *
 * owner 決策（2026-07-20）：「保留資料，但建立帳號要客戶同意個資條款，
 * 如果刪除帳號會去識別化」。
 *
 * 這條的重點是**留下證據**：純前端勾選框擋不住直接打 API，也在 DB 裡留不下任何
 * 「這個人同意過」的紀錄。真被監管或爭議問起時，手上要有時間戳與版本。
 *
 * 版本要記的理由：政策改版後，沒有版本欄位就無法得知某個使用者當初同意的是哪一版。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/signup';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';

describe('POST /api/oauth/signup — 個資條款同意', () => {
  let db: D1Database;

  beforeAll(async () => { db = await createTestDb(); }, 30000);
  afterAll(async () => { await disposeMiniflare(); });

  let seq = 0;
  function ctx(body: unknown) {
    const request = new Request('https://x.com/api/oauth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.0.0.${++seq}` },
      body: JSON.stringify(body),
    });
    return {
      request, env: mockEnv(db, { SESSION_SECRET: 'test-secret-32-chars-long-enough' } as never), params: {} as never, data: {} as never,
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined, passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof onRequestPost>[0];
  }

  const valid = (email: string) => ({
    email, password: 'correct-horse-battery', displayName: 'Tester',
  });

  it('沒帶同意 → 拒絕建帳號', async () => {
    const email = 'no-consent@example.com';
    await expect(onRequestPost(ctx(valid(email))))
      .rejects.toMatchObject({ code: 'SIGNUP_CONSENT_REQUIRED' });

    const row = await db.prepare('SELECT count(*) AS n FROM users WHERE email = ?')
      .bind(email).first<{ n: number }>();
    expect(row!.n, '未同意不得建立帳號').toBe(0);
  });

  it('同意欄位為 false → 一樣拒絕（不可只看欄位存在）', async () => {
    const email = 'false-consent@example.com';
    await expect(onRequestPost(ctx({ ...valid(email), privacyConsent: false })))
      .rejects.toMatchObject({ code: 'SIGNUP_CONSENT_REQUIRED' });
  });

  it('同意 → 建帳號並記錄時間戳與政策版本', async () => {
    const email = 'consented@example.com';
    const res = await onRequestPost(ctx({ ...valid(email), privacyConsent: true }));
    expect(res.status).toBeLessThan(400);

    const row = await db
      .prepare('SELECT privacy_consent_at, privacy_policy_version FROM users WHERE email = ?')
      .bind(email)
      .first<{ privacy_consent_at: string | null; privacy_policy_version: string | null }>();

    expect(row, '帳號應已建立').not.toBeNull();
    expect(row!.privacy_consent_at, '必須留下同意時間戳').toBeTruthy();
    expect(row!.privacy_policy_version, '必須記錄同意的是哪一版政策').toBeTruthy();
  });
});

describe('signup 稽核紀錄不得存明文 email', () => {
  it('email_taken 失敗路徑改存遮罩版', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../functions/api/oauth/signup.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // metadata: { email } 這種 shorthand 會把明文寫進 auth_audit_log
    expect(src).not.toMatch(/metadata:\s*\{\s*email\s*[,}]/);
  });
});
