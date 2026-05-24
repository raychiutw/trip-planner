/**
 * v2.33.105 SEC-2 regression — poi-favorites bucket-spoof attack prevention.
 *
 * 之前 `pickFavoriteRateLimitBucket` 從 body.companionRequestId (claimed) 直接
 * 組 bucket key，並在 actor resolve 之前 bump。Unauthenticated attacker 可送
 * X-Request-Scope: companion + companionRequestId: 999 → bucket
 * `poi-favorites-post:companion:999` 被 bump 即使後續 actor resolve 401。
 * 10 個 fake request → bucket lock → 之後 legit user 用 requestId=999 → 429。
 *
 * Fix：preGateFavoriteThrottle (per-IP) + pickFavoriteBucketForActor (post-gate)
 * 把 bucket key 綁定到 verified actor。Unauthenticated attempt 不會 bump 任何
 * companion bucket。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi, seedTrip, callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/poi-favorites';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let validPoiId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-sec2' });
  validPoiId = await seedPoi(db, { name: 'SEC-2 Test POI' });
  // 模擬 companion service token client_id 設定
  env.TP_REQUEST_CLIENT_ID = 'tp-request';
});

afterAll(disposeMiniflare);

describe('v2.33.105 SEC-2 bucket-spoof DoS prevention', () => {
  it('unauthenticated header companion + claimed requestId=999 → 401, 不該 bump companion bucket', async () => {
    // 攻擊者送 fake companion header + 隨意 requestId
    const fakeRequestId = 999_999;
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Scope': 'companion',
          'CF-Connecting-IP': '1.2.3.4',
        },
        body: JSON.stringify({
          poiId: validPoiId,
          companionRequestId: fakeRequestId,
        }),
      }),
      env,
      // 無 auth — 模擬 unauthenticated / stolen-cookie 場景
    });
    const resp = await callHandler(onRequestPost, ctx);
    // pre-gate IP throttle 通過（< 200 limit）→ actor resolve 失敗 → 401
    expect(resp.status).toBe(401);

    // verify companion bucket 沒被 bump（spoof-proof）
    const spoofBucket = await db
      .prepare("SELECT count FROM rate_limit_buckets WHERE bucket_key = ?")
      .bind(`poi-favorites-post:companion:${fakeRequestId}`)
      .first<{ count: number }>();
    expect(spoofBucket).toBeNull();
  });

  it('10 個 unauthenticated bucket-spoof attempts → 不會 lock 該 requestId bucket', async () => {
    const targetRequestId = 888_888;
    // Fire 10 spoofed attempts
    for (let i = 0; i < 10; i++) {
      await callHandler(onRequestPost, mockContext({
        request: new Request('https://test.com/api/poi-favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Scope': 'companion',
            'CF-Connecting-IP': '5.6.7.8',
          },
          body: JSON.stringify({
            poiId: validPoiId,
            companionRequestId: targetRequestId,
          }),
        }),
        env,
      }));
    }
    // companion bucket 應該完全 fresh（spoof 不可 bump 它）
    const lockedBucket = await db
      .prepare("SELECT count, locked_until FROM rate_limit_buckets WHERE bucket_key = ?")
      .bind(`poi-favorites-post:companion:${targetRequestId}`)
      .first<{ count: number; locked_until: number | null }>();
    expect(lockedBucket).toBeNull();
  });

  it('pre-gate IP throttle: 200 burst 同 IP 觸 lock', async () => {
    const ipBucketKey = 'poi-favorites-pre-gate-ip:9.9.9.9';
    // 直接污染 bucket 到 lockout
    await db.prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET count = excluded.count, locked_until = excluded.locked_until`,
    ).bind(ipBucketKey, 201, Date.now(), Date.now() + 300 * 1000).run();

    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '9.9.9.9',
        },
        body: JSON.stringify({ poiId: validPoiId }),
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-sec2' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(429);
  });

  it('post-gate bucket 用 RESOLVED actor.userId 不是 claimed body', async () => {
    // V2 user POST without companion header → bucket key 應該是 user-based
    const userId = 'user-bucket-test';
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '10.0.0.1',
        },
        body: JSON.stringify({
          poiId: validPoiId,
          // 帶 companionRequestId 但無 X-Request-Scope header → 應被忽略
          companionRequestId: 777,
        }),
      }),
      env,
      auth: mockAuth({ email: 'user-bucket@test.com', userId }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    // bucket 應該是 user-based
    const userBucket = await db
      .prepare("SELECT count FROM rate_limit_buckets WHERE bucket_key = ?")
      .bind(`poi-favorites-post:user:${userId}`)
      .first<{ count: number }>();
    expect(userBucket).not.toBeNull();
    expect(userBucket!.count).toBeGreaterThanOrEqual(1);

    // claimed-but-unused companion bucket 不該存在
    const spoofBucket = await db
      .prepare("SELECT count FROM rate_limit_buckets WHERE bucket_key = ?")
      .bind('poi-favorites-post:companion:777')
      .first();
    expect(spoofBucket).toBeNull();
  });
});
