/**
 * AiAuthorizeCard — 就地 AI 授權卡（Phase 2 V1）。鎖：
 *   - mount GET → authorized:true → 顯「已授權」確認、無授權鈕
 *   - GET → authorized:false → 顯「授權 AI」鈕、無確認
 *   - 點鈕 → POST → authorized:true → 轉「已授權」
 *   - GET reject → 當未授權（顯鈕，不卡建立流程）
 *   - POST reject → 顯錯誤、鈕仍在可重試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AiAuthorizeCard from '../../src/components/AiAuthorizeCard';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('AiAuthorizeCard', () => {
  it('已授權 → 顯確認、無授權鈕，GET 打對端點', async () => {
    mockApiFetch.mockResolvedValue({ authorized: true });
    render(<AiAuthorizeCard />);
    await waitFor(() => expect(screen.getByTestId('ai-authorize-on')).toBeTruthy());
    expect(screen.queryByTestId('ai-authorize-btn')).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith('/account/ai-authorization');
  });

  it('未授權 → 顯授權鈕、無確認', async () => {
    mockApiFetch.mockResolvedValue({ authorized: false });
    render(<AiAuthorizeCard />);
    await waitFor(() => expect(screen.getByTestId('ai-authorize-btn')).toBeTruthy());
    expect(screen.queryByTestId('ai-authorize-on')).toBeNull();
  });

  it('點授權鈕 → POST 同端點 → 轉已授權', async () => {
    mockApiFetch.mockImplementation((_path: string, opts?: { method?: string }) =>
      Promise.resolve({ authorized: opts?.method === 'POST' }),
    );
    render(<AiAuthorizeCard />);
    await waitFor(() => screen.getByTestId('ai-authorize-btn'));
    fireEvent.click(screen.getByTestId('ai-authorize-btn'));
    await waitFor(() => expect(screen.getByTestId('ai-authorize-on')).toBeTruthy());
    expect(mockApiFetch).toHaveBeenCalledWith('/account/ai-authorization', { method: 'POST' });
  });

  it('初始載入中（GET 未 resolve）→ 只顯 header，無鈕無確認', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // 永不 resolve
    render(<AiAuthorizeCard />);
    expect(screen.getByText('讓 AI 幫你把行程填滿')).toBeTruthy();
    expect(screen.queryByTestId('ai-authorize-btn')).toBeNull();
    expect(screen.queryByTestId('ai-authorize-on')).toBeNull();
  });

  it('POST in-flight → 鈕 disabled + 顯「授權中⋯」', async () => {
    let resolvePost: (v: { authorized: boolean }) => void = () => {};
    mockApiFetch.mockImplementation((_p: string, opts?: { method?: string }) =>
      opts?.method === 'POST'
        ? new Promise<{ authorized: boolean }>((res) => {
            resolvePost = res;
          })
        : Promise.resolve({ authorized: false }),
    );
    render(<AiAuthorizeCard />);
    await waitFor(() => screen.getByTestId('ai-authorize-btn'));
    fireEvent.click(screen.getByTestId('ai-authorize-btn'));
    await waitFor(() => expect((screen.getByTestId('ai-authorize-btn') as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByTestId('ai-authorize-btn').textContent).toContain('授權中');
    resolvePost({ authorized: true });
    await waitFor(() => expect(screen.getByTestId('ai-authorize-on')).toBeTruthy());
  });

  it('讀狀態失敗 → 當未授權（顯鈕，不卡流程）', async () => {
    mockApiFetch.mockRejectedValue(new Error('401'));
    render(<AiAuthorizeCard />);
    await waitFor(() => expect(screen.getByTestId('ai-authorize-btn')).toBeTruthy());
  });

  it('POST 失敗 → 顯錯誤、鈕仍在可重試', async () => {
    mockApiFetch.mockImplementation((_path: string, opts?: { method?: string }) =>
      opts?.method === 'POST' ? Promise.reject(new Error('500')) : Promise.resolve({ authorized: false }),
    );
    render(<AiAuthorizeCard />);
    await waitFor(() => screen.getByTestId('ai-authorize-btn'));
    fireEvent.click(screen.getByTestId('ai-authorize-btn'));
    await waitFor(() => expect(screen.getByTestId('ai-authorize-error')).toBeTruthy());
    expect(screen.getByTestId('ai-authorize-btn')).toBeTruthy();
  });
});
