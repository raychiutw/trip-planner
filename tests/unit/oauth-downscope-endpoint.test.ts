/**
 * POST /api/oauth/downscope — trip-scoped token exchange (v2.55.56)
 *
 * 換發「只能寫單一 trip」的 access token，供 tp-request api-server 注入 ephemeral
 * session（confused-deputy 緩解）。鎖住授權不變式：
 *   - user 有寫權 → 發 restrict_trip payload token + 2h TTL
 *   - 無寫權 / service token / 已受限 token → 拒（不發 token）
 *   - 缺 trip_id → 400
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequireAuth, mockHasWritePermission, mockRecordAuthEvent, mockUpsert, d1Ctor } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockHasWritePermission: vi.fn(),
  mockRecordAuthEvent: vi.fn(async () => undefined),
  mockUpsert: vi.fn(async () => undefined),
  d1Ctor: vi.fn(),
}));

vi.mock('../../functions/api/_auth', () => ({
  requireAuth: mockRequireAuth,
  hasWritePermission: mockHasWritePermission,
}));
vi.mock('../../functions/api/_auth_audit', () => ({
  recordAuthEvent: mockRecordAuthEvent,
}));
vi.mock('../../src/server/oauth-d1-adapter', () => ({
  D1Adapter: class {
    name: string;
    constructor(_db: unknown, name: string) {
      this.name = name;
      d1Ctor(name);
    }
    upsert(id: string, payload: unknown, ttl: number) {
      return mockUpsert(id, payload, ttl);
    }
  },
}));
vi.mock('../../functions/api/_utils', async (orig) => {
  const actual = await orig<typeof import('../../functions/api/_utils')>();
  return { ...actual, generateOpaqueToken: vi.fn(() => 'DOWNSCOPED_TOKEN') };
});

import { onRequestPost } from '../../functions/api/oauth/downscope';

const DOWNSCOPE_TTL_SEC = 2 * 60 * 60;

function makeContext(body: Record<string, unknown>): any {
  return {
    request: new Request('http://localhost/api/oauth/downscope', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: { DB: {} as unknown },
    data: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // default: unrestricted user token with write perm
  mockRequireAuth.mockReturnValue({
    userId: 'u-1',
    clientId: 'client-1',
    scopes: ['openid', 'profile'],
    isServiceToken: false,
  });
  mockHasWritePermission.mockResolvedValue(true);
});

describe('POST /api/oauth/downscope', () => {
  it('user 有寫權 → 發 restrict_trip token（2h TTL）', async () => {
    const res = await onRequestPost(makeContext({ trip_id: 'trip-x' }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      access_token: 'DOWNSCOPED_TOKEN',
      token_type: 'Bearer',
      expires_in: DOWNSCOPE_TTL_SEC,
      restrict_trip: 'trip-x',
    });
    // token 不得被快取
    expect(res.headers.get('cache-control')).toBe('no-store');

    // AccessToken row upsert 帶 restrict_trip payload + 2h TTL
    expect(d1Ctor).toHaveBeenCalledWith('AccessToken');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [tokenArg, payloadArg, ttlArg] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>, number];
    expect(tokenArg).toBe('DOWNSCOPED_TOKEN');
    expect(payloadArg).toMatchObject({
      user_id: 'u-1',
      client_id: 'client-1',
      scopes: ['openid', 'profile'],
      restrict_trip: 'trip-x',
    });
    expect(payloadArg.grantId).toBeTruthy();
    expect(ttlArg).toBe(DOWNSCOPE_TTL_SEC);

    // audit success
    expect(mockRecordAuthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        outcome: 'success',
        metadata: expect.objectContaining({ grant_type: 'downscope', restrict_trip: 'trip-x' }),
      }),
      expect.anything(),
    );
  });

  it('無寫權 → PERM_DENIED，不發 token，記 failure', async () => {
    mockHasWritePermission.mockResolvedValue(false);
    await expect(onRequestPost(makeContext({ trip_id: 'trip-x' }))).rejects.toMatchObject({ code: 'PERM_DENIED' });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockRecordAuthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ outcome: 'failure' }),
      expect.anything(),
    );
  });

  it('service token（user_id=null）→ PERM_DENIED，不查寫權也不發 token', async () => {
    mockRequireAuth.mockReturnValue({ userId: null, isServiceToken: true, scopes: ['ops:trips:read'] });
    await expect(onRequestPost(makeContext({ trip_id: 'trip-x' }))).rejects.toMatchObject({ code: 'PERM_DENIED' });
    expect(mockHasWritePermission).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('已受限 token → PERM_DENIED（防外洩受限 token 再提權）', async () => {
    mockRequireAuth.mockReturnValue({ userId: 'u-1', restrictTrip: 'trip-y', isServiceToken: false });
    await expect(onRequestPost(makeContext({ trip_id: 'trip-x' }))).rejects.toMatchObject({ code: 'PERM_DENIED' });
    expect(mockHasWritePermission).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('缺 trip_id → DATA_VALIDATION', async () => {
    await expect(onRequestPost(makeContext({}))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
