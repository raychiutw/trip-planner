import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import TripPrintPage from '../../src/pages/TripPrintPage';

vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: vi.fn() }));

const meta = { name: '長行程', title: '完整行程' };
const days = Array.from({ length: 14 }, (_, index) => ({
  dayNum: index + 1,
  date: `2026-10-${String(index + 1).padStart(2, '0')}`,
  timeline: [{ id: index + 1, startTime: '09:00', stopPois: [{ sortOrder: 1, name: `第 ${index + 1} 天景點` }] }],
}));
const notes = { flights: [], lodgings: [], reservations: [], pretripNotes: [{ title: '出發準備', content: '證件與保險' }], emergencyContacts: [] };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/trip/t1/print']}>
      <Routes><Route path="/trip/:tripId/print" element={<TripPrintPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('TripPrintPage complete output', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('waits for every required section, then prints all days and notes', async () => {
    let finishNotes!: (value: Response) => void;
    const pendingNotes = new Promise<Response>((resolve) => { finishNotes = resolve; });
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      return path.endsWith('/notes') ? pendingNotes : Promise.resolve(response(path.includes('/days') ? days : meta));
    });
    const print = vi.fn();
    vi.stubGlobal('print', print);
    mount();
    expect(screen.getByTestId('trip-print-loading')).toBeTruthy();
    expect((screen.getByTestId('trip-print-do') as HTMLButtonElement).disabled).toBe(true);
    finishNotes(response(notes));
    await waitFor(() => expect(screen.getByTestId('trip-print-document')).toBeTruthy());
    expect(screen.getAllByTestId(/^print-day-/)).toHaveLength(14);
    expect(screen.getByText('第 14 天景點')).toBeTruthy();
    expect(screen.getByText('證件與保險')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trip-print-do'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('does not print partial data when notes fail, and retries the complete load', async () => {
    let notesCalls = 0;
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      if (path.endsWith('/notes')) return Promise.resolve(++notesCalls === 1 ? response({ error: 'temporary' }, 500) : response(notes));
      return Promise.resolve(response(path.includes('/days') ? days : meta));
    });
    mount();
    await waitFor(() => expect(screen.getByTestId('trip-print-error')).toBeTruthy());
    expect(screen.queryByTestId('trip-print-document')).toBeNull();
    expect((screen.getByTestId('trip-print-do') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '重試載入' }));
    await waitFor(() => expect(screen.getByTestId('trip-print-document')).toBeTruthy());
    expect(screen.getByText('證件與保險')).toBeTruthy();
    expect(notesCalls).toBe(2);
  });

  it('does not call a partial notes response a complete print', async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(response(
      String(url).endsWith('/notes') ? { flights: [], lodgings: [], reservations: [], emergencyContacts: [] }
        : String(url).includes('/days') ? days : meta,
    )));
    mount();
    await waitFor(() => expect(screen.getByTestId('trip-print-error')).toBeTruthy());
    expect(screen.queryByTestId('trip-print-document')).toBeNull();
    expect((screen.getByTestId('trip-print-do') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a print launch failure and allows another attempt', async () => {
    vi.mocked(fetch).mockImplementation((url) => Promise.resolve(response(String(url).endsWith('/notes') ? notes : String(url).includes('/days') ? days : meta)));
    const print = vi.fn().mockImplementationOnce(() => { throw new Error('printer unavailable'); });
    vi.stubGlobal('print', print);
    mount();
    await waitFor(() => expect(screen.getByTestId('trip-print-document')).toBeTruthy());
    fireEvent.click(screen.getByTestId('trip-print-do'));
    expect(screen.getByRole('alert').textContent).toContain('列印失敗');
    fireEvent.click(screen.getByTestId('trip-print-do'));
    expect(print).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toContain('已送出列印指令');
  });

  it('does not print the previous trip while a new trip is still loading', async () => {
    let finishDays!: (value: Response) => void;
    const pendingDays = new Promise<Response>((resolve) => { finishDays = resolve; });
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/t2/days')) return pendingDays;
      if (path.endsWith('/notes')) return Promise.resolve(response(notes));
      if (path.includes('/days')) return Promise.resolve(response(days));
      return Promise.resolve(response(path.includes('/t2') ? { name: '新行程' } : meta));
    });
    render(<MemoryRouter initialEntries={['/trip/t1/print']}>
      <Link to="/trip/t2/print">下一份</Link>
      <Routes><Route path="/trip/:tripId/print" element={<TripPrintPage />} /></Routes>
    </MemoryRouter>);
    await waitFor(() => expect(screen.getByText('完整行程')).toBeTruthy());
    fireEvent.click(screen.getByRole('link', { name: '下一份' }));
    expect(screen.queryByText('完整行程')).toBeNull();
    expect((screen.getByTestId('trip-print-do') as HTMLButtonElement).disabled).toBe(true);
    finishDays(response(days));
    await waitFor(() => expect(screen.getByText('新行程')).toBeTruthy());
  });
});
