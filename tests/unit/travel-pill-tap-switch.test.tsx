/**
 * TravelPill + TravelPillDialog tap-switch test
 * (v2.24.0 → v2.33.108 auto-save → v2.55.45 多方式擴充)
 *
 * v2.33.108：移除「儲存」button，mode 改動立即 PATCH（auto-save）。
 * v2.55.45：3 mode → 8 方式晶片格（駕車/步行/單軌/公車/地鐵/火車/高鐵/其他）。
 *   testid：travel-mode-option-X → travel-method-X；travel-transit-min-input → travel-min-input。
 *   自動方式（driving/walking/monorail/bus）可手填覆寫 → source='manual' 鎖定 + 恢復鈕。
 *
 * 驗證：
 *   - 沒 segment props → 唯讀
 *   - 有 segment props → button + ▾ affordance + click 開 dialog
 *   - 自動方式 chip click → 立即 PATCH（不帶 min）
 *   - 手填方式（地鐵）+ min + onBlur → PATCH 帶 mode + submode + min
 *   - 單軌 chip click → PATCH transit + submode=monorail（自動，不帶 min）
 *   - 覆寫的單軌 → 顯恢復鈕，click → PATCH 不帶 min（回自動）
 *   - Esc / overlay click / 「關閉」button → 關 dialog
 *   - PATCH fail → toast error，dialog 仍開
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

/** 從 mock 找出打到 segment 42 的 PATCH body。 */
function findSegmentPatchBody(): Record<string, unknown> | undefined {
  const call = apiFetchRawMock.mock.calls.find((c) => c[0] === '/trips/trip-1/segments/42');
  if (!call?.[1]) return undefined;
  return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
}

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

describe('TravelPill — interactive auto-save (v2.55.45 多方式)', () => {
  const baseSegment = {
    id: 42,
    mode: 'driving' as const,
    submode: null,
    source: 'google' as const,
    min: 11,
    distanceM: 5300,
    computedAt: 1700000000000,
    noTravel: null,
  };

  it('segment + tripId → render 為 button + ▾ affordance', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('交通方式'));
    expect(pill.textContent).toContain('▾');
  });

  it('click pill → 開 dialog（8 方式晶片 + driving 預選、無恢復鈕）', () => {
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('travel-method-driving')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('travel-method-walking')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('travel-method-monorail')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('travel-method-other')).toBeInTheDocument();
    // driving source=google（非 manual）→ 無「恢復自動計算」鈕
    expect(screen.queryByTestId('travel-revert')).toBeNull();
  });

  it('切換 driving → walking → 立即 PATCH 帶 mode、不帶 min (auto-save)', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'walking', version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    await waitFor(() => {
      const body = findSegmentPatchBody();
      expect(body).toBeTruthy();
      expect(body?.mode).toBe('walking');
      // 自動方式選擇 = 不帶 min（走自動算）
      expect('min' in (body ?? {})).toBe(false);
    });
  });

  it('單軌 chip → PATCH transit + submode=monorail（自動，不帶 min）', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'transit', submode: 'monorail', version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-monorail'));
    await waitFor(() => {
      const body = findSegmentPatchBody();
      expect(body?.mode).toBe('transit');
      expect(body?.submode).toBe('monorail');
      expect('min' in (body ?? {})).toBe(false);
    });
  });

  it('地鐵（手填）+ min=30 + onBlur → PATCH 帶 mode + submode + min', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-metro'));
    const input = screen.getByTestId('travel-min-input');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    await waitFor(() => {
      const transitCall = apiFetchRawMock.mock.calls.find((c) => {
        if (!c[1]) return false;
        const body = JSON.parse((c[1] as RequestInit).body as string);
        return body.mode === 'transit' && body.submode === 'metro' && body.min === 30;
      });
      expect(transitCall).toBeTruthy();
    });
  });

  it('其他（自由文字）+ 方式名 + min + onBlur → PATCH transit + submode=方式名 + min (G16)', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-other'));
    fireEvent.change(screen.getByTestId('travel-other-name'), { target: { value: '水上巴士' } });
    const input = screen.getByTestId('travel-min-input');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    await waitFor(() => {
      const call = apiFetchRawMock.mock.calls.find((c) => {
        if (!c[1]) return false;
        const body = JSON.parse((c[1] as RequestInit).body as string);
        return body.mode === 'transit' && body.submode === '水上巴士' && body.min === 25;
      });
      expect(call).toBeTruthy();
    });
  });

  it('其他 方式名留空 + 填 min + onBlur → 不 PATCH（freeText && !submode guard, G16）', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, version: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-other'));
    // 方式名留空、只填 min → commitManual 早退，不送 segment PATCH
    const input = screen.getByTestId('travel-min-input');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    // 等一拍確保沒有非同步 PATCH 漏發
    await new Promise((r) => setTimeout(r, 20));
    expect(findSegmentPatchBody()).toBeUndefined();
  });

  it('已覆寫的單軌（source=manual）→ 顯恢復鈕，click → PATCH 不帶 min（回自動）', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 42, mode: 'transit', submode: 'monorail', version: 2 }), { status: 200 }));
    const overriddenMonorail = {
      id: 42,
      mode: 'transit' as const,
      submode: 'monorail',
      source: 'manual',
      min: 20,
      distanceM: 6000,
      computedAt: 1700000000000,
    };
    render(<TravelPill segment={overriddenMonorail} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-method-monorail')).toHaveAttribute('aria-pressed', 'true');
    const revert = screen.getByTestId('travel-revert');
    fireEvent.click(revert);
    await waitFor(() => {
      const body = findSegmentPatchBody();
      expect(body?.mode).toBe('transit');
      expect(body?.submode).toBe('monorail');
      // 恢復自動 = 不帶 min（JSON.stringify 丟棄 undefined）
      expect('min' in (body ?? {})).toBe(false);
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

  it('PATCH fail → toastBus 收到 error toast，dialog 仍開', async () => {
    const toasts: Array<{ message: string; type: string }> = [];
    const { subscribeToasts, getToasts } = await import('../../src/lib/toastBus');
    resetToasts();
    const unsub = subscribeToasts(() => {
      getToasts().forEach((t) => toasts.push({ message: t.message, type: t.type }));
    });
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'SYS_INTERNAL', message: 'oops' } }), { status: 500 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-walking'));
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
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
    window.removeEventListener('tp-segment-updated', onUpdated);
  });

  // v2.55.46 同一地點/免交通
  it('N-render：segment.noTravel=1 → 收合成「不需計算路程」marker（非 pill）', () => {
    render(<TravelPill segment={{ ...baseSegment, noTravel: 1 }} tripId="trip-1" />);
    const sp = screen.getByTestId('travel-sameplace');
    expect(sp.tagName).toBe('BUTTON'); // 互動：可 tap 開 dialog 改回
    expect(sp.textContent).toContain('不需計算路程');
    expect(screen.queryByTestId('travel-pill')).not.toBeInTheDocument(); // 不再顯示交通 pill
  });

  it('N-mark：dialog 點「同一地點・免交通」列 → PATCH 帶 noTravel:true', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ mode: 'driving', min: null, noTravel: 1 }), { status: 200 }));
    render(<TravelPill segment={baseSegment} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-sameplace'));
    await waitFor(() => {
      expect(findSegmentPatchBody()).toMatchObject({ noTravel: true });
    });
  });

  it('N-dialog-state：noTravel 段開 dialog → 同一地點列 aria-pressed=true + hint 顯示', () => {
    render(<TravelPill segment={{ ...baseSegment, noTravel: 1 }} tripId="trip-1" />);
    fireEvent.click(screen.getByTestId('travel-sameplace'));
    expect(screen.getByTestId('travel-method-sameplace')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('travel-sameplace-hint')).toBeInTheDocument();
    // 交通方式 detail 區被 sameplace hint 取代 → 無 min input
    expect(screen.queryByTestId('travel-min-input')).not.toBeInTheDocument();
  });
});

// 2026-07 需求 2：pair 無 segment row（missing，如跨國航班算不出）時，timeline pill
// 過去渲染成不可點 div → 卡在「車程計算中」無從修改。放開：有 from/to entry id + tripId
// → pill 可點開 dialog（create 模式，無 segmentId 走 POST /segments upsert）。
describe('TravelPill — missing segment 可建立（放開「車程計算中」）', () => {
  it('missing + from/to entry id + tripId → pill 可點（button）', () => {
    render(<TravelPill missing tripId="trip-1" fromEntryId={10} toEntryId={11} />);
    expect(screen.getByTestId('travel-pill').tagName).toBe('BUTTON');
  });

  it('missing 但缺 entry id → 維持不可點（div）', () => {
    render(<TravelPill missing tripId="trip-1" />);
    expect(screen.getByTestId('travel-pill').tagName).toBe('DIV');
  });

  it('click missing pill → 開 dialog（create 模式）', () => {
    render(<TravelPill missing tripId="trip-1" fromEntryId={10} toEntryId={11} />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    expect(screen.getByTestId('travel-pill-dialog')).toBeInTheDocument();
  });

  it('create 模式選 walking → POST /segments 帶 from/to + mode', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 99, mode: 'walking', version: 0 }), { status: 201 }));
    render(<TravelPill missing tripId="trip-1" fromEntryId={10} toEntryId={11} />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-walking'));
    await waitFor(() => {
      const call = apiFetchRawMock.mock.calls.find(
        (c) => c[0] === '/trips/trip-1/segments' && (c[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.mode).toBe('walking');
      expect(body.from_entry_id).toBe(10);
      expect(body.to_entry_id).toBe(11);
    });
  });

  it('create 模式選「不需計算路程」→ POST /segments 帶 from/to + noTravel:true', async () => {
    apiFetchRawMock.mockResolvedValue(new Response(JSON.stringify({ id: 99, noTravel: 1, version: 0 }), { status: 201 }));
    render(<TravelPill missing tripId="trip-1" fromEntryId={10} toEntryId={11} />);
    fireEvent.click(screen.getByTestId('travel-pill'));
    fireEvent.click(screen.getByTestId('travel-method-sameplace'));
    await waitFor(() => {
      const call = apiFetchRawMock.mock.calls.find(
        (c) => c[0] === '/trips/trip-1/segments' && (c[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.noTravel).toBe(true);
      expect(body.from_entry_id).toBe(10);
      expect(body.to_entry_id).toBe(11);
    });
  });
});
