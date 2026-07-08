/**
 * TravelPill stale-travel detection — v2.29.2 rewrite
 *
 * 從 v2.28.1 Haversine-based detection（比對 prev/curr master 直線距離 vs
 * displayed road distance，divergence > 20% → ⚠）改成純 `segment.computedAt`
 * 信號：
 *
 *   isStale = segment != null && segment.computedAt == null
 *
 * 原因：直線距離跟道路距離永遠有 detour ratio (1.2-2.5x)，driving 段幾乎都會
 * 超過 20% threshold → false positive (Ray 沖繩 32 segments 4/5 誤觸發)。
 * Backend 已在 setMaster() 時 UPDATE trip_segments SET computed_at = NULL，
 * 是真正可信的 stale signal。Stale 時 pill 不顯示舊 min/distance value，只露
 * 「車程重新計算中」status chip（self-healing 自動補算，無手動鈕）。
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TravelPill, { type TravelPillSegment } from '../../src/components/trip/TravelPill';

function seg(overrides: Partial<TravelPillSegment> = {}): TravelPillSegment {
  return {
    id: 1,
    mode: 'driving',
    min: 15,
    distanceM: 5000,
    computedAt: 1700000000000,
    ...overrides,
  };
}

describe('TravelPill — v2.29.2 stale-travel status chip (computed_at signal)', () => {
  it('segment 缺席（純 legacy travel_*）→ 不渲染 chip（沒 segment 表示 no stale signal source）', () => {
    render(<TravelPill type="car" min={15} distanceM={5000} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
    expect(screen.queryByText('15 min')).toBeTruthy();
  });

  it('segment.computedAt 有值（Google Routes 算過）→ 不渲染 chip，顯示正常 min/dist', () => {
    render(<TravelPill segment={seg({ computedAt: 1700000000000 })} tripId="t1" />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
    expect(screen.queryByText('15 min')).toBeTruthy();
  });

  it('segment.computedAt = null（backend mark stale）→ 渲染重算中 chip + 清空 min/dist', () => {
    render(<TravelPill segment={seg({ computedAt: null, min: 17, distanceM: 9334 })} tripId="t1" />);
    expect(screen.getByTestId('travel-pill-stale')).toBeTruthy();
    expect(screen.queryByText('17 min')).toBeNull();
    expect(screen.queryByText(/9\.3\s*km/)).toBeNull();
  });

  it('chip 顯示「車程重新計算中」文案 + aria-label 說明自動更新', () => {
    render(<TravelPill segment={seg({ computedAt: null })} tripId="t1" />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale.textContent ?? '').toContain('車程重新計算中');
    expect(stale.getAttribute('aria-label') ?? '').toMatch(/重新計算中|自動更新/);
  });

  it('被動 status chip — chip 內無任何 button（重算已自動化，無 affordance）', () => {
    render(<TravelPill segment={seg({ computedAt: null })} tripId="t1" />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale).toBeTruthy();
    // chip 本身純文字、無 button；互動 pill 本體（開 mode dialog）是另一個 element，不在此斷言
    expect(stale.querySelector('button')).toBeNull();
    expect(screen.queryByTestId('travel-pill-recompute')).toBeNull();
  });

  it('missingCoords（缺座標、self-healing 排除）→ chip 顯「缺座標」誠實訊息，不假稱計算中', () => {
    render(<TravelPill missing missingCoords tripId="t1" />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale.textContent ?? '').toContain('缺座標');
    expect(stale.textContent ?? '').not.toContain('重新計算中');
  });

  it('recomputeStalled（唯讀 viewer / 持續失敗）→ chip 顯「車程待更新」不假稱計算中', () => {
    render(<TravelPill segment={seg({ computedAt: null })} tripId="t1" recomputeStalled />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale.textContent ?? '').toContain('車程待更新');
    expect(stale.textContent ?? '').not.toContain('重新計算中');
    expect(stale.getAttribute('aria-label') ?? '').toContain('待更新');
  });

  it('missingCoords 優先於 recomputeStalled（缺座標仍顯缺座標）', () => {
    render(<TravelPill missing missingCoords recomputeStalled tripId="t1" />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale.textContent ?? '').toContain('缺座標');
    expect(stale.textContent ?? '').not.toContain('待更新');
  });

  it('legacy travel_* + segment（computedAt=null）→ stale 蓋過 legacy display', () => {
    // 即使 caller 還傳 v2.23 legacy travel_* fields，segment SoT 的 stale signal 仍主宰渲染
    render(
      <TravelPill
        type="car"
        min={20}
        distanceM={6000}
        segment={seg({ computedAt: null, min: 99, distanceM: 100 })}
        tripId="t1"
      />,
    );
    expect(screen.getByTestId('travel-pill-stale')).toBeTruthy();
    expect(screen.queryByText('20 min')).toBeNull();
    expect(screen.queryByText('99 min')).toBeNull();
  });

  it('driving 段 Google Routes 算過 11.3km（detour 2.2x 直線 5.2km）→ 不誤觸發（之前 Haversine logic 會錯誤標 stale）', () => {
    // Ray 沖繩 S1: 機場→租車。Haversine = 5169m, 道路 = 11299m, divergence = 54%
    // v2.28.1 邏輯會誤判 stale；v2.29.2 純看 computedAt 不再誤觸發
    render(
      <TravelPill
        segment={seg({ computedAt: 1700000000000, min: 27, distanceM: 11299 })}
        tripId="t1"
      />,
    );
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
    expect(screen.queryByText('27 min')).toBeTruthy();
  });
});
