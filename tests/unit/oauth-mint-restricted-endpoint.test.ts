/**
 * POST /api/oauth/mint-restricted — Option E：由 request_id 直接簽發 owner 身份的
 * 「只能寫單一 trip」access token，供 tp-request api-server 注入 contained session。
 *
 * 與 downscope 不同：caller 不帶 owner Bearer，而是可信 api-server 帶 API_SECRET；
 * server 端由 request_id 推 trip/owner、查既有 Consent，再簽發。鎖住不變式：
 *   - API_SECRET 正確 + request open/processing + owner 有 Consent → 發 restrict_trip token
 *   - API_SECRET 錯 / 缺 → AUTH_REQUIRED（不查 DB、不發 token）
 *   - request 不存在 / 非 open|processing → 不發 token（防對已結案請求 mint）
 *   - owner 無 Consent（未授權 AI）→ PERM_DENIED（不發 token）
 *   - 簽發 token：user_id=owner（非 caller）、client_id=tripline-tp-request、restrict_trip=trip
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConsentFind, mockUpsert, d1Ctor } = vi.hoisted(() => ({
  mockConsentFind: vi.fn(),
  mockUpsert: vi.fn(async () => undefined),
  d1Ctor: vi.fn(),
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
    find(id: string) {
      return mockConsentFind(id);
    }
  },
}));
vi.mock('../../functions/api/_utils', async (orig) => {
  const actual = await orig<typeof import('../../functions/api/_utils')>();
  return { ...actual, generateOpaqueToken: vi.fn(() => 'MINTED_TOKEN') };
});

import { onRequestPost } from '../../functions/api/oauth/mint-restricted';

const TTL_SEC = 2 * 60 * 60;
const SECRET = 'test-api-secret';

// DB mock：依 SQL 內容回不同 row（trip_requests → {trip_id,status}；trips → {owner_user_id}）
function makeDb(opts: { request?: unknown; owner?: unknown } = {}) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            first: async () => {
              if (/trip_requests/i.test(sql)) return opts.request ?? null;
              if (/from\s+trips/i.test(sql)) return opts.owner ?? null;
              return null;
            },
            // recordAuthEvent 的 INSERT ... .run()（best-effort，不影響回應）。
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
}

function makeContext(
  body: Record<string, unknown>,
  { secret = SECRET, authHeader = `Bearer ${SECRET}`, db = makeDb() } = {} as any,
): any {
  return {
    request: new Request('http://localhost/api/oauth/mint-restricted', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
      body: JSON.stringify(body),
    }),
    env: { DB: db, TRIPLINE_API_SECRET: secret },
    data: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConsentFind.mockResolvedValue({ user_id: 'owner-1', client_id: 'tripline-tp-request' }); // consent 存在
});

describe('POST /api/oauth/mint-restricted', () => {
  const openReq = { trip_id: 'trip-x', status: 'processing' };
  const owner = { owner_user_id: 'owner-1' };

  it('API_SECRET + open request + consent → 發 owner restrict_trip token', async () => {
    const res = await onRequestPost(makeContext({ request_id: 42 }, { db: makeDb({ request: openReq, owner }) }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      access_token: 'MINTED_TOKEN',
      token_type: 'Bearer',
      expires_in: TTL_SEC,
      restrict_trip: 'trip-x',
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
    // 簽發 token：user_id=owner（非 caller）、client_id=tp-request、restrict_trip=trip
    expect(d1Ctor).toHaveBeenCalledWith('AccessToken');
    const [tokenArg, payloadArg, ttlArg] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>, number];
    expect(tokenArg).toBe('MINTED_TOKEN');
    expect(payloadArg).toMatchObject({
      user_id: 'owner-1',
      client_id: 'tripline-tp-request',
      restrict_trip: 'trip-x',
    });
    expect(payloadArg.grantId).toBeTruthy();
    expect(ttlArg).toBe(TTL_SEC);
    // 查了 owner 對 tp-request client 的 consent
    expect(mockConsentFind).toHaveBeenCalledWith('owner-1:tripline-tp-request');
  });

  it('request_id 帶前後空白（string）→ trim 後照 mint（覆蓋 rawId.trim() 分支）', async () => {
    const res = await onRequestPost(makeContext({ request_id: '  42  ' }, { db: makeDb({ request: openReq, owner }) }));
    expect(res.status).toBe(200);
    // 走到 upsert 代表沒被 DATA_VALIDATION 擋（string 分支有 trim 後非空）
    const [, payloadArg] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>, number];
    expect(payloadArg).toMatchObject({ user_id: 'owner-1', restrict_trip: 'trip-x' });
  });

  it('成功 mint → 寫 auth_audit（token_issue/success，owner 身份）', async () => {
    await onRequestPost(makeContext({ request_id: 42 }, { db: makeDb({ request: openReq, owner }) }));
    // recordAuthEvent 是 best-effort（never throws）；此處確認 success path 不因 audit INSERT 崩。
    // audit 行為細節由 _auth_audit 自己的測試覆蓋，這裡只鎖「success 仍回 200 且 mint 成功」。
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('API_SECRET 錯 → AUTH_REQUIRED，不碰 DB、不發 token', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { authHeader: 'Bearer wrong', db: makeDb({ request: openReq, owner }) })),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('缺 Authorization → AUTH_REQUIRED', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { authHeader: '', db: makeDb({ request: openReq, owner }) })),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('env 無 API_SECRET → AUTH_REQUIRED（fail-closed，不因未設定就放行）', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { secret: '', authHeader: 'Bearer ', db: makeDb({ request: openReq, owner }) })),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('缺 request_id → DATA_VALIDATION', async () => {
    await expect(onRequestPost(makeContext({}, { db: makeDb({ request: openReq, owner }) }))).rejects.toMatchObject({
      code: 'DATA_VALIDATION',
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('request 不存在 → 不發 token', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 999 }, { db: makeDb({ request: null, owner }) })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|DATA_VALIDATION/) });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('request 非 open|processing（completed）→ 不發 token（防對已結案 mint）', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { db: makeDb({ request: { trip_id: 'trip-x', status: 'completed' }, owner }) })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/PERM_DENIED|DATA_VALIDATION/) });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('owner 無 Consent（未授權 AI）→ PERM_DENIED，不發 token', async () => {
    mockConsentFind.mockResolvedValue(undefined);
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { db: makeDb({ request: openReq, owner }) })),
    ).rejects.toMatchObject({ code: 'PERM_DENIED' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('trip owner 查不到 → 不發 token', async () => {
    await expect(
      onRequestPost(makeContext({ request_id: 42 }, { db: makeDb({ request: openReq, owner: null }) })),
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|DATA_VALIDATION/) });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
