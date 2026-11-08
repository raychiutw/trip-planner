/**
 * 守門：Google「帳號登入／重新驗證」整個移除（Refs #1643；api 端見 trip-planner-api#63）。
 * 只擋登入，不碰 Google Maps／Places／Routes（那是地圖，不是登入）。
 * 帳號刪除只走密碼確認（ADR-0009 已被取代）；無密碼 fail-closed 的 UI 行為見 account-delete-password-only.test.tsx。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const SELF = join(ROOT, 'tests/unit/no-google-login.test.ts');

// 以識別字界定「Google 登入／重新驗證」；刻意不含 GOOGLE_MAPS_*、places、routes。
const FORBIDDEN = new RegExp([
  'startGoogleLogin', 'finishGoogleLogin', 'oauth/(?:login|callback)/google', 'GOOGLE_CLIENT_(?:ID|SECRET)',
  'google-id-token', 'verifyGoogleIdToken', 'delete-reauth', 'deleteReauth', 'reauthProvider', 'reauthenticated',
  'AccountDeleteChallenge', 'AccountDeleteProof', 'GoogleLoginState', 'google_error', 'login-google',
  'MOBILE_OAUTH_CALLBACK_URL', 'mobileCallbackUrl', 'providers\\??\\.google', 'providers:\\s*\\{\\s*google',
].join('|'));

function walk(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => (n === 'node_modules' || n === 'dist' ? [] : walk(join(p, n))));
}

// 這幾支測試的內容就是「證明那個入口／相容欄位不存在或被忽略」，必須引用舊識別字；其餘檔案一律不准。
const ABSENCE_TESTS = [
  'tests/unit/login-page.test.tsx',
  'tests/unit/placeholder-pages.test.tsx',
  'tests/unit/account-delete-password-only.test.tsx',
  'tests/e2e/new-api-e2e.spec.js',
].map((f) => join(ROOT, f));

const SCAN = ['src', 'functions', 'tests', 'scripts', 'wrangler.toml', '.dev.vars.example']
  .flatMap((r) => walk(join(ROOT, r)))
  .filter((f) => f !== SELF && !ABSENCE_TESTS.includes(f) && !/\.(png|jpg|jpeg|webp|ico|woff2?)$/.test(f) && f !== join(ROOT, 'src/api/schema.d.ts'));

describe('Google 登入已整個移除', () => {
  it('掃描器有掃到東西（不假綠）', () => {
    expect(SCAN.length).toBeGreaterThan(300);
  });

  it('src／functions／tests／scripts／設定不再引用 Google 登入或重新驗證的識別字', () => {
    const hits = SCAN.flatMap((f) => {
      const m = readFileSync(f, 'utf8').match(FORBIDDEN);
      return m ? [`${f.replace(ROOT + '/', '')}: ${m[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });

  it('例外名單只能是「證明不存在」的測試：它們不得再 import 或呼叫已移除的實作', () => {
    for (const f of ABSENCE_TESTS) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/startGoogleLogin|finishGoogleLogin|google-id-token|api\/account\/delete-reauth/);
    }
  });

  it.each([
    'functions/api/oauth/login/google.ts',
    'functions/api/oauth/callback/google.ts',
    'functions/api/account/delete-reauth.ts',
    'functions/api/account/_deleteReauth.ts',
    'src/server/oauth-client/google-id-token.ts',
  ])('%s 已刪除', (f) => {
    expect(existsSync(join(ROOT, f))).toBe(false);
  });

  it('舊入口 GET /api/public-config 不再回 providers.google', async () => {
    const { onRequestGet } = await import('../../functions/api/public-config');
    const res = await (onRequestGet as unknown as (c: unknown) => Response)({ env: {} });
    expect(await res.json()).not.toHaveProperty('providers');
  });
});

describe('契約快照同步到 production 現況（114 路徑）', () => {
  const spec = JSON.parse(readFileSync(join(ROOT, 'contracts/openapi.json'), 'utf8')) as { paths: Record<string, unknown> };
  const paths = Object.keys(spec.paths);

  it('路徑數 114', () => {
    expect(paths).toHaveLength(114);
  });

  it('不含 Google 登入與 delete-reauth 路徑', () => {
    expect(paths.filter((p) => /\/google$|delete-reauth/.test(p))).toEqual([]);
  });

  it('src/api/schema.d.ts 不含已移除路徑', () => {
    const dts = readFileSync(join(ROOT, 'src/api/schema.d.ts'), 'utf8');
    expect(dts).not.toMatch(/"\/api\/oauth\/(?:login|callback)\/google"|"\/api\/account\/delete-reauth"/);
  });
});
