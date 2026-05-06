/**
 * TravelPill unit test — Section 4.6 (terracotta-mockup-parity-v2)
 *
 * 驗 component:
 *   - 兩 prop 都空時不 render (returns null)
 *   - min 有值時顯示 mockup 的「N min」
 *   - desc 有值時顯示文字
 *   - type 對應 icon class (car/walk/tram/plane fallback car)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TravelPill from '../../src/components/trip/TravelPill';

describe('TravelPill', () => {
  it('min + desc 都空時不 render', () => {
    const { container } = render(<TravelPill type="car" />);
    expect(container.firstChild).toBeNull();
  });

  it('min 為 0 也視為 empty', () => {
    const { container } = render(<TravelPill type="car" min={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('只給 min → 顯示「N min」', () => {
    render(<TravelPill type="car" min={15} />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).toContain('15 min');
  });

  it('只給 desc → 顯示 desc 文字', () => {
    render(<TravelPill type="walk" desc="沿縣道 58 號北上" />);
    expect(screen.getByText('沿縣道 58 號北上')).toBeTruthy();
  });

  it('min + desc 都給 → 都顯示', () => {
    render(<TravelPill type="car" min={45} desc="跨海大橋路段" />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).toContain('45 min');
    expect(pill.textContent).toContain('跨海大橋路段');
  });

  it('type 未知 fallback 到 car icon', () => {
    const { container } = render(<TravelPill type="unicorn" min={10} />);
    // 不深 inspect SVG path，只驗 icon container 存在
    expect(container.querySelector('.tp-travel-pill-icon')).toBeTruthy();
  });

  it('type=walk → walk icon (path 不同於 car)', () => {
    const { container: walkC } = render(<TravelPill type="walk" min={10} />);
    const { container: carC } = render(<TravelPill type="car" min={10} />);
    const walkPath = walkC.querySelector('.svg-icon path')?.getAttribute('d');
    const carPath = carC.querySelector('.svg-icon path')?.getAttribute('d');
    expect(walkPath).toBeTruthy();
    expect(carPath).toBeTruthy();
    expect(walkPath).not.toBe(carPath);
  });

  // v2.23.6: distance display
  it('distanceM ≥ 1000 → 「X.X km」格式', () => {
    render(<TravelPill type="car" min={22} distanceM={6230} />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).toContain('6.2 km');
    expect(pill.textContent).toContain('22 min');
  });

  it('distanceM < 1000 → 「Y00 m」rounded to 50m', () => {
    render(<TravelPill type="walk" min={2} distanceM={196} />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).toContain('200 m');
  });

  it('只給 distanceM 也 render（無 min）', () => {
    render(<TravelPill type="car" distanceM={5285} />);
    const pill = screen.getByTestId('travel-pill');
    expect(pill.textContent).toContain('5.3 km');
  });

  it('distanceM = 0 視為 empty（與 min=0 同 semantic）', () => {
    const { container } = render(<TravelPill type="car" distanceM={0} />);
    expect(container.firstChild).toBeNull();
  });
});
