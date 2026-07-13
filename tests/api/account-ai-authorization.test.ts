import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost } from '../../functions/api/account/ai-authorization';
import type { Env } from '../../functions/api/_types';
import { callHandler, jsonRequest, mockAuth, mockContext, mockEnv, mockServiceAuth } from './helpers';
import { createTestDb, disposeMiniflare } from './setup';

let env: Env;

beforeAll(async () => {
  env = mockEnv(await createTestDb());
});

afterAll(disposeMiniflare);

function bearerContext(
  method: 'GET' | 'POST',
  auth = mockAuth({ email: 'ai-auth-bearer@example.com', clientId: 'tripline-mobile' }),
) {
  return mockContext({
    request: jsonRequest('https://test/api/account/ai-authorization', method, undefined, {
      Authorization: 'Bearer opaque-test-token',
    }),
    env,
    auth,
  });
}

describe('/api/account/ai-authorization', () => {
  it('接受 middleware 驗證後的 Bearer user identity，並可讀寫 consent', async () => {
    const initial = await callHandler(onRequestGet, bearerContext('GET'));
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toEqual({ authorized: false });

    const created = await callHandler(onRequestPost, bearerContext('POST'));
    expect(created.status).toBe(200);
    await expect(created.json()).resolves.toEqual({ authorized: true });

    const persisted = await callHandler(onRequestGet, bearerContext('GET'));
    expect(persisted.status).toBe(200);
    await expect(persisted.json()).resolves.toEqual({ authorized: true });
  });

  it('即使 payload 異常帶 userId，仍拒絕 service token', async () => {
    const response = await callHandler(
      onRequestPost,
      bearerContext(
        'POST',
        mockServiceAuth({ userId: 'forged-service-user', clientId: 'tripline-mobile' }),
      ),
    );
    expect(response.status).toBe(401);
  });

  it('拒絕 trip-scoped token 建立帳號層級 consent', async () => {
    const response = await callHandler(
      onRequestPost,
      bearerContext(
        'POST',
        mockAuth({
          email: 'ai-auth-restricted@example.com',
          clientId: 'tripline-tp-request',
          restrictTrip: 'trip-1',
        }),
      ),
    );
    expect(response.status).toBe(403);
  });

  it('拒絕第三方 OAuth client 代替使用者建立或讀取 AI consent', async () => {
    const response = await callHandler(
      onRequestGet,
      bearerContext(
        'GET',
        mockAuth({ email: 'ai-auth-third-party@example.com', clientId: 'tp-third-party' }),
      ),
    );
    expect(response.status).toBe(403);
  });
});
