/**
 * #1601 — 匯入大小上限以「字元數」計（與後端 text.length 一致），不是檔案位元組數。
 * 20 萬個中文字：UTF-8 約 600KB（> 512KB）但字元數 < 512K，應放行。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ImportTripButton from '../../src/components/trips/ImportTripButton';

const apiFetch = vi.fn();
const showToast = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('../../src/lib/toastBus', () => ({ showToast: (...a: unknown[]) => showToast(...a) }));

const LIMIT = 512 * 1024;

/** 合法 JSON，補到指定字元數（用單一字元填充 meta.pad）。 */
function jsonOfChars(chars: number, ch: string): string {
  const base = '{"schemaVersion":1,"pad":""}';
  return base.replace('""', `"${ch.repeat(chars - base.length + 2)}"`);
}

function pick(text: string) {
  const file = new File([text], 'trip.json', { type: 'application/json' });
  render(<MemoryRouter><ImportTripButton /></MemoryRouter>);
  fireEvent.change(screen.getByTestId('trips-import-file'), { target: { files: [file] } });
}

describe('ImportTripButton 大小上限單位', () => {
  beforeEach(() => { apiFetch.mockReset().mockResolvedValue({ tripId: 't1' }); showToast.mockReset(); });

  it('中文檔：位元組 > 512KB 但字元數 <= 512K，放行', async () => {
    const text = jsonOfChars(200_000, '中');
    expect(text.length).toBeLessThanOrEqual(LIMIT);
    expect(new Blob([text]).size).toBeGreaterThan(LIMIT);
    pick(text);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(showToast).not.toHaveBeenCalledWith('檔案過大（上限 512KB）', 'error', 3000);
  });

  it('字元數 > 512K 仍被拒絕，且不送出', async () => {
    pick(jsonOfChars(LIMIT + 1, 'a'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('檔案過大（上限 512KB）', 'error', 3000));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
