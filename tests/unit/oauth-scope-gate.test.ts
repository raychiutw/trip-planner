// @vitest-environment node
/**
 * OAuth scope gate — 第三方應用程式的行程存取限制
 *
 * 問題（2026-07-20 隱私盤點）：
 *   `hasPermission` / `requireTripReadAccess` / `hasWritePermission` **完全不檢查 scope**，
 *   只看 `trip_permissions.user_id`。使用者在授權畫面只看到「openid 識別您的身分」就按同意，
 *   該第三方 app 實際上能讀寫他**全部行程**（含航班編號、訂房編號、緊急聯絡人電話）。
 *   → 隱私權政策照授權畫面文字寫即為不實陳述。
 *
 * ⚠ 為什麼不是單純「require trips:read」：
 *   `mint-restricted.ts:155` 發給自家 AI pipeline 的 token 是 `scopes: []`，
 *   註解明言「能力純由 user_id + restrict_trip 決定」。天真加 gate 會把
 *   「用對話改行程」整條線打掛 —— 那是這個 app 的核心功能。
 *
 * 所以是三分法：
 *   1. 第一方 session（`scopes === undefined`）→ 放行。session 本身就是完整授權。
 *   2. 自家受限 token（有 `restrictTrip`）→ 放行。已綁死單一行程，比 scope 更嚴。
 *   3. 真正的第三方 OAuth（有 `scopes`、無 `restrictTrip`）→ 要求對應 scope。
 */
import { describe, it, expect } from 'vitest';
import { hasTripScope, TRIP_READ_SCOPE, TRIP_WRITE_SCOPE } from '../../functions/api/_auth';

type Auth = Parameters<typeof hasTripScope>[0];

const session = (): Auth => ({ userId: 'u1', isServiceToken: false } as Auth);
const restricted = (scopes: string[] = []): Auth =>
  ({ userId: 'u1', isServiceToken: false, scopes, restrictTrip: 'trip-1' } as Auth);
const thirdParty = (scopes: string[]): Auth =>
  ({ userId: 'u1', isServiceToken: false, scopes, clientId: 'some-app' } as Auth);

describe('hasTripScope — 第一方 session', () => {
  it('沒有 scopes 欄位 → 放行（session 是完整授權，不是委派）', () => {
    expect(hasTripScope(session(), TRIP_READ_SCOPE)).toBe(true);
    expect(hasTripScope(session(), TRIP_WRITE_SCOPE)).toBe(true);
  });
});

describe('hasTripScope — 自家受限 token（tp-request pipeline）', () => {
  it('有 restrictTrip 就放行，即使 scopes 是空陣列', () => {
    // mint-restricted 發的就是 scopes: []。這條若擋掉，AI 排程會全掛。
    expect(hasTripScope(restricted([]), TRIP_READ_SCOPE)).toBe(true);
    expect(hasTripScope(restricted([]), TRIP_WRITE_SCOPE)).toBe(true);
  });

  it('restrictTrip 本身的行程限制仍由既有邏輯負責，scope gate 不重複判斷', () => {
    expect(hasTripScope(restricted(['companion']), TRIP_WRITE_SCOPE)).toBe(true);
  });
});

describe('hasTripScope — 第一方 client（tp-request AI pipeline）', () => {
  const firstParty = (scopes: string[]): Auth =>
    ({ userId: 'u1', isServiceToken: false, scopes, clientId: 'tp-request', isFirstPartyClient: true } as Auth);

  it('openid/profile 也放行 —— 授權來自 Consent 而非 scopes', () => {
    // ai-authorization.ts 的 Consent 只存 openid/profile（見該檔 authz-drift 警語）。
    // 若不豁免，/api/oauth/downscope（尚未取得 restrictTrip 的那一步）會被擋 →
    // 「用對話改行程」整條線斷掉。這是實際被 integration test 抓到的回歸。
    expect(hasTripScope(firstParty(['openid', 'profile']), TRIP_READ_SCOPE)).toBe(true);
    expect(hasTripScope(firstParty(['openid', 'profile']), TRIP_WRITE_SCOPE)).toBe(true);
  });

  it('豁免只看旗標，不看 clientId 字串（避免第三方冒用相似 id）', () => {
    const impostor = { userId: 'u1', isServiceToken: false, scopes: ['openid'], clientId: 'tp-request' } as Auth;
    expect(hasTripScope(impostor, TRIP_WRITE_SCOPE), '沒有 middleware 設的旗標就不算第一方').toBe(false);
  });
});

describe('hasTripScope — 真正的第三方 OAuth token', () => {
  it('只有 openid → 拒絕（這正是被揭露的問題）', () => {
    expect(hasTripScope(thirdParty(['openid']), TRIP_READ_SCOPE)).toBe(false);
    expect(hasTripScope(thirdParty(['openid']), TRIP_WRITE_SCOPE)).toBe(false);
  });

  it('openid + profile + email 仍不足以碰行程', () => {
    expect(hasTripScope(thirdParty(['openid', 'profile', 'email']), TRIP_READ_SCOPE)).toBe(false);
  });

  it('有 trips:read → 可讀，但不可寫', () => {
    const a = thirdParty(['openid', TRIP_READ_SCOPE]);
    expect(hasTripScope(a, TRIP_READ_SCOPE)).toBe(true);
    expect(hasTripScope(a, TRIP_WRITE_SCOPE)).toBe(false);
  });

  it('有 trips:write → 可寫，且隱含可讀（寫必須先讀）', () => {
    const a = thirdParty([TRIP_WRITE_SCOPE]);
    expect(hasTripScope(a, TRIP_WRITE_SCOPE)).toBe(true);
    expect(hasTripScope(a, TRIP_READ_SCOPE), 'trips:write 應隱含 trips:read').toBe(true);
  });

  it('空 scopes 且無 restrictTrip → 拒絕（fail closed）', () => {
    // middleware 對格式異常的 DB row 會給 safeScopes = []。
    // 這種 token 不該有任何行程存取權。
    expect(hasTripScope(thirdParty([]), TRIP_READ_SCOPE)).toBe(false);
  });
});

describe('三個權限 chokepoint 都套上 scope gate', () => {
  it('hasPermission / requireTripReadAccess / hasWritePermission 都呼叫 hasTripScope', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../functions/api/_auth.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const fn of ['hasPermission', 'requireTripReadAccess', 'hasWritePermission']) {
      const body = src.slice(src.indexOf(`function ${fn}`));
      const end = body.indexOf('\nexport ');
      expect(end === -1 ? body : body.slice(0, end), `${fn} 必須套 scope gate`)
        .toMatch(/hasTripScope\(/);
    }
  });
});
