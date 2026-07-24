/**
 * MapDayTab — Map page day-tab primitive.
 *
 * 單行「DAY N」膠囊；active = 實心 accent-fill（比照 root tab）。
 * 色系統一（owner 2026-07-24「地圖模式 day tab 移除依日期不同顏色，回到統一色系」）：
 * eyebrow 不再依 dayColor 上色 —— idle muted、active accent-foreground，地圖與行程明細一致。
 * per-day 色只留地圖 polyline / entry card（見 DESIGN.md Day palette exception）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MapDayTab from '../../src/components/trip/MapDayTab';

describe('MapDayTab — 基本渲染', () => {
  it('傳 dayLabel：渲染單行 eyebrow', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 1" isActive={false} onClick={() => {}} />,
    );
    expect(getByText('DAY 1')).not.toBeNull();
  });

  it('單行：不渲染日期副標 (.tp-map-day-tab-date)', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 1" isActive={false} onClick={() => {}} />,
    );
    expect(container.querySelector('.tp-map-day-tab-date')).toBeNull();
  });

  it('idle eyebrow 用統一色（不再有 per-day inline color）', () => {
    // owner 2026-07-24：地圖 day tab 移除 per-day 顏色 → eyebrow 無 inline color，走 CSS muted。
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 3" isActive={false} onClick={() => {}} />,
    );
    const eyebrow = getByText('DAY 3');
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/color:/i);
  });

  it('active eyebrow 也無 inline color（走 CSS accent-foreground）', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="總覽" isActive={true} onClick={() => {}} />,
    );
    const eyebrow = getByText('總覽');
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/color:/i);
  });
});

describe('MapDayTab — active state', () => {
  it('isActive=true：button 有 is-active class + aria-current="true"', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 2" isActive={true} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-current')).toBe('true');
  });

  it('isActive=false：button 無 is-active class + 無 aria-current', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 2" isActive={false} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(false);
    expect(button.getAttribute('aria-current')).toBeNull();
  });
});

describe('MapDayTab — interaction', () => {
  it('點擊 button 觸發 onClick callback', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MapDayTab dayLabel="DAY 4" isActive={false} onClick={onClick} />,
    );
    (container.querySelector('button') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('button type="button" 不掛 role=tab (用 navigation 語意,DayNav wrapper 是 <nav>)', () => {
    const { container } = render(
      <MapDayTab dayLabel="總覽" isActive={true} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.getAttribute('role')).toBeNull();
    expect(button.getAttribute('type')).toBe('button');
  });
});
