/**
 * #1561 — AddStopPage 自訂 tab：停留時間錯誤要與欄位程式化關聯（aria-invalid／aria-describedby）。
 * 標題空白與未選位置無法由 UI 觸發（完成鈕停用）或屬於地圖而非輸入欄，故不在此斷言。
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.startsWith('/trips/')) return { destinations: [] };
    if (path === '/poi-favorites') return [];
    return [];
  }),
  apiFetchRaw: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 1 }), text: async () => '' }) as Response),
}));
vi.mock('../../src/components/trip/LocationPickerMap', () => ({
  LocationPickerMap: ({ onCoordChange }: { onCoordChange: (c: { lat: number; lng: number }) => void }) => (
    <button type="button" data-testid="mock-pick-coord" onClick={() => onCoordChange({ lat: 35.1, lng: 139.1 })}>pick</button>
  ),
}));
vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', email: 'u@x.com' }, reload: () => {} }),
}));
vi.mock('../../src/hooks/usePoiSearch', () => ({
  usePoiSearch: () => ({ state: { status: 'idle', results: [], error: null }, retry: vi.fn() }),
}));

import AddStopPage from '../../src/pages/AddStopPage';

describe('AddStopPage 自訂 tab 停留時間錯誤關聯', () => {
  it('錯誤時標為無效並指向有文字的 alert；改動後移除', async () => {
    render(
      <MemoryRouter initialEntries={['/trip/t1/add-stop?day=1&tab=custom']}>
        <Routes><Route path="/trip/:tripId/add-stop" element={<AddStopPage />} /></Routes>
      </MemoryRouter>,
    );
    const duration = await screen.findByTestId('add-stop-custom-duration');
    expect(duration.hasAttribute('aria-invalid')).toBe(false);
    expect(duration.hasAttribute('aria-describedby')).toBe(false);
    fireEvent.change(screen.getByTestId('add-stop-custom-title'), { target: { value: '朋友家' } });
    fireEvent.click(screen.getByTestId('mock-pick-coord'));
    fireEvent.change(duration, { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('add-stop-confirm'));
    await waitFor(() => expect(duration.getAttribute('aria-invalid')).toBe('true'));
    const target = document.getElementById(duration.getAttribute('aria-describedby')!);
    expect(target?.textContent).toContain('停留時間請輸入正整數分鐘');
    expect(target?.getAttribute('role')).toBe('alert');
    fireEvent.change(duration, { target: { value: '30' } });
    expect(duration.hasAttribute('aria-invalid')).toBe(false);
    expect(duration.hasAttribute('aria-describedby')).toBe(false);
  });
});
