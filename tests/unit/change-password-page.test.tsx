/**
 * 變更密碼頁（flutter#529）：已登入、知道目前密碼；成功後其他裝置登出、本機保持登入。
 * 後端契約：POST /api/account/password（trip-planner-api#50）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../src/lib/errors';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1', email: 'ray@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
const toastMock = vi.fn();
vi.mock('../../src/components/shared/Toast', () => ({ showToast: (...a: unknown[]) => toastMock(...a) }));
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import ChangePasswordPage from '../../src/pages/ChangePasswordPage';

const OLD = 'old-password-12345';
const NEW = 'brand-new-pass-678';

function renderPage() {
  return render(<MemoryRouter initialEntries={['/account/password']}><ChangePasswordPage /></MemoryRouter>);
}
const field = (id: string) => screen.getByTestId(id) as HTMLInputElement;
function fill(current: string, next: string) {
  fireEvent.change(field('change-password-current'), { target: { value: current } });
  fireEvent.change(field('change-password-new'), { target: { value: next } });
}
const submit = () => fireEvent.click(screen.getByTestId('change-password-submit'));
const passwordCalls = () => apiFetchMock.mock.calls.filter((c) => c[0] === '/account/password');
const rejectWith = (code: string, status: number) => apiFetchMock.mockRejectedValueOnce(new ApiError(code as never, status));

beforeEach(() => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  navigateMock.mockReset();
});

describe('ChangePasswordPage', () => {
  it('欄位帶正確的自動填入提示：目前密碼 current-password、新密碼 new-password，且預設遮蔽', () => {
    renderPage();
    expect(field('change-password-current').autocomplete).toBe('current-password');
    expect(field('change-password-new').autocomplete).toBe('new-password');
    expect(field('change-password-current').type).toBe('password');
    expect(field('change-password-new').type).toBe('password');
  });

  it('輸入框用共用的 tp-input-long（保有 focus 樣式與 16px 防 iOS 縮放）', () => {
    renderPage();
    expect(field('change-password-current').classList.contains('tp-input-long')).toBe(true);
    expect(field('change-password-new').classList.contains('tp-input-long')).toBe(true);
  });

  it('切換按鈕有 aria-pressed 反映顯示狀態', () => {
    renderPage();
    const toggle = screen.getByTestId('change-password-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('有錯誤時：錯誤訊息與輸入框關聯（aria-invalid、aria-describedby），沒錯誤時不標', () => {
    renderPage();
    expect(field('change-password-new').getAttribute('aria-invalid')).toBeNull();
    fill(OLD, 'short');
    submit();
    const alert = screen.getByRole('alert');
    expect(field('change-password-new').getAttribute('aria-invalid')).toBe('true');
    expect(field('change-password-new').getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('顯示／隱藏切換新密碼', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('change-password-toggle'));
    expect(field('change-password-new').type).toBe('text');
    fireEvent.click(screen.getByTestId('change-password-toggle'));
    expect(field('change-password-new').type).toBe('password');
  });

  it('成功：以 POST 送出 current_password／new_password，提示成功並回到帳號頁', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true });
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account'));
    const [path, init] = passwordCalls()[0]!;
    expect(path).toBe('/account/password');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ current_password: OLD, new_password: NEW });
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('密碼已更新'), expect.anything());
  });

  it('新密碼少於 8 字元：不送出，當場提示', () => {
    renderPage();
    fill(OLD, 'short');
    submit();
    expect(passwordCalls()).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('至少 8');
  });

  it('新密碼與目前密碼相同：不送出，當場提示', () => {
    renderPage();
    fill(OLD, OLD);
    submit();
    expect(passwordCalls()).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('不能和目前密碼相同');
  });

  it('沒填目前密碼：不送出', () => {
    renderPage();
    fill('', NEW);
    submit();
    expect(passwordCalls()).toHaveLength(0);
  });

  it('目前密碼錯（CHANGE_PASSWORD_CURRENT_INVALID）：顯示錯誤、保留已輸入內容、不離開頁面', async () => {
    rejectWith('CHANGE_PASSWORD_CURRENT_INVALID', 403);
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('目前密碼不正確'));
    expect(field('change-password-current').value).toBe(OLD);
    expect(field('change-password-new').value).toBe(NEW);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('被限流（CHANGE_PASSWORD_RATE_LIMITED）：提示稍後再試', async () => {
    rejectWith('CHANGE_PASSWORD_RATE_LIMITED', 429);
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('稍後再試'));
  });

  it('沒有密碼的帳號（CHANGE_PASSWORD_NO_PASSWORD）：說明是以 Google 登入', async () => {
    rejectWith('CHANGE_PASSWORD_NO_PASSWORD', 409);
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Google'));
  });

  it('網路失敗：顯示可重試的錯誤並保留輸入', async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('稍後'));
    expect(field('change-password-new').value).toBe(NEW);
    expect((screen.getByTestId('change-password-submit') as HTMLButtonElement).disabled).toBe(false);
  });

  it('送出期間按鈕停用，不會重複送出', async () => {
    let release!: (v: unknown) => void;
    apiFetchMock.mockReturnValueOnce(new Promise((r) => { release = r; }));
    renderPage();
    fill(OLD, NEW);
    submit();
    await waitFor(() => expect((screen.getByTestId('change-password-submit') as HTMLButtonElement).disabled).toBe(true));
    submit();
    // 繞過按鈕（例如 Enter 鍵、程式觸發）直接送出表單，也不會重複送出
    fireEvent.submit(screen.getByTestId('change-password-page').querySelector('form')!);
    expect(passwordCalls()).toHaveLength(1);
    release({ ok: true });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
