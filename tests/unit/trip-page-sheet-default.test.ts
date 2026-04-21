/**
 * TripPage — InfoSheet 初始狀態測試
 * 驗證 activeSheet state 預設為 null，mobile 進頁不會打開 sheet。
 * 使用 RTL mount + mock hooks（避免實際 API 呼叫）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

// --- Mock all heavy hooks / modules before importing TripPage ---
vi.mock('../../src/hooks/useTrip', () => ({
  useTrip: () => ({
    trip: null,
    days: [],
    currentDay: null,
    currentDayNum: null,
    switchDay: vi.fn(),
    refetchCurrentDay: vi.fn(),
    allDays: [],
    docs: {},
    loading: true,
    error: null,
  }),
}));
vi.mock('../../src/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, setIsDark: vi.fn(), colorMode: 'auto', setColorMode: vi.fn() }),
}));
vi.mock('../../src/hooks/usePrintMode', () => ({ usePrintMode: () => false }));
vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
  reportFetchResult: () => {},
}));
vi.mock('../../src/hooks/useOfflineToast', () => ({
  useOfflineToast: () => ({ showOffline: false, showReconnect: false }),
}));
vi.mock('../../src/hooks/useScrollRestoreOnBack', () => ({
  useScrollRestoreOnBack: () => {},
}));
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue([]),
}));
// Sentry
vi.mock('../../src/lib/sentry', () => ({ captureError: vi.fn() }));

import TripPage from '../../src/pages/TripPage';

function renderTripPage() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ['/trip/test-trip-id'] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/trip/:tripId', element: React.createElement(TripPage) })
      )
    )
  );
}

describe('TripPage — InfoSheet 初始關閉', () => {
  it('mount 時 InfoSheet dialog 不存在（activeSheet 初始值為 null）', () => {
    const { queryByRole } = renderTripPage();
    // InfoSheet uses role="dialog"; should not be open on initial render
    expect(queryByRole('dialog')).toBeNull();
  });

  it('InfoSheet open prop 是 !!activeSheet（null → false → sheet 關閉）', () => {
    const { queryByRole } = renderTripPage();
    // Same assertion from a different angle: no open dialog element
    const dialog = queryByRole('dialog', { hidden: true });
    // If dialog exists, it must not have the open attribute
    if (dialog) {
      expect(dialog.hasAttribute('open')).toBe(false);
    } else {
      // Preferred: dialog not rendered at all when activeSheet is null
      expect(dialog).toBeNull();
    }
  });
});
