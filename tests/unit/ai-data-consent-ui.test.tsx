/**
 * AI 資料同意（spec #1553、ADR-0012）前端：hook＋就地同意 sheet＋開新行程合併卡＋帳號設定區。
 * seam＝元件／hook 的公開介面，apiFetch 以假的取代（不碰網路）。已簽核版型：就地 sheet A、合併卡 A、設定 B。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, renderHook } from '@testing-library/react';
import AiDataConsentSheet from '../../src/components/AiDataConsentSheet';
import AiAuthorizeCard from '../../src/components/AiAuthorizeCard';
import AiDataConsentSettings from '../../src/components/AiDataConsentSettings';
import { useAiDataConsent } from '../../src/hooks/useAiDataConsent';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

const TEXT = {
  version: 'ai-data-v1', title: '讓 AI 協助安排你的行程？', intro: '要做到這些，我們需要把部分資料交給 AI 處理。',
  sections: [{ heading: '我們會交給 AI 的資料', items: ['行程內容'] }, { heading: '處理方', items: ['Anthropic（Claude）'] }],
  withdrawal: ['撤回後，新的 AI 要求會立即被拒絕。', '已經開始的工作不保證能停止。'],
};
const state = (over: Record<string, unknown> = {}) => ({
  status: 'none', currentVersion: 'ai-data-v1', acceptedVersion: null, acceptedAt: null, text: TEXT, enforced: true, ...over,
});
/** 以路徑＋方法派送的假 api；consent 狀態可被 POST／DELETE 改變。 */
function fakeApi(initial: Record<string, unknown>, opts: { authorized?: boolean } = {}) {
  let cur = initial; const calls: string[] = [];
  mockApiFetch.mockImplementation(async (path: string, o?: { method?: string; body?: string }) => {
    const m = o?.method ?? 'GET'; calls.push(`${m} ${path}`);
    if (path === '/account/ai-authorization') return { authorized: m === 'POST' ? true : (opts.authorized ?? false) };
    if (path === '/account/ai-data-consent') {
      if (m === 'POST') cur = state({ status: 'valid', acceptedVersion: JSON.parse(o!.body!).version, acceptedAt: '2026-11-03T00:00:00Z' });
      if (m === 'DELETE') cur = state({ status: 'withdrawn' });
      return cur;
    }
    throw new Error(`unexpected ${m} ${path}`);
  });
  return calls;
}
beforeEach(() => { mockApiFetch.mockReset(); });

describe('useAiDataConsent', () => {
  it('讀到狀態；status≠valid 且 enforced → needsConsent', async () => {
    fakeApi(state());
    const { result } = renderHook(() => useAiDataConsent());
    await waitFor(() => expect(result.current.consent).not.toBeNull());
    expect(result.current.needsConsent).toBe(true);
  });
  it('enforced=false（旗標關或文案未填妥）→ 不需要同意，UI 與沒有此功能時相同', async () => {
    fakeApi(state({ enforced: false }));
    const { result } = renderHook(() => useAiDataConsent());
    await waitFor(() => expect(result.current.consent).not.toBeNull());
    expect(result.current.needsConsent).toBe(false);
  });
  it('讀取失敗或回應不是同意狀態（舊測試的假回應）→ 一律視為不強制', async () => {
    mockApiFetch.mockResolvedValue({ authorized: true });
    const { result } = renderHook(() => useAiDataConsent());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.needsConsent).toBe(false);
    mockApiFetch.mockReset().mockRejectedValue(new Error('x'));
    const r2 = renderHook(() => useAiDataConsent());
    await act(async () => { await Promise.resolve(); });
    expect(r2.result.current.needsConsent).toBe(false);
  });
  it('accept 送「畫面上看到的版本」並更新為 valid', async () => {
    const calls = fakeApi(state());
    const { result } = renderHook(() => useAiDataConsent());
    await waitFor(() => expect(result.current.consent).not.toBeNull());
    await act(async () => { await result.current.accept(); });
    expect(calls).toContain('POST /account/ai-data-consent');
    const post = mockApiFetch.mock.calls.find(([p, o]) => p === '/account/ai-data-consent' && o?.method === 'POST')!;
    expect(JSON.parse(post[1].body)).toEqual({ version: 'ai-data-v1' }); // 只送畫面上看到的版本，不帶 userId
    expect(result.current.consent?.status).toBe('valid');
    expect(result.current.needsConsent).toBe(false);
  });
});

describe('AiDataConsentSheet（就地同意 A）', () => {
  const base = { open: true, consent: state() as never, busy: false, error: null, onAccept: vi.fn(), onDecline: vi.fn() };
  it('顯示 server 回的說明文字、版本、保留輸入提示；同意／暫不使用兩顆按鈕', () => {
    render(<AiDataConsentSheet {...base} message="把第三天晚餐改海鮮" />);
    expect(screen.getByText('讓 AI 協助安排你的行程？')).toBeTruthy();
    expect(screen.getByText('我們會交給 AI 的資料')).toBeTruthy();
    expect(screen.getByTestId('ai-data-consent-version').textContent).toContain('ai-data-v1');
    expect(screen.getByTestId('ai-data-consent-keep').textContent).toContain('保留');
    fireEvent.click(screen.getByTestId('ai-data-consent-accept'));
    expect(base.onAccept).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('ai-data-consent-decline'));
    expect(base.onDecline).toHaveBeenCalledTimes(1);
  });
  it('stale／withdrawn 各有一則說明橫幅', () => {
    const { rerender } = render(<AiDataConsentSheet {...base} consent={state({ status: 'stale', acceptedVersion: 'ai-data-v0' }) as never} />);
    expect(screen.getByTestId('ai-data-consent-banner').textContent).toContain('說明已更新');
    rerender(<AiDataConsentSheet {...base} consent={state({ status: 'withdrawn' }) as never} />);
    expect(screen.getByTestId('ai-data-consent-banner').textContent).toContain('撤回');
  });
  it('busy 時同意鈕 disabled；有 error 時顯示', () => {
    render(<AiDataConsentSheet {...base} busy error="同意失敗" />);
    expect((screen.getByTestId('ai-data-consent-accept') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('ai-data-consent-error').textContent).toBe('同意失敗');
  });
  it('owner-missing：沒有「同意」動作，只有「知道了」', () => {
    render(<AiDataConsentSheet {...base} mode="owner-missing" />);
    expect(screen.getByText('暫時無法使用 AI 助理')).toBeTruthy();
    expect(screen.queryByTestId('ai-data-consent-accept')).toBeNull();
    fireEvent.click(screen.getByTestId('ai-data-consent-decline'));
    expect(base.onDecline).toHaveBeenCalled();
  });
  it('open=false 不渲染', () => {
    render(<AiDataConsentSheet {...base} open={false} />);
    expect(screen.queryByTestId('ai-data-consent-sheet')).toBeNull();
  });
});

describe('AiAuthorizeCard 合併卡 A', () => {
  it('enforced 且兩者都沒做：一顆「同意並授權 AI」，按下兩個 POST 都送出，轉為已完成', async () => {
    const calls = fakeApi(state());
    render(<AiAuthorizeCard />);
    fireEvent.click(await screen.findByTestId('ai-authorize-btn'));
    await waitFor(() => expect(screen.getByTestId('ai-authorize-on')).toBeTruthy());
    expect(calls).toContain('POST /account/ai-authorization');
    expect(calls).toContain('POST /account/ai-data-consent');
  });
  it('卡片同意前就能看到 server 的說明全文與版本（資料類別、處理方、撤回），stale 有橫幅', async () => {
    fakeApi(state({ status: 'stale', acceptedVersion: 'ai-data-v0' }));
    render(<AiAuthorizeCard />);
    const box = await screen.findByTestId('ai-data-consent-summary');
    expect(box.textContent).toContain('我們會交給 AI 的資料');
    expect(box.textContent).toContain('Anthropic（Claude）');
    expect(box.textContent).toContain('版本 ai-data-v1');
    expect(box.textContent).toContain('說明已更新');
  });
  it('資料同意失敗：不送操作授權（狀態一致），顯示錯誤、按鈕仍在可重試', async () => {
    const calls = fakeApi(state());
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((path: string, o?: { method?: string }) =>
      path === '/account/ai-data-consent' && o?.method === 'POST' ? Promise.reject(new Error('x')) : base(path, o));
    render(<AiAuthorizeCard />);
    fireEvent.click(await screen.findByTestId('ai-authorize-btn'));
    expect(await screen.findByTestId('ai-authorize-error')).toBeTruthy();
    expect(calls).not.toContain('POST /account/ai-authorization');
    expect(screen.getByTestId('ai-authorize-btn')).toBeTruthy();
  });
  it('已授權操作但資料同意未做：仍顯示按鈕（不能當完成）', async () => {
    fakeApi(state(), { authorized: true });
    render(<AiAuthorizeCard />);
    expect(await screen.findByTestId('ai-authorize-btn')).toBeTruthy();
    expect(screen.queryByTestId('ai-authorize-on')).toBeNull();
  });
  it('enforced=false：行為與既有完全相同（只顯示「授權 AI」，不碰資料同意 POST）', async () => {
    const calls = fakeApi(state({ enforced: false }));
    render(<AiAuthorizeCard />);
    const btn = await screen.findByTestId('ai-authorize-btn');
    expect(btn.textContent).toBe('授權 AI');
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('ai-authorize-on')).toBeTruthy());
    expect(calls).not.toContain('POST /account/ai-data-consent');
  });
});

describe('AiDataConsentSettings（帳號設定 B）', () => {
  it('enforced=false → 整區不顯示', async () => {
    fakeApi(state({ enforced: false }));
    const { container } = render(<AiDataConsentSettings />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[data-testid="ai-data-settings"]')).toBeNull();
  });
  it('valid：顯示已同意版本與撤回；撤回前先確認，確認後 DELETE，轉為已關閉並如實說明', async () => {
    const calls = fakeApi(state({ status: 'valid', acceptedVersion: 'ai-data-v1', acceptedAt: '2026-11-03T00:00:00Z' }));
    render(<AiDataConsentSettings />);
    expect((await screen.findByTestId('ai-data-settings-status')).textContent).toContain('ai-data-v1');
    fireEvent.click(screen.getByTestId('ai-data-settings-withdraw'));
    expect(calls).not.toContain('DELETE /account/ai-data-consent'); // 還沒確認
    expect(screen.getByTestId('ai-data-withdraw-confirm').textContent).toContain('已經開始的工作不保證能停止');
    fireEvent.click(screen.getByTestId('ai-data-withdraw-confirm-yes'));
    await waitFor(() => expect(calls).toContain('DELETE /account/ai-data-consent'));
    await waitFor(() => expect(screen.getByTestId('ai-data-settings-status').textContent).toContain('已關閉'));
  });
  it('撤回失敗：顯示錯誤、狀態不變（仍已開啟）；撤回確認可取消', async () => {
    const calls = fakeApi(state({ status: 'valid', acceptedVersion: 'ai-data-v1', acceptedAt: '2026-11-03T00:00:00Z' }));
    const base = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation((path: string, o?: { method?: string }) =>
      o?.method === 'DELETE' ? Promise.reject(new Error('x')) : base(path, o));
    render(<AiDataConsentSettings />);
    fireEvent.click(await screen.findByTestId('ai-data-settings-withdraw'));
    fireEvent.click(screen.getByText('取消')); // 取消 → 回到未確認，沒有送 DELETE
    expect(screen.queryByTestId('ai-data-withdraw-confirm')).toBeNull();
    expect(calls).not.toContain('DELETE /account/ai-data-consent');
    fireEvent.click(screen.getByTestId('ai-data-settings-withdraw'));
    fireEvent.click(screen.getByTestId('ai-data-withdraw-confirm-yes'));
    expect((await screen.findByTestId('ai-data-settings-error')).textContent).toContain('撤回失敗');
    expect(screen.getByTestId('ai-data-settings-status').textContent).toContain('已開啟');
  });
  it('已同意時仍可查看目前說明全文', async () => {
    fakeApi(state({ status: 'valid', acceptedVersion: 'ai-data-v1', acceptedAt: '2026-11-03T00:00:00Z' }));
    render(<AiDataConsentSettings />);
    const box = await screen.findByTestId('ai-data-settings-text');
    expect(box.textContent).toContain('我們會交給 AI 的資料');
    expect(box.textContent).toContain('版本 ai-data-v1');
  });
  it('none／stale／withdrawn：顯示「查看說明並同意」，同意後轉 valid', async () => {
    fakeApi(state({ status: 'stale', acceptedVersion: 'ai-data-v0' }));
    render(<AiDataConsentSettings />);
    fireEvent.click(await screen.findByTestId('ai-data-settings-open'));
    fireEvent.click(await screen.findByTestId('ai-data-consent-accept'));
    await waitFor(() => expect(screen.getByTestId('ai-data-settings-status').textContent).toContain('已開啟'));
  });
});
