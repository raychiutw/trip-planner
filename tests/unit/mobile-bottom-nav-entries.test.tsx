import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MobileBottomNav from '../../src/components/trip/MobileBottomNav';

/**
 * MobileBottomNav alternate route 可達驗證
 *
 * 確認 5 個 tab 按鈕仍 render，且功能性 onClick 存在（建議/航班仍可觸發 sheet）。
 * 對應 Fix Q3(A) — alternate route 未被誤砍，使用者仍可抵達各功能頁。
 */

function renderNav(overrides: Partial<Parameters<typeof MobileBottomNav>[0]> = {}) {
  const defaults = {
    activeSheet: null,
    onOpenSheet: vi.fn(),
    onClearSheet: vi.fn(),
    isOnline: true,
  };
  return render(<MobileBottomNav {...defaults} {...overrides} />);
}

describe('MobileBottomNav — 5 個 tab entry 全部存在', () => {
  it('「行程」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '行程' })).toBeTruthy();
  });

  it('「編輯」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '編輯' })).toBeTruthy();
  });

  it('「建議」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '建議' })).toBeTruthy();
  });

  it('「航班」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '航班' })).toBeTruthy();
  });

  it('「更多」tab render 且有 aria-label', () => {
    const { getByRole } = renderNav();
    expect(getByRole('button', { name: '更多' })).toBeTruthy();
  });

  it('「建議」按鈕 click 觸發 onOpenSheet("suggestions")', () => {
    const onOpenSheet = vi.fn();
    const { getByRole } = renderNav({ onOpenSheet });
    getByRole('button', { name: '建議' }).click();
    expect(onOpenSheet).toHaveBeenCalledWith('suggestions');
  });

  it('「航班」按鈕 click 觸發 onOpenSheet("flights")', () => {
    const onOpenSheet = vi.fn();
    const { getByRole } = renderNav({ onOpenSheet });
    getByRole('button', { name: '航班' }).click();
    expect(onOpenSheet).toHaveBeenCalledWith('flights');
  });

  it('「更多」按鈕 click 觸發 onOpenSheet("action-menu")', () => {
    const onOpenSheet = vi.fn();
    const { getByRole } = renderNav({ onOpenSheet });
    getByRole('button', { name: '更多' }).click();
    expect(onOpenSheet).toHaveBeenCalledWith('action-menu');
  });

  it('「行程」按鈕 click 觸發 onClearSheet', () => {
    const onClearSheet = vi.fn();
    const { getByRole } = renderNav({ onClearSheet });
    getByRole('button', { name: '行程' }).click();
    expect(onClearSheet).toHaveBeenCalled();
  });

  it('isOnline=false 時「編輯」tab disabled（不可點）', () => {
    const { getByRole } = renderNav({ isOnline: false });
    const btn = getByRole('button', { name: '編輯' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
