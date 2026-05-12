/**
 * TravelPill stale-travel detection — v2.28.1
 *
 * 當 caller 提供 `staleHaversineM` (預期大圓距離 from current masters)，
 * pill 比對顯示中的 distanceM；divergence > 20% → 渲染 ⚠ warning + 「重新計算」button。
 *
 * 為何重要：v2.28.0 引入 master swap (alternates → master) 後，trip_entries.travel_*
 * 仍是 swap 前 prev↔curr 計算結果。新 master 跨區（例 沖繩→東京）但 travel_min/desc 沒重算 →
 * user 看「3 min 0.4 km」卻指向 Tokyo Tower，會誤判。⚠ icon 是 visual hint
 * 提醒「車程未更新」，可點「重新計算」call recompute-travel。
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TravelPill from '../../src/components/trip/TravelPill';

describe('TravelPill — v2.28.1 stale-travel ⚠', () => {
  it('staleHaversineM 未提供 → 不渲染 ⚠ icon', () => {
    render(<TravelPill type="car" min={15} distanceM={5000} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('staleHaversineM 與 distanceM 一致（divergence < 20%）→ 不渲染 ⚠', () => {
    // 顯示 5.0 km，預期 Haversine 5.2 km → 4% divergence
    render(<TravelPill type="car" min={15} distanceM={5000} staleHaversineM={5200} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('staleHaversineM 顯著偏離（divergence > 20%）→ 渲染 ⚠ + 「車程未更新」hint', () => {
    // 顯示 0.4 km，預期 Haversine 1556 km (跨區) → > 200000% divergence
    render(<TravelPill type="car" min={3} distanceM={400} staleHaversineM={1_556_000} />);
    const stale = screen.getByTestId('travel-pill-stale');
    expect(stale).toBeTruthy();
    expect(stale.getAttribute('aria-label') ?? stale.textContent ?? '').toMatch(/車程|未更新|stale/i);
  });

  it('⚠ icon 點擊觸發 onRecompute callback', () => {
    const onRecompute = vi.fn();
    render(
      <TravelPill
        type="car"
        min={3}
        distanceM={400}
        staleHaversineM={1_556_000}
        onRecompute={onRecompute}
      />,
    );
    const recomputeBtn = screen.getByTestId('travel-pill-recompute');
    fireEvent.click(recomputeBtn);
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });

  it('distanceM = null（沒車程資料）+ staleHaversineM 有值 → 不渲染 ⚠（沒東西可比）', () => {
    // 只 transit/walk 才沒 distanceM；沒比較基準時不該誤觸警告
    render(<TravelPill type="transit" min={20} staleHaversineM={1_556_000} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('staleHaversineM = 0（master 缺座標）→ 不渲染 ⚠（caller 表示無法比較）', () => {
    render(<TravelPill type="car" min={15} distanceM={5000} staleHaversineM={0} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('staleHaversineM 負值（caller 傳爛資料）→ 不渲染 ⚠', () => {
    render(<TravelPill type="car" min={15} distanceM={5000} staleHaversineM={-100} />);
    expect(screen.queryByTestId('travel-pill-stale')).toBeNull();
  });

  it('20% 邊界（divergence = 20% 整 → 不警告，divergence > 20% → 警告）', () => {
    // displayed 1000m, Haversine 1200m → divergence = 0.2 (= threshold), 用 > 不警告
    const { rerender, container } = render(<TravelPill type="car" min={5} distanceM={1000} staleHaversineM={1200} />);
    expect(container.querySelector('[data-testid="travel-pill-stale"]')).toBeNull();
    // Haversine 1201m → divergence = 0.201 (> 0.2), 警告
    rerender(<TravelPill type="car" min={5} distanceM={1000} staleHaversineM={1201} />);
    expect(container.querySelector('[data-testid="travel-pill-stale"]')).toBeTruthy();
  });

  it('isStale=true 但 onRecompute 未傳 → 渲染 ⚠ chip 但無 recompute button', () => {
    render(<TravelPill type="car" min={3} distanceM={400} staleHaversineM={1_556_000} />);
    expect(screen.getByTestId('travel-pill-stale')).toBeTruthy();
    expect(screen.queryByTestId('travel-pill-recompute')).toBeNull();
  });
});
