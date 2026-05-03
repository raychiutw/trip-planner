/**
 * MapDayTab — Map page bottom underline tab primitive.
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 day tabs
 *           docs/design-sessions/2026-04-27-unified-layout-plan.md Map row
 *
 * Spec: openspec/changes/terracotta-pages-refactor/specs/terracotta-page-layout/spec.md
 *       Requirement「Day tab dayColor underline」
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MapDayTab from '../../src/components/trip/MapDayTab';

describe('MapDayTab — 基本渲染', () => {
  it('傳 dayLabel + dateLabel：渲染 eyebrow + date', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 01" dateLabel="7/29" dayColor="#BE123C" isActive={false} onClick={() => {}} />,
    );
    expect(getByText('DAY 01')).not.toBeNull();
    expect(getByText('7/29')).not.toBeNull();
  });

  it('overview tab 無 dayColor：eyebrow 用 muted 預設色', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="總覽" dateLabel="7天" isActive={true} onClick={() => {}} />,
    );
    const eyebrow = getByText('總覽');
    // overview eyebrow 不該套 dayColor inline style
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/color:\s*#/i);
  });

  it('day tab 帶 dayColor：eyebrow 套 dayColor inline style', () => {
    const { getByText } = render(
      <MapDayTab dayLabel="DAY 03" dateLabel="7/31" dayColor="#7C3AED" isActive={false} onClick={() => {}} />,
    );
    const eyebrow = getByText('DAY 03');
    expect(eyebrow.getAttribute('style')).toMatch(/color:\s*(rgb\(124,\s*58,\s*237\)|#7c3aed)/i);
  });
});

describe('MapDayTab — active state', () => {
  it('isActive=true：button 有 is-active class + aria-current="true"', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 02" dateLabel="7/30" dayColor="#0369A1" isActive={true} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-current')).toBe('true');
  });

  it('isActive=false：button 無 is-active class + 無 aria-current', () => {
    const { container } = render(
      <MapDayTab dayLabel="DAY 02" dateLabel="7/30" dayColor="#0369A1" isActive={false} onClick={() => {}} />,
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
      <MapDayTab dayLabel="DAY 04" dateLabel="8/01" dayColor="#059669" isActive={false} onClick={onClick} />,
    );
    (container.querySelector('button') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('button type="button" 不掛 role=tab (用 navigation 語意,DayNav wrapper 是 <nav>)', () => {
    const { container } = render(
      <MapDayTab dayLabel="總覽" dateLabel="7天" isActive={true} onClick={() => {}} />,
    );
    const button = container.querySelector('button')!;
    expect(button.getAttribute('role')).toBeNull();
    expect(button.getAttribute('type')).toBe('button');
  });

  it('dayColor 不安全格式 (CSS injection attempt) 被 sanitize 掉', () => {
    const { container, getByText } = render(
      <MapDayTab
        dayLabel="DAY 09"
        dateLabel="9/9"
        dayColor="red; background: url(evil)"
        isActive={true}
        onClick={() => {}}
      />,
    );
    const eyebrow = getByText('DAY 09');
    // unsafe value should not appear in style
    expect(eyebrow.getAttribute('style') || '').not.toMatch(/url\(evil\)/);
    // is-active button should not get --day-color from unsafe input
    const button = container.querySelector('button')!;
    expect(button.getAttribute('style') || '').not.toMatch(/url\(evil\)/);
  });
});
