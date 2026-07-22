/**
 * owner 2026-07-22 #4：「行程航班的月曆會被外框壓住無法看到全部日期」。
 *
 * 第一層修好了：`.tp-notes-section` 的 `overflow: hidden`（裁 accordion 圓角）
 * 連 `.tp-date-popover`（`position: absolute`）一起裁，已移除。
 *
 * 但 preview 實測發現還沒完全滿足那句抱怨：popover 展開後底部仍超出
 * `.app-shell-sheet` 的可視區 71px。那層是 `overflow: auto`（可捲，不像先前的
 * `hidden` 永遠看不到），可是使用者得自己捲一下才看得到月底日期。
 *
 * 補上：popover 一開就把自己捲進視野。用 `scrollIntoView({ block: 'nearest' })`
 * —— nearest 的語意正是「已經看得到就不要動」，所以空間夠的情況（大多數桌機
 * 表單）完全不會有多餘捲動，只有被切到時才補那一段。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TripDatePicker } from '../../src/components/TripDatePicker';

describe('日期 popover 展開時自動捲入視野', () => {
  beforeEach(() => {
    // jsdom 沒有實作 scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('展開時對 popover 呼叫 scrollIntoView', () => {
    render(<TripDatePicker value="" onChange={() => {}} ariaLabel="起飛日期" />);
    fireEvent.click(screen.getByRole('button', { name: /起飛日期/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('用 block: nearest —— 已經看得到就不捲，不搶使用者的捲動位置', () => {
    render(<TripDatePicker value="" onChange={() => {}} ariaLabel="起飛日期" />);
    fireEvent.click(screen.getByRole('button', { name: /起飛日期/ }));
    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.[0]).toMatchObject({ block: 'nearest' });
  });

  it('環境沒有 scrollIntoView 時不炸（jsdom 就沒有 —— 少一個 ?. 會打壞每個 render 這個元件的測試）', () => {
    // 這條是為了鎖住一個實際踩到的回歸：第一版寫成 `ref.current?.scrollIntoView({...})`，
    // 少了方法本身的 optional call，結果 3 個既有的 TripDatePicker 測試全爆。
    // 捲動是純錦上添花，環境沒有就該安靜跳過。
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    expect(() => {
      render(<TripDatePicker value="" onChange={() => {}} ariaLabel="起飛日期" />);
      fireEvent.click(screen.getByRole('button', { name: /起飛日期/ }));
    }).not.toThrow();
  });

  it('關閉時不呼叫（只在展開那一刻捲）', () => {
    render(<TripDatePicker value="" onChange={() => {}} ariaLabel="起飛日期" />);
    const trigger = screen.getByRole('button', { name: /起飛日期/ });
    fireEvent.click(trigger);
    const afterOpen = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(trigger);
    expect((Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length).toBe(afterOpen);
  });
});
