/**
 * Google 按鈕的顯示完全由 `GET /api/public-config` 的 providers.google 決定。
 * 新 api 的 production／staging 目前回 `{"providers":{"google":false}}`（沒設 GOOGLE_CLIENT_ID／SECRET），
 * 這時登入頁必須安靜地只剩密碼登入：不顯示按鈕、不顯示錯誤。探測失敗（網路、5xx、非 JSON）同理。
 * （OauthAuthorizePage 沒有 Google 按鈕，只有密碼登入，所以不受影響。）
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';

afterEach(() => { vi.unstubAllGlobals(); });

async function renderWithProbe(res: () => Promise<Response>) {
  const fetchMock = vi.fn(res);
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 30)); // 讓探測的 then 跑完
}

describe('LoginPage 的 Google 按鈕可用性', () => {
  it.each([
    ['providers.google=false', () => Promise.resolve(new Response(JSON.stringify({ providers: { google: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))],
    ['providers 缺欄位', () => Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))],
    ['探測 503', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['網路失敗', () => Promise.reject(new TypeError('offline'))],
  ])('%s：不顯示 Google 按鈕、不顯示錯誤，密碼登入仍在', async (_n, res) => {
    await renderWithProbe(res);
    expect(screen.queryByTestId('login-google')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('login-submit')).toBeTruthy();
  });
});
