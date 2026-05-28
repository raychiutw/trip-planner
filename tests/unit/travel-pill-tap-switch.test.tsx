/**
 * TravelPill + TravelPillDialog tap-switch test (v2.24.0 → v2.33.108 auto-save rewrite)
 *
 * v2.33.108 變動：移除 「儲存」 button，改 mode option click 立即觸發 PATCH。
 * Cancel button 改 「關閉」 (auto-save 已 commit 無 cancel 語意)。
 *
 * 驗證：
 *   - 沒 segment props → 唯讀
 *   - 有 segment props → button + ▾ affordance + click 開 dialog
 *   - mode option click → 立即 PATCH（非 transit）
 *   - transit + onBlur → PATCH 帶 mode + min
 *   - Esc / overlay click / 「關閉」button → 關 dialog
 *   - PATCH fail → SaveStatus 顯 error，dialog 仍開
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TravelPill from '../../src/components/trip/TravelPill';
// v2.33.143 PR18: SaveStatus 拔除後改 toast — 用 toastBus 訂閱攔截 toast 出現
import { showToast, dismissToast } from '../../src/components/shared/Toast';
import { resetToasts } from '../../src/lib/toastBus';
void showToast; void dismissToast;

const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
}));

beforeEach(() => {
  apiFetchRawMock.mockReset();
});

describe('TravelPill — read-only (v2.23 backwards compat)', () => {
  it('無 segment props → render 為 div role=presentation 不可點', () => {
    render(<TravelPill type="driving" min={11} distanceM={5300} />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('DIV');
    expect(pill).toHaveAttribute('role', 'presentation');
  });

  it('hasMin + hasDist 顯示 km + min', () => {
    render(<TravelPill type="driving" min={11} distanceM={5300} />);
    expect(screen.getByText('5.3 km')).toBeInTheDocument();
    expect(screen.getByText('11 min')).toBeInTheDocument();
  });
});

describe('TravelPill — interactive auto-save (v2.33.108)', () => {
  const baseSegment = {
    id: 42,
    mode: 'driving' as const,
    min: 11,
    distanceM: 5300,
    computedAt: 1700000000000,
  };

  it('segment + tripId → render 為 button + ▾ affordance', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('交通方式'));
    expect(pill.textContent).toContain('▾');
  });

  it('click pill → 開 dialog（三個 mode option + driving 預選）', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('travel-mode-option-driving')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('travel-mode-option-walking')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('travel-mode-option-transit')).toHaveAttribute('aria-pressed', 'false');
  });

  it('切換 driving → walking → 立即 PATCH 帶 mode (auto-save)', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'walking', version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    await waitFor(() => {
      const call = apiFetchRawMock.mock.calls.find((c) => c[0] === '/trips/trip-1/segments/42');
      expect(call).toBeTruthy();
      const init = call?.[1];
      expect(init?.method).toBe('PATCH');
      const body = JSON.parse(init?.body as string);
      expect(body.mode).toBe('walking');
    });
  });

  it('transit + min=30 + onBlur → PATCH 帶 mode + min', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-transit'));
    const input = screen.getByTestId('travel-transit-min-input');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    await waitFor(() => {
      const transitCall = apiFetchRawMock.mock.calls.find((c) => {
        const body = JSON.parse((c[1] as RequestInit).body as string);
        return body.mode === 'transit' && body.min === 30;
      });
      expect(transitCall).toBeTruthy();
    });
  });

  it('「關閉」button → 關 dialog (async)', async () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('travel-dialog-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
    });
  });

  it('Esc 鍵 → 關 dialog (async)', async () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
    });
  });

  it('overlay click → 關 dialog (async)', async () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    const overlay = screen.getByTestId('travel-pill-dialog');
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
    });
  });

  it('PATCH fail → toastBus 收到 error toast，dialog 仍開（v2.33.143 拔 SaveStatus 後改 toast）', async () => {
    // 訂閱 toastBus 攔截 — TravelPill 沒 render ToastContainer，無法用 DOM query
    const toasts: Array<{ message: string; type: string }> = [];
    const { subscribeToasts, getToasts } = await import('../../src/lib/toastBus');
    resetToasts();
    const unsub = subscribeToasts(() => {
      // listener fires on each change — snapshot current toasts
      getToasts().forEach((t) => toasts.push({ message: t.message, type: t.type }));
    });
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'SYS_INTERNAL', message: 'oops' } }), { status: 500 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    await waitFor(() => {
      expect(toasts.some((t) => t.type === 'error' && t.message.includes('交通方式儲存失敗'))).toBe(true);
    });
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('save-status')).toBeNull();
    unsub();
  });

  it('PATCH success → dispatch tp-segment-updated event + dialog 仍開（auto-save 不 close）', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'walking', version: 1 }), { status: 200 }));
    const onUpdated = vi.fn();
    window.addEventListener('tp-segment-updated', onUpdated);
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
    // dialog 仍開 — 改變後 auto-save，user 自己決定何時 close
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    window.removeEventListener('tp-segment-updated', onUpdated);
  });
});
