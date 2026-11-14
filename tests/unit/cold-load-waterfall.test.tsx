/**
 * #1691 冷載入瀑布的量測型守門：重新整理 /account 時
 *   (a) 資料就緒的循序階段數 ≤ 2（token → 其餘並行）
 *   (b) 不再有重複的 userinfo
 *   (c) auth 還原期間渲染骨架而不是空白，且不洩漏使用者資料
 *
 * 做法：真的 auth client（DPoP、single-flight refresh）＋真的 AccountPage／側邊欄／hooks，
 * 只把 fetch 換成「每個請求固定延遲 L」的假 api，記錄每個請求的 start／end，
 * 以「請求 B 在請求 A 結束後才開始 ⇒ B 依賴 A」算關鍵路徑深度（階段數）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/auth')>();
  return {
    ...actual,
    getNewApiAuth: () => holder.client as import('../../src/lib/auth').AuthClient,
    getNewApiBase: () => 'https://api.test',
  };
});

import { createAuthClient } from '../../src/lib/auth/client';
import { createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { generateDpopKeyPair } from '../../src/lib/auth/dpop';
import { ActiveTripProvider } from '../../src/contexts/ActiveTripContext';
import { __clearMyTripsCache } from '../../src/hooks/useMyTrips';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';
import AccountPage from '../../src/pages/AccountPage';

const L = 60; // 每個請求固定延遲（ms）
const EMAIL = 'ray.secret@example.test';
const NAME = 'RaySecretName';
const b64u = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (claims: Record<string, unknown>) => `${b64u({ alg: 'ES256' })}.${b64u(claims)}.sig`;
const goodClaims = () => ({
  sub: 'u1', aud: 'tripline-web', email: EMAIL, email_verified: true, name: NAME, exp: Math.floor(Date.now() / 1000) + 3600,
});
const USERINFO = { id: 'u1', email: EMAIL, emailVerified: true, displayName: NAME, avatarUrl: null, createdAt: '2026-01-01' };

interface Rec { path: string; start: number; end: number }

function makeApi(opts: { idToken?: string | null; tokenDelay?: number } = {}) {
  const log: Rec[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input)).pathname;
    const rec: Rec = { path, start: performance.now(), end: 0 };
    log.push(rec);
    await new Promise((r) => setTimeout(r, path === '/api/oauth/token' ? (opts.tokenDelay ?? L) : L));
    rec.end = performance.now();
    void init;
    if (path === '/api/oauth/token') {
      return json({
        access_token: 'at', refresh_token: 'rt2', token_type: 'DPoP', expires_in: 900, scope: 'openid',
        ...(opts.idToken ? { id_token: opts.idToken } : {}),
      });
    }
    if (path === '/api/oauth/userinfo') return json(USERINFO);
    if (path === '/api/account/stats') return json({ tripCount: 6, totalDays: 45, collaboratorCount: 2 });
    if (path === '/api/account') return json({ hasPassword: true, tripsOwned: 0, collaboratorsAffected: 0 });
    if (path === '/api/account/ai-data-consent') return json({ status: 'none', enforced: false });
    if (path === '/api/my-trips') return json([{ tripId: 't1', name: '沖繩行', title: '沖繩行' }]);
    return json({});
  };
  return { log, fetchImpl };
}

/** 關鍵路徑深度：B 在 A 結束後才開始 ⇒ B 排在 A 之後。 */
function depthOf(log: Rec[]): number {
  const sorted = [...log].sort((a, b) => a.start - b.start);
  const depth: number[] = [];
  sorted.forEach((r, i) => {
    depth[i] = 1 + Math.max(0, ...sorted.slice(0, i).map((p, j) => (p.end <= r.start ? depth[j]! : 0)));
  });
  return Math.max(0, ...depth);
}
const count = (log: Rec[], path: string) => log.filter((r) => r.path === path).length;

async function boot(api: ReturnType<typeof makeApi>) {
  const storage = createMemoryAuthStorage();
  await storage.saveSession({ refreshToken: 'rt1', keyPair: await generateDpopKeyPair() });
  holder.client = createAuthClient({ apiBase: 'https://api.test', storage, fetch: api.fetchImpl as typeof fetch, lock: (fn) => fn() });
}

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <ActiveTripProvider><AccountPage /></ActiveTripProvider>
    </MemoryRouter>,
  );
}

function report(label: string, log: Rec[]) {
  const t0 = Math.min(...log.map((r) => r.start));
  const rows = [...log].sort((a, b) => a.start - b.start).map((r) => `${r.path}@${Math.round(r.start - t0)}-${Math.round(r.end - t0)}`);
  console.info(`[waterfall] ${label} stages=${depthOf(log)} L=${L}ms :: ${rows.join(' ')}`);
}

async function untilDataReady() {
  await waitFor(() => expect(screen.getByTestId('account-hero').textContent).toContain('45'));
  await waitFor(() => expect(screen.getAllByText('沖繩行').length).toBeGreaterThan(0));
}

beforeEach(() => { __clearMyTripsCache(); });
afterEach(() => { cleanup(); holder.client = null; });

describe('冷載入瀑布（#1691）', () => {
  it('token 回應帶 id_token：不打 userinfo，資料就緒只有 token → 其餘並行 兩個階段', async () => {
    const api = makeApi({ idToken: jwt(goodClaims()) });
    await boot(api);
    renderAccount();
    await untilDataReady();
    report('id_token', api.log);
    expect(count(api.log, '/api/oauth/userinfo')).toBe(0);
    expect(count(api.log, '/api/oauth/token')).toBe(1);
    for (const p of ['/api/account', '/api/account/stats', '/api/account/ai-data-consent', '/api/my-trips']) {
      expect(count(api.log, p), p).toBe(1);
    }
    expect(depthOf(api.log)).toBeLessThanOrEqual(2);
  });

  it('沒有 id_token（舊伺服器／未設簽章 key）：userinfo 只打一次，不重複', async () => {
    const api = makeApi({ idToken: null });
    await boot(api);
    renderAccount();
    await untilDataReady();
    report('no id_token', api.log);
    expect(count(api.log, '/api/oauth/userinfo')).toBe(1);
    expect(depthOf(api.log)).toBeLessThanOrEqual(3); // token → userinfo → 其餘並行
  });

  it.each([
    ['aud 不是本 client', { ...goodClaims(), aud: 'someone-else' }],
    ['已過期', { ...goodClaims(), exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['沒有 sub', { ...goodClaims(), sub: undefined }],
    ['沒有 email', { ...goodClaims(), email: undefined }],
  ])('id_token %s：不採用，落回 userinfo（且仍只打一次）', async (_label, claims) => {
    const api = makeApi({ idToken: jwt(claims) });
    await boot(api);
    renderAccount();
    await untilDataReady();
    expect(count(api.log, '/api/oauth/userinfo')).toBe(1);
  });

  it('auth 還原期間渲染殼層與骨架（不是空白），且不洩漏使用者資料', async () => {
    const api = makeApi({ idToken: jwt(goodClaims()), tokenDelay: 500 });
    await boot(api);
    const { container } = renderAccount();
    // 同步第一個 frame：token 還在途中
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByTestId('account-page')).toBeTruthy();
    expect(screen.getByTestId('account-hero')).toBeTruthy();
    expect(container.querySelectorAll('.tp-account-skeleton').length).toBeGreaterThan(0);
    const text = container.textContent ?? '';
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(NAME);
    expect(text).not.toContain('ray.secret');
    // 無障礙：個人卡 aria-busy ＋ 視覺隱藏的載入文字；還原後兩者消失
    const hero = screen.getByTestId('account-hero');
    expect(hero.getAttribute('aria-busy')).toBe('true');
    expect(hero.querySelector('.sr-only')?.textContent).toContain('載入帳號資料');
    // 還原前不可操作：設定列整塊 inert
    expect(container.querySelector('.tp-account-groups')?.hasAttribute('inert')).toBe(true);
    // 還原完成後才出現使用者資料
    await waitFor(() => expect(screen.getByTestId('account-hero').textContent).toContain(EMAIL), { timeout: 3000 });
    expect(container.querySelector('.tp-account-groups')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('account-hero').hasAttribute('aria-busy')).toBe(false);
    expect(screen.getByTestId('account-hero').textContent).not.toContain('載入帳號資料');
  });

  it('reload()（改名後）不再用過時的 id_token：改問 userinfo 拿新資料', async () => {
    const api = makeApi({ idToken: jwt(goodClaims()) });
    await boot(api);
    const { result } = renderHook(() => useCurrentUser());
    await waitFor(() => expect(result.current.user?.displayName).toBe(NAME));
    expect(count(api.log, '/api/oauth/userinfo')).toBe(0);
    act(() => result.current.reload());
    await waitFor(() => expect(count(api.log, '/api/oauth/userinfo')).toBe(1));
    await waitFor(() => expect(result.current.user).toEqual(USERINFO));
  });
});
