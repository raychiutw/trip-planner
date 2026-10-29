import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTripPrintPdf } from '../../src/components/print/renderTripPrintPdf';
import type { TripPrintData } from '../../src/lib/tripPrintData';

const pdf = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('html2pdf.js', () => ({
  default: () => ({ set: () => ({ from: () => ({ save: pdf.save }) }) }),
}));

const data: TripPrintData = {
  name: '長行程',
  days: Array.from({ length: 12 }, (_, index) => ({
    dayNum: index + 1,
    timeline: [{ title: `第 ${index + 1} 天景點`, note: '完整備註' }],
  })),
  notes: { flights: [], lodgings: [], reservations: [], pretripNotes: [{ title: '準備', content: '保險' }], emergencyContacts: [] },
};

describe('PDF export lifecycle', () => {
  beforeEach(() => { pdf.save.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('keeps one export in flight and cleans its temporary DOM after success', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    pdf.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = renderTripPrintPdf({ data, fileBase: 'long-trip' });
    expect(await renderTripPrintPdf({ data })).toBe('busy');
    await vi.advanceTimersByTimeAsync(51);
    expect(pdf.save).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-trip-pdf]')).toHaveLength(1);
    expect(document.body.textContent).toContain('第 12 天景點');
    expect(document.body.textContent).toContain('保險');
    finish();
    expect(await first).toBe('saved');
    expect(document.querySelectorAll('[data-trip-pdf]')).toHaveLength(0);
    expect(document.body.textContent).not.toContain('第 12 天景點');
  });

  it('cleans after renderer failure and permits a later retry', async () => {
    vi.useFakeTimers();
    pdf.save.mockRejectedValueOnce(new Error('renderer failed')).mockResolvedValueOnce(undefined);
    const failed = renderTripPrintPdf({ data });
    const rejection = expect(failed).rejects.toThrow('renderer failed');
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    expect(document.querySelectorAll('[data-trip-pdf]')).toHaveLength(0);
    const retry = renderTripPrintPdf({ data });
    await vi.advanceTimersByTimeAsync(51);
    expect(await retry).toBe('saved');
    expect(pdf.save).toHaveBeenCalledTimes(2);
  });

  it('times out a hung renderer, cleans up, and allows retry', async () => {
    vi.useFakeTimers();
    pdf.save.mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValueOnce(undefined);
    const failed = renderTripPrintPdf({ data });
    const rejection = expect(failed).rejects.toThrow('PDF 產生逾時');
    await vi.advanceTimersByTimeAsync(30_100);
    await rejection;
    expect(document.querySelectorAll('[data-trip-pdf]')).toHaveLength(0);
    const retry = renderTripPrintPdf({ data });
    await vi.advanceTimersByTimeAsync(51);
    expect(await retry).toBe('saved');
    expect(pdf.save).toHaveBeenCalledTimes(2);
  });
});
