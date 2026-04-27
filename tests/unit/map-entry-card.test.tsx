/**
 * MapEntryCard — Map page entry card primitive.
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 entry cards
 * Spec: openspec/changes/terracotta-pages-refactor/specs/terracotta-page-layout/spec.md
 *       Requirement「Pin type icon 系統（entry card 上）」
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MapEntryCard, { type EntryKind } from '../../src/components/trip/MapEntryCard';

describe('MapEntryCard — 基本渲染', () => {
  it('渲染 dayLocalIndex / dayLabel / time / title', () => {
    const { getByText } = render(
      <MapEntryCard
        dayLocalIndex={2}
        dayLabel="D1"
        dayColor="#BE123C"
        time="08:10"
        title="道之驛許田"
        kind="shopping"
        isActive={false}
        onClick={() => {}}
      />,
    );
    expect(getByText('2')).not.toBeNull();
    expect(getByText('D1')).not.toBeNull();
    expect(getByText('08:10')).not.toBeNull();
    expect(getByText('道之驛許田')).not.toBeNull();
  });

  it('num 套 dayColor border + text inline style', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={3}
        dayLabel="D1"
        dayColor="#BE123C"
        time="10:30"
        title="古宇利大橋"
        kind="sight"
        isActive={false}
        onClick={() => {}}
      />,
    );
    const num = container.querySelector('.tp-map-entry-card-num') as HTMLElement;
    expect(num).not.toBeNull();
    const style = num.getAttribute('style') || '';
    expect(style).toMatch(/border-color:\s*(rgb\(190,\s*18,\s*60\)|#be123c)/i);
    expect(style).toMatch(/color:\s*(rgb\(190,\s*18,\s*60\)|#be123c)/i);
  });

  it('day eyebrow 套 dayColor inline style', () => {
    const { getByText } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D2"
        dayColor="#0369A1"
        time="11:30"
        title="きしもと食堂"
        kind="food"
        isActive={false}
        onClick={() => {}}
      />,
    );
    const day = getByText('D2');
    expect(day.getAttribute('style')).toMatch(/color:\s*(rgb\(3,\s*105,\s*161\)|#0369a1)/i);
  });
});

describe('MapEntryCard — pin type icon mapping', () => {
  const cases: Array<{ kind: EntryKind; expectedHref: string | null }> = [
    { kind: 'hotel', expectedHref: '#i-bed' },
    { kind: 'food', expectedHref: '#i-utensils' },
    { kind: 'sight', expectedHref: '#i-camera' },
    { kind: 'shopping', expectedHref: '#i-bag' },
    { kind: 'other', expectedHref: null },
  ];

  for (const { kind, expectedHref } of cases) {
    it(`kind="${kind}" → icon ${expectedHref ?? '不渲染'}`, () => {
      const { container } = render(
        <MapEntryCard
          dayLocalIndex={1}
          dayLabel="D1"
          dayColor="#BE123C"
          time="08:00"
          title="X"
          kind={kind}
          isActive={false}
          onClick={() => {}}
        />,
      );
      const icon = container.querySelector('.tp-map-entry-card-icon use');
      if (expectedHref === null) {
        expect(icon).toBeNull();
      } else {
        expect(icon).not.toBeNull();
        // 接受 href 或 xlink:href
        const href = icon!.getAttribute('href') || icon!.getAttribute('xlink:href');
        expect(href).toBe(expectedHref);
      }
    });
  }
});

describe('MapEntryCard — active state', () => {
  it('isActive=true：button 有 is-active class + aria-pressed="true"', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D3"
        dayColor="#7C3AED"
        time="09:00"
        title="美麗海水族館"
        kind="sight"
        isActive={true}
        onClick={() => {}}
      />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('isActive=false：button 無 is-active class + aria-pressed="false"', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D3"
        dayColor="#7C3AED"
        time="09:00"
        title="美麗海水族館"
        kind="sight"
        isActive={false}
        onClick={() => {}}
      />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('MapEntryCard — interaction', () => {
  it('點擊 button 觸發 onClick', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D1"
        dayColor="#BE123C"
        time="08:00"
        title="X"
        kind="hotel"
        isActive={false}
        onClick={onClick}
      />,
    );
    (container.querySelector('button') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
