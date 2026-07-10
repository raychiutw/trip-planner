/**
 * get-tripline-user-token — refresh_token rotation 提供 user access_token。用依賴注入
 * （in-memory store + 腳本化 fetch）驗證 rotation 安全不變式：
 *   - access-token 快取命中不換發（減少 rotation = 減少 family-revoke 風險）
 *   - 換發成功時「先一次 atomic 存新 refresh + access、再回傳 access」（persist-before-return）
 *   - invalid_grant（family revoked / 過期）→ 清 state + 拋 REVOKED（觸發 re-seed）
 *   - 其他錯誤 → REFRESH_FAILED，不清 state（transient，保住 refresh token）
 *   - getUserToken in-process single-flight：並發呼叫共享一次換發（雙換發 = family revoke）
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — CommonJS module, named interop
import { provideUserToken, getUserToken, UserTokenError } from '../../scripts/lib/get-tripline-user-token';

const BASE = 'https://example.test';
const CID = 'tripline-tp-request';
const SECRET = 's3cret';

/** in-memory single-object store with a call log for ordering/side-effect asserts. */
function makeStore(initial: { refresh?: string; access?: { access_token: string; expires_at: number } } = {}) {
  const calls: string[] = [];
  let state: Record<string, unknown> | null = null;
  if (initial.refresh || initial.access) {
    state = { refresh_token: initial.refresh ?? null, client_id: CID, ...(initial.access ?? {}) };
  }
  return {
    calls,
    getState: () => state,
    store: {
      load() {
        return state;
      },
      save(s: Record<string, unknown>) {
        calls.push('save');
        state = s;
      },
      clear() {
        calls.push('clear');
        state = null;
      },
    },
  };
}

/** scripted fetch: records calls, returns a Response-like from the given payload. */
function makeFetch(payload: { ok: boolean; status: number; json: unknown }, delayTicks = 0) {
  const seen: Array<{ url: string; body: string }> = [];
  const fetchImpl = async (url: string, init: { body: string }) => {
    seen.push({ url, body: init.body });
    for (let i = 0; i < delayTicks; i++) await Promise.resolve();
    return { ok: payload.ok, status: payload.status, json: async () => payload.json };
  };
  return { fetchImpl, seen };
}

const NOW = () => 1_000_000_000_000; // fixed clock (ms)
const nowSec = Math.floor(NOW() / 1000);
const base = { now: NOW, base: BASE, clientId: CID, clientSecret: SECRET };

describe('provideUserToken — 快取命中', () => {
  it('access token 未過期 → 直接回傳，不 fetch', async () => {
    const s = makeStore({ refresh: 'r1', access: { access_token: 'cached-AT', expires_at: nowSec + 3600 } });
    const f = makeFetch({ ok: true, status: 200, json: {} });
    const tok = await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base });
    expect(tok).toBe('cached-AT');
    expect(f.seen).toHaveLength(0);
    expect(s.calls).toEqual([]);
  });

  it('access token 在 leadtime 內（<60s 到期）→ 視為過期、換發', async () => {
    const s = makeStore({ refresh: 'r1', access: { access_token: 'stale-AT', expires_at: nowSec + 30 } });
    const f = makeFetch({ ok: true, status: 200, json: { access_token: 'new-AT', refresh_token: 'r2', expires_in: 3600 } });
    const tok = await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base });
    expect(tok).toBe('new-AT');
    expect(f.seen).toHaveLength(1);
  });
});

describe('provideUserToken — 換發（rotation）', () => {
  it('cache miss → 換發：打 refresh_token grant、回傳新 access token', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: true, status: 200, json: { access_token: 'new-AT', refresh_token: 'r2', expires_in: 3600 } });
    const tok = await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base });
    expect(tok).toBe('new-AT');
    expect(f.seen[0].url).toBe(`${BASE}/api/oauth/token`);
    expect(f.seen[0].body).toContain('grant_type=refresh_token');
    expect(f.seen[0].body).toContain('refresh_token=r1');
  });

  it('persist-before-return：一次 save 同時落地新 refresh + access（原子），再回傳', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: true, status: 200, json: { access_token: 'new-AT', refresh_token: 'r2', expires_in: 3600 } });
    await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base });
    expect(s.calls).toEqual(['save']); // 單次 atomic write
    expect(s.getState()).toMatchObject({ refresh_token: 'r2', access_token: 'new-AT' }); // 兩者同時落地
  });

  it('server 未回 refresh_token（不 rotate）→ 保留舊 refresh、仍存新 access', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: true, status: 200, json: { access_token: 'new-AT', expires_in: 3600 } });
    const tok = await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base });
    expect(tok).toBe('new-AT');
    expect(s.getState()).toMatchObject({ refresh_token: 'r1', access_token: 'new-AT' }); // 舊 refresh 保留
  });
});

describe('provideUserToken — 失效與錯誤', () => {
  it('invalid_grant（family revoked / 過期）→ clear state + 拋 REVOKED', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: false, status: 400, json: { error: 'invalid_grant', error_description: 'reuse detected' } });
    await expect(provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base })).rejects.toMatchObject({
      name: 'UserTokenError',
      kind: 'REVOKED',
    });
    expect(s.calls).toContain('clear');
    expect(s.getState()).toBeNull();
  });

  it('非 invalid_grant 錯誤（500）→ 拋 REFRESH_FAILED、不清 state（transient 保住 refresh）', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: false, status: 500, json: { error: 'server_error' } });
    await expect(provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base })).rejects.toMatchObject({
      kind: 'REFRESH_FAILED',
    });
    expect(s.calls).not.toContain('clear');
    expect(s.getState()).toMatchObject({ refresh_token: 'r1' });
  });

  it('無 seed（refresh token 不存在）→ 拋 NO_SEED、不 fetch', async () => {
    const s = makeStore({});
    const f = makeFetch({ ok: true, status: 200, json: {} });
    await expect(provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base })).rejects.toMatchObject({
      kind: 'NO_SEED',
    });
    expect(f.seen).toHaveLength(0);
  });

  it('缺 client 憑證 → 拋 CONFIG（有 refresh 但沒 clientId/secret）', async () => {
    const s = makeStore({ refresh: 'r1' });
    const f = makeFetch({ ok: true, status: 200, json: {} });
    await expect(
      provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, now: NOW, base: BASE, clientId: '', clientSecret: '' }),
    ).rejects.toMatchObject({ kind: 'CONFIG' });
    expect(f.seen).toHaveLength(0);
  });

  it('UserTokenError 是具名型別（caller 可 instanceof 分辨）', async () => {
    const s = makeStore({});
    const f = makeFetch({ ok: true, status: 200, json: {} });
    const err = await provideUserToken({ store: s.store, fetchImpl: f.fetchImpl, ...base }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UserTokenError);
  });
});

describe('getUserToken — in-process single-flight', () => {
  it('並發呼叫共享一次換發（只 POST 一次、都拿同 access token）', async () => {
    const s = makeStore({ refresh: 'r1' });
    // delayTicks 讓第一個換發還沒完成時第二個就進來 → 必須共享 inflight promise
    const f = makeFetch({ ok: true, status: 200, json: { access_token: 'AT', refresh_token: 'r2', expires_in: 3600 } }, 3);
    const deps = { store: s.store, fetchImpl: f.fetchImpl, ...base };
    const [a, b] = await Promise.all([getUserToken(deps), getUserToken(deps)]);
    expect(a).toBe('AT');
    expect(b).toBe('AT');
    expect(f.seen).toHaveLength(1); // 只換發一次（雙換發會 family revoke）
    expect(s.calls.filter((c) => c === 'save')).toHaveLength(1);
  });
});
