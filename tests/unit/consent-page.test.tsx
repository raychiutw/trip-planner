/**
 * ConsentPage unit test — V2-P5 starter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsentPage from '../../src/pages/ConsentPage';

beforeEach(() => {
  // Mock window.location.href setter (for redirect)
  Object.defineProperty(window, 'location', {
    value: { ...window.location, href: 'about:blank' },
    writable: true,
  });
  // 預設 client-info fetch 失敗 → 走「未知應用程式」保底（確定性，不靠 undici 對 relative
  // URL 的 reject 行為）。需要成功/404 的 test 自行 override。
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in unit env')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithParams(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/consent?${query}`]}>
      <ConsentPage />
    </MemoryRouter>,
  );
}

describe('ConsentPage', () => {
  it('renders error when client_id missing', async () => {
    renderWithParams('scope=openid');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    // v2.31.58：original English「Missing client_id」 → 中文 actionable hint。
    expect(screen.getByRole('alert').textContent).toContain('授權連結缺少必要參數 client_id');
  });

  it('renders client app name + requested scopes', async () => {
    renderWithParams('client_id=partner-x&scope=openid+profile+email&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => expect(screen.getByTestId('consent-scopes')).toBeTruthy());
    expect(screen.getByText(/partner-x/)).toBeTruthy();
    expect(screen.getByTestId('consent-scope-openid')).toBeTruthy();
    expect(screen.getByTestId('consent-scope-profile')).toBeTruthy();
    expect(screen.getByTestId('consent-scope-email')).toBeTruthy();
  });

  it('shows scope description in zh-tw', async () => {
    renderWithParams('client_id=p&scope=email&redirect_uri=&state=');
    await waitFor(() => expect(screen.getByTestId('consent-scope-email')).toBeTruthy());
    expect(screen.getByTestId('consent-scope-email').textContent).toContain('電子郵件地址');
  });

  it('Allow button submits POST form to /api/oauth/consent with decision=allow', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => screen.getByTestId('consent-allow'));
    const allowBtn = screen.getByTestId('consent-allow') as HTMLButtonElement;
    const form = allowBtn.closest('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.method.toLowerCase()).toBe('post');
    expect(form.action).toContain('/api/oauth/consent');
    const decision = form.querySelector('input[name="decision"]') as HTMLInputElement;
    expect(decision.value).toBe('allow');
    const cid = form.querySelector('input[name="client_id"]') as HTMLInputElement;
    expect(cid.value).toBe('p');
    const ruri = form.querySelector('input[name="redirect_uri"]') as HTMLInputElement;
    expect(ruri.value).toBe('https://x.com/cb');
    const st = form.querySelector('input[name="state"]') as HTMLInputElement;
    expect(st.value).toBe('s');
  });

  it('Deny button submits POST form to /api/oauth/consent with decision=deny (no client-side redirect)', async () => {
    renderWithParams('client_id=p&scope=openid&redirect_uri=https%3A%2F%2Fx.com%2Fcb&state=csrf-tok');
    await waitFor(() => screen.getByTestId('consent-deny'));
    const denyBtn = screen.getByTestId('consent-deny') as HTMLButtonElement;
    const form = denyBtn.closest('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.method.toLowerCase()).toBe('post');
    expect(form.action).toContain('/api/oauth/consent');
    const decision = form.querySelector('input[name="decision"]') as HTMLInputElement;
    expect(decision.value).toBe('deny');
    // redirect_uri is in the form body — server validates against client_apps allowlist
    const ruri = form.querySelector('input[name="redirect_uri"]') as HTMLInputElement;
    expect(ruri.value).toBe('https://x.com/cb');
  });

  it('Empty scope shows "無 scope 請求"', async () => {
    renderWithParams('client_id=p&scope=&redirect_uri=https://x.com&state=');
    await waitFor(() => screen.getByTestId('consent-scopes'));
    expect(screen.getByTestId('consent-scopes').textContent).toContain('無 scope 請求');
  });

  // --- client-info fetch wiring：spoofing 防護的實際 enforcement 點（backend test 測不到） ---
  it('client-info 回 active app → 顯示後端 app_name（信任樣式），不顯示未知警告', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          app_name: '真實旅遊 App',
          app_description: 'desc',
          app_logo_url: null,
          homepage_url: null,
        }),
      }),
    );
    renderWithParams('client_id=partner-x&scope=openid&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => expect(screen.getByText('真實旅遊 App')).toBeTruthy());
    // 渲染在信任的 .tp-consent-app-name 樣式，且不再顯示「未知應用程式」保底警告。
    expect(screen.getByText('真實旅遊 App').className).toContain('tp-consent-app-name');
    expect(screen.queryByText(/未知應用程式/)).toBeNull();
  });

  it('client-info 404（未註冊/停用）→ 保留「未知應用程式」警告，不把 client_id 當可信名稱', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: { code: 'DATA_NOT_FOUND' } }) }),
    );
    // attacker 構造 client_id 想被顯示成官方 app 名
    renderWithParams('client_id=Tripline%20%E5%AE%98%E6%96%B9%E7%99%BB%E5%85%A5&scope=openid&redirect_uri=https://x.com/cb&state=s');
    await waitFor(() => expect(screen.getByText(/未知應用程式/)).toBeTruthy());
    // 關鍵回歸鎖：若有人把 `res.ok ? … : null` 改成無條件 `.json()`，404 的 error body 會讓
    // app_name=undefined、警告消失 → 此 assert 會紅。
    expect(screen.getByText(/未知應用程式/).textContent).toContain('Tripline 官方登入');
  });
});
