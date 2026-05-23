/**
 * useTrip docs batch endpoint 測試 — v2.33.35 simplify PR-8。
 *
 * 從原 PR-HH 2026-04-26「5 個 sequential calls + 404 silent-skip」
 * 改為「1 個 batch endpoint GET /trips/:id/docs 回 Record<DocKey, DocData|null>」。
 *
 * 驗證：
 * - 全部 null（新 trip 還沒建 docs）→ docs state 為空 + 不 toast
 * - 500 → toast severe（regression guard）
 * - 部分有資料部分 null → 有資料的 wire 到 state、null 不會誤覆蓋
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

const ALL_NULL_DOCS = {
  docs: {
    flights: null,
    checklist: null,
    backup: null,
    suggestions: null,
    emergency: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setupMocks(docsHandler: () => Promise<unknown>) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path.match(/^\/trips\/[^/]+$/)) return TRIP_FIXTURE;
    if (path.match(/\/days\?all=1$/)) {
      return [{ id: 1, dayNum: 1, date: '2026-07-01', dayOfWeek: '一', label: '出發', timeline: [] }];
    }
    if (path.match(/^\/trips\/[^/]+\/docs$/)) return docsHandler();
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe('useTrip — batch /docs endpoint（v2.33.35 PR-8）', () => {
  it('batch 回 all-null（新 trip）→ docs state 為空 + 完全不 toast', async () => {
    setupMocks(() => Promise.resolve(ALL_NULL_DOCS));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/trips\/trip-1\/docs$/),
        expect.anything(),
      );
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.docs.flights).toBeUndefined();
    expect(result.current.docs.checklist).toBeUndefined();
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('batch endpoint 500 → toast severe', async () => {
    setupMocks(() => Promise.reject(new ApiError('SYS_INTERNAL', 500)));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(mockShowErrorToast.mock.calls[0][1]).toBe('severe');
  });

  it('batch endpoint 404 DATA_NOT_FOUND（trip 不存在）→ 靜默', async () => {
    setupMocks(() => Promise.reject(new ApiError('DATA_NOT_FOUND', 404)));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await new Promise((r) => setTimeout(r, 0));

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('部分 null 部分有資料 → 有資料 wire 進 state、null key 不會佔位', async () => {
    setupMocks(() =>
      Promise.resolve({
        docs: {
          flights: null,
          checklist: { docType: 'checklist', title: 'Checklist', entries: [] },
          backup: null,
          suggestions: { docType: 'suggestions', title: 'Suggestions', entries: [] },
          emergency: null,
        },
      }),
    );

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

  it('batch endpoint 只 fire 一次（不再 5 個 sequential calls）', async () => {
    setupMocks(() => Promise.resolve(ALL_NULL_DOCS));

    const { result } = renderHook(() => useTrip('trip-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await new Promise((r) => setTimeout(r, 0));

    const docsCalls = mockApiFetch.mock.calls.filter((c) =>
      typeof c[0] === 'string' && /\/docs/.test(c[0]),
    );
    expect(docsCalls).toHaveLength(1);
    expect(docsCalls[0][0]).toMatch(/\/trips\/trip-1\/docs$/);
  });
});
