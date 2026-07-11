/**
 * /api/account/ai-authorization — owner 就地授權 Tripline AI（tp-request）幫排行程（Approach B）。
 * 鎖不變式：
 *   - GET：Consent 存在 → {authorized:true}；不存在（undefined）→ {authorized:false}
 *   - POST：upsert Consent `${uid}:tripline-tp-request`（scopes openid/profile、1yr TTL）→ {authorized:true}
 *   - 只授權固定 AI client（endpoint 不吃外部 client_id）→ 無提權面
 *   - session 必須：requireSessionUser throw → 不 upsert
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFind, mockUpsert, mockRequireSession } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockUpsert: vi.fn(async () => undefined),
  mockRequireSession: vi.fn(async () => ({ uid: 'user-1' })),
}));

vi.mock('../../src/server/oauth-d1-adapter', () => ({
  D1Adapter: class {
    name: string;
    constructor(_db: unknown, name: string) {
      this.name = name;
    }
    find(id: string) {
      return mockFind(id);
    }
    upsert(id: string, payload: unknown, ttl: number) {
      return mockUpsert(id, payload, ttl);
    }
  },
}));
vi.mock('../../functions/api/_session', () => ({
  requireSessionUser: (req: unknown, env: unknown) => mockRequireSession(req, env),
}));

import { onRequestGet, onRequestPost } from '../../functions/api/account/ai-authorization';

// 最小 DB mock：只需吞掉 recordAuthEvent 的 INSERT ... .run()（best-effort，不影響回應）。
function makeDb() {
  return {
    prepare() {
      return {
        bind() {
          return { run: async () => ({ success: true }) };
        },
      };
    },
  };
}
function ctx() {
  return {
    request: new Request('https://x.pages.dev/api/account/ai-authorization', { method: 'POST' }),
    env: { DB: makeDb() },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

const YEAR_SEC = 365 * 24 * 60 * 60;

beforeEach(() => {
  mockFind.mockReset();
  mockUpsert.mockReset().mockResolvedValue(undefined);
  mockRequireSession.mockReset().mockResolvedValue({ uid: 'user-1' });
});

describe('GET /api/account/ai-authorization', () => {
  it('Consent 存在 → authorized:true，查的是 user 對 tp-request 的 key', async () => {
    mockFind.mockResolvedValue({ user_id: 'user-1', client_id: 'tripline-tp-request', scopes: [], grantedAt: 1 });
    const res = await onRequestGet(ctx());
    expect(await res.json()).toEqual({ authorized: true });
    expect(mockFind).toHaveBeenCalledWith('user-1:tripline-tp-request');
  });

  it('Consent 不存在（undefined）→ authorized:false', async () => {
    mockFind.mockResolvedValue(undefined);
    const res = await onRequestGet(ctx());
    expect(await res.json()).toEqual({ authorized: false });
  });

  it('未登入（requireSessionUser throw）→ 不查 Consent', async () => {
    mockRequireSession.mockRejectedValue(Object.assign(new Error('no session'), { code: 'AUTH_REQUIRED' }));
    await expect(onRequestGet(ctx())).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/ai-authorization', () => {
  it('upsert Consent `${uid}:tripline-tp-request`（openid/profile、1yr）→ authorized:true', async () => {
    const res = await onRequestPost(ctx());
    expect(await res.json()).toEqual({ authorized: true });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [key, payload, ttl] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>, number];
    expect(key).toBe('user-1:tripline-tp-request');
    expect(payload).toMatchObject({ user_id: 'user-1', client_id: 'tripline-tp-request' });
    expect(payload.scopes).toEqual(['openid', 'profile']);
    expect(ttl).toBe(YEAR_SEC);
  });

  it('未登入（requireSessionUser throw）→ 不 upsert', async () => {
    mockRequireSession.mockRejectedValue(Object.assign(new Error('no session'), { code: 'AUTH_REQUIRED' }));
    await expect(onRequestPost(ctx())).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // 頭號安全不變式：body 完全不被讀 → 惡意 client_id/user_id 無法提權/冒名。
  it('惡意 body（client_id/user_id）被忽略 → 仍用 session uid + 固定 client', async () => {
    const hostileCtx = {
      request: new Request('https://x.pages.dev/api/account/ai-authorization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: 'attacker-client', user_id: 'victim-user' }),
      }),
      env: { DB: makeDb() },
    } as unknown as Parameters<typeof onRequestPost>[0];
    const res = await onRequestPost(hostileCtx);
    expect(await res.json()).toEqual({ authorized: true });
    const [key, payload] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>];
    expect(key).toBe('user-1:tripline-tp-request'); // 不是 victim-user / attacker-client
    expect(payload).toMatchObject({ user_id: 'user-1', client_id: 'tripline-tp-request' });
  });
});
