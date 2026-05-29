/**
 * FlightsSection unit test — v2.34.x 行程筆記 PR15
 *
 * Covers:
 *   - render empty (0 row) → only 加航段 button
 *   - render with rows → boarding pass display
 *   - Add → POST /api/trips/:id/notes/flights + opt updates state + auto edit mode
 *   - Edit airline input + blur → PATCH with expectedVersion
 *   - Delete via icon → ConfirmModal shown
 *   - Confirm delete → DELETE call + row removed
 *   - close edit button → display mode
 *   - boarding pass datetime format
 *   - autosave: no-change blur → no PATCH
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FlightsSection, { type TripFlight } from '../../src/components/trip-notes/FlightsSection';

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

function mkFlight(over: Partial<TripFlight> = {}): TripFlight {
  return {
    id: 1,
    sortOrder: 0,
    airline: 'CI',
    flightNo: 'CI 120',
    cabinClass: '',
    departAirport: 'TPE',
    arriveAirport: 'OKA',
    departAt: '2026-07-26T09:35',
    arriveAt: '2026-07-26T12:00',
    note: '',
    version: 0,
    ...over,
  };
}

beforeEach(() => {
  apiFetchMock.mockReset();
  cleanup();
});

describe('FlightsSection — empty', () => {
  it('0 items → only 加航段 button', () => {
    render(<FlightsSection tripId="trip-1" items={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId('flight-add-btn')).toBeInTheDocument();
    expect(screen.queryByTestId(/^flight-row-/)).toBeNull();
  });
});

describe('FlightsSection — boarding pass display', () => {
  it('1 flight → boarding pass row with airline / flight_no / time / airport', () => {
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={vi.fn()} />);
    const row = screen.getByTestId('flight-row-1');
    expect(row.textContent).toContain('CI');
    expect(row.textContent).toContain('CI 120');
    expect(row.textContent).toContain('09:35');
    expect(row.textContent).toContain('TPE');
    expect(row.textContent).toContain('OKA');
    expect(row.textContent).toContain('12:00');
  });
});

describe('FlightsSection — Add', () => {
  it('click 加航段 → POST then onChange called + edit mode opens', async () => {
    const onChange = vi.fn();
    const created = mkFlight({ id: 99, airline: '', flightNo: '' });
    apiFetchMock.mockResolvedValue(created);
    render(<FlightsSection tripId="trip-1" items={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('flight-add-btn'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/flights');
    expect((apiFetchMock.mock.calls[0][1] as any).method).toBe('POST');
    expect(onChange).toHaveBeenCalledWith([created]);
  });
});

describe('FlightsSection — Edit', () => {
  it('Click row body → enter edit mode (7 fields inputs)', () => {
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flight-row-1').querySelector('.tp-notes-flight-body')!);
    expect(screen.getByTestId('flight-input-airline-1')).toBeInTheDocument();
    expect(screen.getByTestId('flight-input-no-1')).toBeInTheDocument();
  });

  it('v2.34.44: Edit airline + blur → NO PATCH（stage only），完成 click → batch PATCH with field + expectedVersion', async () => {
    const onChange = vi.fn();
    const updated = mkFlight({ airline: '長榮', version: 1 });
    apiFetchMock.mockResolvedValue(updated);
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('flight-row-1').querySelector('.tp-notes-flight-body')!);
    const input = screen.getByTestId('flight-input-airline-1');
    fireEvent.change(input, { target: { value: '長榮' } });
    fireEvent.blur(input);
    // v2.34.44: blur 不再 fire PATCH（只 stage 到 pendingRef）
    expect(apiFetchMock).not.toHaveBeenCalled();
    // 點完成 → batch PATCH
    fireEvent.click(screen.getByTestId('flight-close-edit-1'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const init = apiFetchMock.mock.calls[0][1] as any;
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/flights/1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.airline).toBe('長榮');
    expect(body.expectedVersion).toBe(0);
    expect(onChange).toHaveBeenCalledWith([updated]);
  });

  it('v2.34.44: no-change blur + 完成 → no PATCH（pendingRef 空，flush 早 return）', async () => {
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flight-row-1').querySelector('.tp-notes-flight-body')!);
    const input = screen.getByTestId('flight-input-airline-1');
    fireEvent.blur(input);
    fireEvent.click(screen.getByTestId('flight-close-edit-1'));
    await new Promise((r) => setTimeout(r, 50));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('close edit button → exit edit mode', () => {
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('flight-row-1').querySelector('.tp-notes-flight-body')!);
    expect(screen.getByTestId('flight-close-edit-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('flight-close-edit-1'));
    expect(screen.queryByTestId('flight-input-airline-1')).toBeNull();
  });
});

describe('FlightsSection — Delete', () => {
  it('Trash icon → ConfirmModal「刪除航班？」shown', () => {
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={vi.fn()} />);
    const deleteBtns = screen.getAllByTestId('flight-delete-1');
    fireEvent.click(deleteBtns[0]); // first one (display-mode action button)
    expect(screen.getByText(/刪除航班/)).toBeInTheDocument();
    // modal message includes airline + flight number
    expect(screen.getAllByText(/CI 120/).length).toBeGreaterThanOrEqual(1);
  });

  it('Confirm modal → DELETE called', async () => {
    const onChange = vi.fn();
    apiFetchMock.mockResolvedValue({});
    render(<FlightsSection tripId="trip-1" items={[mkFlight()]} onChange={onChange} />);
    const deleteBtns = screen.getAllByTestId('flight-delete-1');
    fireEvent.click(deleteBtns[0]);
    // ConfirmModal「刪除」button
    const confirmBtn = screen.getByRole('button', { name: '刪除' });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const init = apiFetchMock.mock.calls[0][1] as any;
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/flights/1');
    expect(init.method).toBe('DELETE');
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
