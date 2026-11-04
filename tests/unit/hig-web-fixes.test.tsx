/**
 * Value: protects=#1571 的四項非版面修正（WCAG 2.5.3 名稱含可見文字、ARIA 屬性合法、對比、分類中文）；
 *   fails_when=起訖 chip／日期欄的 aria-label 不含可見文字、必填又掛回不允許的 aria-required、
 *   列印分區數量標籤對比 < 4.5、Explore 分類顯示原始英文；
 *   why_new=axe 掃描只在 e2e 手動收集（HIG_COLLECT），沒有守門；seam=none；no_claim=螢幕閱讀器與語音操控實測
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../src/lib/entryMutations', () => ({ updateEntry: vi.fn() }));
vi.mock('../../src/components/shared/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../src/components/TripTimePicker', () => ({ TripTimePicker: () => null }));

import TravelPill from '../../src/components/trip/TravelPill';
import { EntryTimeChip } from '../../src/components/trip/EntryTimeChip';
import { TripDatePicker } from '../../src/components/TripDatePicker';
import { poiCategoryLabel } from '../../src/lib/poiCategory';
import { PRINT_CSS } from '../../src/lib/tripPrintStyles';
import { contrastRatio, cssRule } from './__helpers__/wcag';

/** WCAG 2.5.3：可見文字必須包含在 accessible name 內（慣例：以可見文字開頭） */
const expectNameStartsWithVisibleText = (el: HTMLElement) => {
  const visible = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const name = el.getAttribute('aria-label') ?? '';
  expect(visible.length, '沒有可見文字').toBeGreaterThan(0);
  expect(name.startsWith(visible), `aria-label「${name}」應以可見文字「${visible}」開頭`).toBe(true);
};

describe('起訖時間 chip（WCAG 2.5.3）', () => {
  it('有時間：名稱以可見的時間開頭，並說明動作', () => {
    render(<EntryTimeChip tripId="t1" entryId={1} dayNum={1} start="09:00" end="12:00" />);
    const chip = screen.getByRole('button', { name: /編輯起訖時間/ });
    expectNameStartsWithVisibleText(chip);
    expect(chip.getAttribute('aria-label')).toBe('09:00–12:00，編輯起訖時間');
  });

  it('沒有時間：名稱以可見的「設定時間」開頭', () => {
    render(<EntryTimeChip tripId="t1" entryId={1} dayNum={1} start={null} end={null} />);
    expectNameStartsWithVisibleText(screen.getByRole('button', { name: /編輯起訖時間/ }));
  });
});

describe('TripDatePicker 觸發鈕（WCAG 2.5.3、ARIA）', () => {
  it('有值：名稱含可見日期；沒值：名稱含可見的「選擇日期」；都保留欄位名稱', () => {
    const { rerender } = render(<TripDatePicker value="2026-07-01" onChange={() => {}} ariaLabel="出發日期" required />);
    let btn = screen.getByRole('button', { name: /出發日期/ });
    expectNameStartsWithVisibleText(btn);
    rerender(<TripDatePicker value="" onChange={() => {}} ariaLabel="出發日期" required />);
    btn = screen.getByRole('button', { name: /出發日期/ });
    expectNameStartsWithVisibleText(btn);
  });

  it('必填不用 button 角色不允許的 aria-required，改在名稱中說明', () => {
    render(<TripDatePicker value="" onChange={() => {}} ariaLabel="出發日期" required />);
    const btn = screen.getByRole('button', { name: /出發日期/ });
    expect(btn.hasAttribute('aria-required')).toBe(false);
    expect(btn.getAttribute('aria-label')).toMatch(/必填/);
  });

  it('非必填不加「必填」', () => {
    render(<TripDatePicker value="" onChange={() => {}} ariaLabel="回程日期" />);
    expect(screen.getByRole('button', { name: /回程日期/ }).getAttribute('aria-label')).not.toMatch(/必填/);
  });
});

describe('列印預覽分區數量標籤對比（WCAG 1.4.3）', () => {
  it('.tp-print-nh-cnt 文字色對白紙 ≥ 4.5', () => {
    const color = cssRule(PRINT_CSS, '.tp-print-nh-cnt').match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{3,6})/)![1];
    expect(contrastRatio(color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Explore 分類顯示中文', () => {
  it("'sight'（探索場景資料用的分類值）顯示為「景點」，不外露英文", () => {
    expect(poiCategoryLabel('sight')).toBe('景點');
    expect(poiCategoryLabel('SIGHT')).toBe('景點');
  });
});

describe('移動方式膠囊（WCAG 2.5.3）', () => {
  // 版面修正讓膠囊文字不再被截出視窗後，axe 才量得到它的名稱沒包含可見文字（原本落在「需人工」）。
  it('互動膠囊的 aria-label 以可見文字開頭，並保留「交通方式」與「點擊變更」', () => {
    render(
      <TravelPill
        tripId="t1"
        desc="從飯店開車 15 分鐘"
        segment={{ id: 1, tripId: 't1', fromEntryId: 1, toEntryId: 2, mode: 'driving', submode: null, min: 13, distanceM: 6600, source: 'google', computedAt: 1, updatedAt: 1, noTravel: null } as never}
      />,
    );
    const pill = screen.getByTestId('travel-pill');
    const name = pill.getAttribute('aria-label')!;
    expect(name.startsWith('13 min · 6.6 km · 從飯店開車 15 分鐘'), name).toBe(true);
    expect(name).toContain('交通方式');
    expect(name).toContain('點擊變更');
  });
});
