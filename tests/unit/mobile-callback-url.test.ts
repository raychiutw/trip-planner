/**
 * mobileCallbackUrl：mobile callback 的設定驗證。
 * production／preview 一律要 https；只有 development 允許 http loopback（本機開發的 contract 就是 loopback），
 * 而且 development 沒設定時以 contract 的 dev 值為預設，本機才跑得了 mobile 的刪除流程。
 */
import { describe, it, expect } from 'vitest';
import { mobileCallbackUrl } from '../../functions/api/account/_deleteReauth';
import { MOBILE_DEV_REDIRECT, MOBILE_PROD_REDIRECT } from '../../functions/api/_mobileOAuth';

const code = (fn: () => unknown) => {
  try { fn(); return null; } catch (e) { return (e as { code?: string }).code ?? 'ERR'; }
};

describe('mobileCallbackUrl', () => {
  it('production：https 且設定了才通過', () => {
    expect(mobileCallbackUrl({ ENVIRONMENT: 'production', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT }).toString()).toBe(MOBILE_PROD_REDIRECT);
  });

  it('production 沒設定 → SERVER_MISCONFIG（不套用 dev 預設）', () => {
    expect(code(() => mobileCallbackUrl({ ENVIRONMENT: 'production' }))).toBe('SERVER_MISCONFIG');
  });

  it('production／preview 的 http（含 loopback）一律拒絕', () => {
    for (const env of ['production', 'preview', undefined]) {
      expect(code(() => mobileCallbackUrl({ ENVIRONMENT: env, MOBILE_OAUTH_CALLBACK_URL: 'http://127.0.0.1:8765' })), String(env)).toBe('SERVER_MISCONFIG');
    }
  });

  it('development 沒設定 → 以 contract 的 dev redirect 為預設（http loopback）', () => {
    expect(mobileCallbackUrl({ ENVIRONMENT: 'development' }).toString()).toBe(new URL(MOBILE_DEV_REDIRECT).toString());
  });

  it('development 明確設定 http loopback → 通過；localhost 也算 loopback', () => {
    expect(mobileCallbackUrl({ ENVIRONMENT: 'development', MOBILE_OAUTH_CALLBACK_URL: 'http://localhost:9000' }).hostname).toBe('localhost');
  });

  it('development 的 http 但不是 loopback（例如公網主機）→ 拒絕', () => {
    expect(code(() => mobileCallbackUrl({ ENVIRONMENT: 'development', MOBILE_OAUTH_CALLBACK_URL: 'http://evil.example' }))).toBe('SERVER_MISCONFIG');
  });

  it('任何環境都拒絕帶 query、hash、帳密的 URL', () => {
    for (const bad of ['https://x.example/cb?a=1', 'https://x.example/cb#f', 'https://u:p@x.example/cb']) {
      expect(code(() => mobileCallbackUrl({ ENVIRONMENT: 'production', MOBILE_OAUTH_CALLBACK_URL: bad })), bad).toBe('SERVER_MISCONFIG');
    }
  });
});
