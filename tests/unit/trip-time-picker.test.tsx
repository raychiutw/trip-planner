/**
 * TripTimePicker — terracotta-themed time picker (replaces native type="time").
 *
 * Covers:
 *   - Trigger shows placeholder when value invalid/empty
 *   - Trigger shows HH:MM when value set (24h) / h:MM AM|PM (12h)
 *   - Popover opens with hour + minute columns (+ AM/PM column in 12h)
 *   - Clicking hour/minute cell triggers onChange with new value
 *   - is-selected class + minuteStep
 *   - 12/24 跟系統（hour12 prop 覆寫求測試確定性；app 不傳、跟 Intl hourCycle）
 *
 * 注意：test 環境 Node 預設 locale=en-US(hour12=true)，故 24h 測試一律明傳
 * hour12={false} 求確定性（不然 CI locale 會讓 rendering 飄）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TripTimePicker } from '../../src/components/TripTimePicker';

describe('TripTimePicker（24h）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders placeholder when value empty', () => {
    render(<TripTimePicker value="" onChange={() => {}} placeholder="--:--" hour12={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('--:--');
  });

  it('renders HH:MM when value set', () => {
    render(<TripTimePicker value="14:30" onChange={() => {}} hour12={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('14:30');
  });

  it('opens popover with 24 hours + 12 minute cells (step=5)', () => {
    render(<TripTimePicker value="12:00" onChange={() => {}} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    const cells = document.querySelectorAll<HTMLElement>('.tp-time-cell');
    expect(cells.length).toBe(24 + 12);
    expect(document.querySelector('[data-h="00"]')).not.toBeNull();
    expect(document.querySelector('[data-h="23"]')).not.toBeNull();
    expect(document.querySelector('[data-m="00"]')).not.toBeNull();
    expect(document.querySelector('[data-m="55"]')).not.toBeNull();
  });

  it('clicking hour cell triggers onChange with new HH:MM (mm preserved)', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="12:30" onChange={onChange} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="08"]')!);
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('clicking minute cell preserves hour', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="09:00" onChange={onChange} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-m="45"]')!);
    expect(onChange).toHaveBeenCalledWith('09:45');
  });

  it('renders selected cells with is-selected class', () => {
    render(<TripTimePicker value="07:25" onChange={() => {}} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('[data-h="07"]')!.className).toContain('is-selected');
    expect(document.querySelector('[data-m="25"]')!.className).toContain('is-selected');
  });

  it('minuteStep=15 renders only 4 minute cells', () => {
    render(<TripTimePicker value="12:00" onChange={() => {}} minuteStep={15} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    const minuteCells = document.querySelectorAll<HTMLElement>('[data-m]');
    expect(minuteCells.length).toBe(4);
    expect(document.querySelector('[data-m="45"]')).not.toBeNull();
  });

  it('clicking hour when value empty defaults minute to 00', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="" onChange={onChange} hour12={false} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="15"]')!);
    expect(onChange).toHaveBeenCalledWith('15:00');
  });
});

describe('TripTimePicker（12h 跟系統，W11）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('trigger 顯示 h:MM AM/PM（14:30 → 2:30 PM），儲存仍 24h', () => {
    render(<TripTimePicker value="14:30" onChange={() => {}} hour12 />);
    expect(screen.getByRole('button')).toHaveTextContent('2:30 PM');
  });

  it('popover：12 小時欄 + AM/PM 欄 + 分鐘欄', () => {
    render(<TripTimePicker value="14:30" onChange={() => {}} hour12 />);
    fireEvent.click(screen.getByRole('button'));
    // 12 hour cells（含 12）+ 2 period + 12 minute = 26
    expect(document.querySelector('[data-h="12"]')).not.toBeNull();
    expect(document.querySelector('[data-h="11"]')).not.toBeNull();
    expect(document.querySelector('[data-h="00"]')).toBeNull(); // 24h 專屬
    expect(document.querySelector('[data-period="AM"]')).not.toBeNull();
    expect(document.querySelector('[data-period="PM"]')).not.toBeNull();
  });

  it('目前 h12 + period 標記 is-selected（14:30 → 02 PM）', () => {
    render(<TripTimePicker value="14:30" onChange={() => {}} hour12 />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('[data-h="02"]')!.className).toContain('is-selected');
    expect(document.querySelector('[data-period="PM"]')!.className).toContain('is-selected');
  });

  it('點 12h 小時 cell → 組回 24h 儲存（沿用 PM：08 PM → 20:30）', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="14:30" onChange={onChange} hour12 />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="08"]')!);
    expect(onChange).toHaveBeenCalledWith('20:30');
  });

  it('點 AM/PM → 換 period 重算 24h（14:30 按 AM → 02:30）', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="14:30" onChange={onChange} hour12 />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-period="AM"]')!);
    expect(onChange).toHaveBeenCalledWith('02:30');
  });

  it('12 AM 邊角：00:15 顯示 12:15 AM、點 12 AM → 00', () => {
    const onChange = vi.fn();
    render(<TripTimePicker value="00:15" onChange={onChange} hour12 />);
    expect(screen.getByRole('button')).toHaveTextContent('12:15 AM');
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(document.querySelector('[data-h="12"]')!); // 12 AM
    expect(onChange).toHaveBeenCalledWith('00:15');
  });
});
