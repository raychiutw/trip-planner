import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripSharePage from '../../src/pages/TripSharePage';
import { renderTripPrintPdf } from '../../src/components/print/renderTripPrintPdf';

const pdf = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('html2pdf.js', () => ({
  default: () => ({ set: () => ({ from: () => ({ save: pdf.save }) }) }),
}));

const payload = {
  meta: { name: '沖繩', title: '沖繩五日', sharedBy: 'Ray' },
  days: [{ dayNum: 1, timeline: [{ id: 1, stopPois: [{ sortOrder: 1, name: '那霸機場' }] }] }],
  notes: { flights: [], lodgings: [], reservations: [], pretripNotes: [{ title: '準備', content: '保險' }], emergencyContacts: [] },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('public share PDF output', () => {
  beforeEach(() => {
    pdf.save.mockReset();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      if (String(input).startsWith('/api/share/')) return json(payload);
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows preparation, output, completion and blocks duplicate clicks', async () => {
    let finish!: () => void;
    pdf.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<MemoryRouter initialEntries={['/s/token']}><Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-pdf')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-pdf'));
    expect(screen.getByRole('status').textContent).toContain('準備 PDF');
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('輸出 PDF'));
    fireEvent.click(screen.getByTestId('share-pdf'));
    expect(pdf.save).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('PDF 已下載'));
  });

  it('reports renderer failure and retries from the same share', async () => {
    pdf.save.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined);
    render(<MemoryRouter initialEntries={['/s/token']}><Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-pdf')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-pdf'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PDF 產生失敗'));
    fireEvent.click(screen.getByTestId('share-pdf'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('PDF 已下載'));
    expect(pdf.save).toHaveBeenCalledTimes(2);
  });

  it('reports a print launch failure and accepts another click', async () => {
    const print = vi.fn().mockImplementationOnce(() => { throw new Error('printer unavailable'); });
    vi.stubGlobal('print', print);
    render(<MemoryRouter initialEntries={['/s/token']}><Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-print')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-print'));
    expect(screen.getByRole('alert').textContent).toContain('列印失敗');
    fireEvent.click(screen.getByTestId('share-print'));
    expect(print).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toContain('已送出列印指令');
  });

  it('reports an existing PDF run as busy without calling it a failure', async () => {
    let finish!: () => void;
    pdf.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const prior = renderTripPrintPdf({ data: {
      name: '原行程', days: [], notes: { flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] },
    } });
    await waitFor(() => expect(pdf.save).toHaveBeenCalledTimes(1));
    render(<MemoryRouter initialEntries={['/s/token']}><Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-pdf')).toBeTruthy());
    fireEvent.click(screen.getByTestId('share-pdf'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('PDF 正在產生中'));
    expect(pdf.save).toHaveBeenCalledTimes(1);
    finish();
    await prior;
  });

  it('does not offer print or PDF for a partial public payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/oauth/userinfo') return json({}, 401);
      return json({ ...payload, notes: { flights: [] } });
    }));
    render(<MemoryRouter initialEntries={['/s/token']}><Routes><Route path="/s/:token" element={<TripSharePage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('share-error')).toBeTruthy());
    expect(screen.queryByTestId('share-print')).toBeNull();
    expect(screen.queryByTestId('share-pdf')).toBeNull();
  });
});
