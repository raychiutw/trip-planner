/**
 * TravelPill + TravelPillDialog tap-switch test (v2.24.0 Phase γ.0)
 *
 * 驗證：
 *   - 沒 segment props → 唯讀（v2.23 backwards compat）
 *   - 有 segment props → button + ▾ affordance + click 開 dialog
 *   - mode_source='user' → 顯示鎖頭 + 無 ▾
 *   - dialog 三選一切換 + transit 手動填 min + Save → PATCH
 *   - transit 沒填 min / min 超界 → Save disabled
 *   - 取消 / Esc 關 dialog
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TravelPill from '../../src/components/trip/TravelPill';

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

describe('TravelPill — interactive (v2.24.0 segment-aware)', () => {
  const baseSegment = {
    id: 42,
    mode: 'driving' as const,
    modeSource: 'auto' as const,
    min: 11,
    distanceM: 5300,
  };

  it('segment + tripId → render 為 button + ▾ affordance', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('交通方式'));
    expect(pill.textContent).toContain('▾');
  });

  it('mode_source=user → 顯示鎖頭 + 無 ▾', () => {
    render(<TravelPill segment={{ ...baseSegment, modeSource: 'user' }} tripId="trip-1" />);
    expect(screen.getByTestId('travel-pill-lock')).toBeInTheDocument();
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).not.toContain('▾');
  });

  it('click pill → 開 dialog（三個 mode option + driving 預選）', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('travel-mode-option-driving')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('travel-mode-option-walking')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('travel-mode-option-transit')).toHaveAttribute('aria-pressed', 'false');
  });

  it('切換 driving → walking → Save → PATCH 帶正確 body', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'walking', mode_source: 'user' }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    fireEvent.click(screen.getByTestId('travel-dialog-save'));
    await waitFor(() => {
      expect(apiFetchRawMock).toHaveBeenCalledWith(
        '/trips/trip-1/segments/42',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mode: 'walking' }),
        }),
      );
    });
  });

  it('切到 transit 沒填 min → Save disabled', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-transit'));
    expect(screen.getByTestId('travel-dialog-save')).toBeDisabled();
  });

  it('transit + min=30 → Save → PATCH 帶 mode + min', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-transit'));
    fireEvent.change(screen.getByTestId('travel-transit-min-input'), { target: { value: '30' } });
    fireEvent.click(screen.getByTestId('travel-dialog-save'));
    await waitFor(() => {
      expect(apiFetchRawMock).toHaveBeenCalledWith(
        '/trips/trip-1/segments/42',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mode: 'transit', min: 30 }),
        }),
      );
    });
  });

  it('transit + min=99999 (超 1440 上界) → Save disabled', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-transit'));
    fireEvent.change(screen.getByTestId('travel-transit-min-input'), { target: { value: '99999' } });
    expect(screen.getByTestId('travel-dialog-save')).toBeDisabled();
  });

  it('mode 沒變 → Save disabled (label "無變更")', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    const save = screen.getByTestId('travel-dialog-save');
    expect(save).toBeDisabled();
    expect(save.textContent).toBe('無變更');
  });

  it('cancel button → 關 dialog', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('travel-dialog-cancel'));
    expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
  });

  it('Esc 鍵 → 關 dialog', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
  });

  it('overlay click → 關 dialog（不點 sheet 內部）', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    const overlay = screen.getByTestId('travel-pill-dialog');
    fireEvent.click(overlay);
    expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
  });

  it('PATCH fail → 顯示 error，dialog 仍開', async () => {
    apiFetchRawMock.mockResolvedValue(new Response('Internal error', { status: 500 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    fireEvent.click(screen.getByTestId('travel-dialog-save'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/PATCH 失敗.*500/);
    });
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
  });

  it('PATCH success → dispatch tp-segment-updated event + close dialog', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const onUpdated = vi.fn();
    window.addEventListener('tp-segment-updated', onUpdated);
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-mode-option-walking'));
    fireEvent.click(screen.getByTestId('travel-dialog-save'));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('travel-pill-dialog')).not.toBeInTheDocument();
    });
    window.removeEventListener('tp-segment-updated', onUpdated);
  });
});
