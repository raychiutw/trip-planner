/**
 * useTrip docs 404 silent-skip 測試 — PR-HH 2026-04-26
 *
 * Bug：開新行程時 docs（flights/checklist/backup/emergency/suggestions）尚未建立，
 * GET /api/trips/:id/docs/:key 統一回 404 → ApiError code=DATA_NOT_FOUND
 * severity='severe' → showErrorToast 觸發，5 個 docs 噴 5 個 toast。
 *
 * 修：fetchAllDocs 對 404 視為「該 doc 尚未建立」靜默略過，不再 toast。
 * 其他 severe 錯誤（500、網路）仍正常顯示。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('../../src/components/shared/Toast', () => ({
  showErrorToast: vi.fn(),
  showToast: vi.fn(),
  default: () => null,
}));
vi.mock('../../src/lib/mapRow', () => ({
  mapRow: (x: unknown) => x,
}));

import { useTrip } from '../../src/hooks/useTrip';
import { apiFetch } from '../../src/lib/apiClient';
import { showErrorToast } from '../../src/components/shared/Toast';
import { ApiError } from '../../src/lib/errors';

const mockApiFetch = vi.mocked(apiFetch);
const mockShowErrorToast = vi.mocked(showErrorToast);

const TRIP_FIXTURE = {
  id: 'trip-1',
  name: 'Test Trip',
  description: '',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  owner: 'user@example.com',
  cover: null,
  countryCode: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setupMocks(docHandler: (key: string) => Promise<unknown>) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path.match(/^\/trips\/[^/]+$/)) return TRIP_FIXTURE;
    if (path.match(/\/days\?all=1$/)) {
      return [{ id: 1, dayNum: 1, date: '2026-07-01', dayOfWeek: '一', label: '出發', timeline: [] }];
    }
    const docMatch = path.match(/\/docs\/([^/]+)$/);
    if (docMatch) return docHandler(docMatch[1]);
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('useTrip — docs 404 處理（PR-HH）', () => {
  it('5 個 docs 全部 404 → showErrorToast 完全不被呼叫', async () => {
    setupMocks(() => Promise.reject(new ApiError('DATA_NOT_FOUND', 404)));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // 給 fetchAllDocs 的 Promise.allSettled 完成時間
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/docs\/suggestions$/),
        expect.anything(),
      );
    });
    // 等微任務 flush
    await new Promise((r) => setTimeout(r, 0));

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('docs 500 仍會 toast（regression guard：別把所有 docs 錯誤都吃掉）', async () => {
    setupMocks(() => Promise.reject(new ApiError('SYS_INTERNAL', 500)));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    // 確認被當 severe 處理
    expect(mockShowErrorToast.mock.calls[0][1]).toBe('severe');
  });

  it('docs 部分 200、部分 404 → 200 寫入 state，404 完全靜默', async () => {
    const NOT_FOUND_KEYS = new Set(['flights', 'backup', 'emergency']);
    setupMocks((key) => {
      if (NOT_FOUND_KEYS.has(key)) {
        return Promise.reject(new ApiError('DATA_NOT_FOUND', 404));
      }
      return Promise.resolve({ docType: key, title: `${key} doc`, entries: [] });
    });

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => {
      expect(result.current.docs.checklist).toBeDefined();
      expect(result.current.docs.suggestions).toBeDefined();
    });

    expect(result.current.docs.flights).toBeUndefined();
    expect(result.current.docs.backup).toBeUndefined();
    expect(result.current.docs.emergency).toBeUndefined();
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });
});
