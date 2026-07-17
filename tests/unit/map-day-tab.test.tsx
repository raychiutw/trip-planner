/**
 * MapDayTab — Map page day-tab primitive.
 *
 * 單行「DAY N」膠囊（owner 2026-07-17 sign-off：去日期副標、active 淡 tonal pill）。
 * 視覺對應：docs/design-sessions/2026-07-17-v3-day-map-glass-capsule.html
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MapDayTab from '../../src/components/trip/MapDayTab';

describe('MapDayTab — 基本渲染', () => {
  it('傳 dayLabel：渲染單行 eyebrow', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 1" dayColor="#BE123C" isActive={false} onClick={() => {}} />,
    );
    expect(getByText('DAY 1')).not.toBeNull();
  });

  it('單行：不渲染日期副標 (.tp-map-day-tab-date)', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 1" isActive={false} onClick={() => {}} />,
    );
    expect(container.querySelector('.tp-map-day-tab-date')).toBeNull();
  });

  it('overview tab 無 dayColor：eyebrow 用 muted 預設色', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="總覽" isActive={true} onClick={() => {}} />,
    );
    const eyebrow = getByText('總覽');
    // overview eyebrow 不該套 dayColor inline style
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/color:\s*#/i);
  });

  it('day tab 帶 dayColor：eyebrow 套 dayColor inline style', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 3" dayColor="#7C3AED" isActive={false} onClick={() => {}} />,
    );
    const eyebrow = getByText('DAY 3');
    expect(eyebrow.getAttribute('style')).toMatch(/color:\s*(rgb\(124,\s*58,\s*237\)|#7c3aed)/i);
  });
});

describe('MapDayTab — active state', () => {
  it('isActive=true：button 有 is-active class + aria-current="true"', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 2" dayColor="#0369A1" isActive={true} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-current')).toBe('true');
  });

  it('isActive=false：button 無 is-active class + 無 aria-current', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 2" dayColor="#0369A1" isActive={false} onClick={() => {}} />,
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
      <MapDayTab dayLabel="DAY 4" dayColor="#059669" isActive={false} onClick={onClick} />,
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

  it('dayColor 不安全格式 (CSS injection attempt) 被 sanitize 掉', () => {
    const { container, getByText } = render(
      <MapDayTab
        dayLabel="DAY 9"
        dayColor="red; background: url(evil)"
        isActive={true}
        onClick={() => {}}
      />,
    );
    const eyebrow = getByText('DAY 9');
    // unsafe value should not appear in style
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/url\(evil\)/);
    // is-active button should not get --day-color from unsafe input
    const button = container.querySelector('button')!;
    expect(button.getAttribute('style') || '').not.toMatch(/url\(evil\)/);
  });
});
