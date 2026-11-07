/**
 * #1440：匯出時 segments／notes 讀取失敗，只有 404 可視為「沒有資料」；
 * 網路錯誤、5xx 要讓整個匯出失敗（呼叫端會 toast），不能靜默寫成空的。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/errors';

const apiFetch = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { downloadTripJson } from '../../src/lib/tripExport';

let blobs: string[];
beforeEach(() => {
  blobs = [];
  apiFetch.mockReset();
  vi.stubGlobal('document', { createElement: () => ({ click() {} }) });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blobs.push(String((b as Blob).size)); return 'blob:x'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function route(over: { segments?: () => unknown; notes?: () => unknown }) {
  apiFetch.mockImplementation(async (path: string) => {
    if (path.endsWith('/days?all=1')) return [];
    if (path.endsWith('/segments')) return (over.segments ?? (() => []))();
    if (path.endsWith('/notes')) return (over.notes ?? (() => ({})))();
    return { id: 't1', name: 'T' };
  });
}
const fail = (status: number) => () => { throw new ApiError('SYS_UPSTREAM_UNAVAILABLE', status); };

describe('downloadTripJson — segments/notes 讀取失敗', () => {
  it('segments 5xx → 匯出 reject，不產生檔案', async () => {
    route({ segments: fail(503) });
    await expect(downloadTripJson({ tripId: 't1', trip: null })).rejects.toBeTruthy();
    expect(blobs).toHaveLength(0);
  });

  it('notes 5xx → 匯出 reject', async () => {
    route({ notes: fail(500) });
    await expect(downloadTripJson({ tripId: 't1', trip: null })).rejects.toBeTruthy();
    expect(blobs).toHaveLength(0);
  });

  it('segments 網路錯誤 → 匯出 reject', async () => {
    route({ segments: () => { throw new TypeError('Failed to fetch'); } });
    await expect(downloadTripJson({ tripId: 't1', trip: null })).rejects.toBeTruthy();
  });

  it('segments／notes 404 → 視為沒有資料，仍可匯出', async () => {
    route({ segments: fail(404), notes: fail(404) });
    await downloadTripJson({ tripId: 't1', trip: null });
    expect(blobs).toHaveLength(1);
  });
});
