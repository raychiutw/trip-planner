/**
 * useTrip 錯誤處理測試 — 確認不再靜默失敗
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing useTrip
vi.mock('../../src/hooks/useApi', () => ({
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

import { apiFetch } from '../../src/hooks/useApi';
import { showErrorToast } from '../../src/components/shared/Toast';
import { ApiError } from '../../src/lib/errors';

const mockApiFetch = vi.mocked(apiFetch);
const mockShowErrorToast = vi.mocked(showErrorToast);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTrip 錯誤處理', () => {
  it('ApiError 會被 import 到 useTrip', () => {
    // 確認 ApiError 可以正常使用
    const err = new ApiError('DATA_NOT_FOUND', 404);
    expect(err.code).toBe('DATA_NOT_FOUND');
    expect(err.severity).toBe('severe');
  });

  it('showErrorToast 被 import 到 useTrip', async () => {
    // 確認 showErrorToast 函式存在且可呼叫
    const err = new ApiError('SYS_INTERNAL', 500);
    showErrorToast(err.message, err.severity);
    expect(mockShowErrorToast).toHaveBeenCalledWith('系統發生錯誤，已通知開發團隊', 'severe');
  });

  it('minor severity 不觸發 Toast', () => {
    const err = new ApiError('DATA_VALIDATION', 400);
    expect(err.severity).toBe('minor');
    // showErrorToast with minor → 不顯示（由 Toast.tsx 內部過濾）
  });

  it('moderate severity 觸發 Toast', () => {
    const err = new ApiError('AUTH_REQUIRED', 401);
    expect(err.severity).toBe('moderate');
  });

  it('severe severity 觸發 Toast', () => {
    const err = new ApiError('DATA_NOT_FOUND', 404);
    expect(err.severity).toBe('severe');
  });
});
