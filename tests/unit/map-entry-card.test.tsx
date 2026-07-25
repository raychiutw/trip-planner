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
        dayTextColor="var(--day-text-5)"
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

  // #1168：num 的「邊框」與「文字」用**不同**兩顆色。DAY_PALETTE 是 Tailwind -500 飽和色，
  // 當淺底文字 10 色全不達 WCAG AA（1.92–4.11:1），但當圓框（非文字）沒問題。所以邊框留
  // dayColor、文字換 dayTextColor（值是 var(--day-text-N)，由 CSS 按主題解析深淺兩套）。
  // 這兩支測試鎖的就是「這兩者不可以又被合成同一顆」。
  it('num：border 吃 dayColor（飽和色）、文字吃 dayTextColor（token）—— 兩者不可混用', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={3}
        dayLabel="D1"
        dayColor="#BE123C"
        dayTextColor="var(--day-text-4)"
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
    expect(style).toMatch(/color:\s*var\(--day-text-4\)/i);
    // 負向：飽和 hex 絕對不能出現在 color（那是回歸成違規狀態）。
    // 用 (?<!border-)color 排除 border-color 的字尾 —— 直接寫 /color:.*#be123c/ 會把合法的
    // border-color 也算進去（#1156 review 迴圈踩過這個坑：加 /i 讓 borderColor 字尾誤命中）。
    expect(style).not.toMatch(/(?<!border-)color:\s*(rgb\(190,\s*18,\s*60\)|#be123c)/i);
  });

  it('day eyebrow 吃 dayTextColor，不吃飽和 dayColor', () => {
    const { getByText } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D2"
        dayColor="#0369A1"
        dayTextColor="var(--day-text-1)"
        time="11:30"
        title="きしもと食堂"
        kind="food"
        isActive={false}
        onClick={() => {}}
      />,
    );
    const day = getByText('D2');
    const style = day.getAttribute('style') || '';
    expect(style).toMatch(/color:\s*var\(--day-text-1\)/i);
    expect(style).not.toMatch(/(rgb\(3,\s*105,\s*161\)|#0369a1)/i);
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
          dayTextColor="var(--day-text-5)"
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
  // #1168：選中狀態從 aria-pressed 改成 aria-current。父容器是 role="list"，本元件掛
  // role="listitem" 去滿足它，但 listitem 覆蓋了 <button> 的隱含 role，而 aria-pressed
  // 只允許用在 button → axe 判 aria-allowed-attr **critical**（地圖頁整頁納入掃描時
  // 唯一剩下的違規）。aria-current 是全域屬性、任何 role 都合法，語意也更貼切：
  // 這些卡是「清單中的當前項」，不是可反覆按下放開的 toggle。
  it('isActive=true：button 有 is-active class + aria-current="true"', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D3"
        dayColor="#7C3AED"
        dayTextColor="var(--day-text-5)"
        time="09:00"
        title="美麗海水族館"
        kind="sight"
        isActive={true}
        onClick={() => {}}
      />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-current')).toBe('true');
    // 舊屬性必須真的不見了 —— 留著就還是 aria-allowed-attr 違規。
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });

  it('isActive=false：button 無 is-active class 且不掛 aria-current', () => {
    const { container } = render(
      <MapEntryCard
        dayLocalIndex={1}
        dayLabel="D3"
        dayColor="#7C3AED"
        dayTextColor="var(--day-text-5)"
        time="09:00"
        title="美麗海水族館"
        kind="sight"
        isActive={false}
        onClick={() => {}}
      />,
    );
    const button = container.querySelector('button')!;
    expect(button.classList.contains('is-active')).toBe(false);
    // aria-current 的慣例是「不是當前項就不掛」，而非掛 "false"（後者部分 SR 仍會朗讀）。
    expect(button.hasAttribute('aria-current')).toBe(false);
    expect(button.hasAttribute('aria-pressed')).toBe(false);
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
        dayTextColor="var(--day-text-5)"
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
