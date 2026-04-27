/**
 * ExplorePage smoke tests — B-P4 search + saved pool.
 *
 * Mock fetch + apiFetch to avoid network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

vi.mock('../../src/components/shared/Toast', () => ({
  default: () => null,
  showToast: vi.fn(),
}));

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'u@x.com', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import ExplorePage from '../../src/pages/ExplorePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>,
  );
}

describe('ExplorePage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/saved-pois') return Promise.resolve([]);
      return Promise.resolve({});
    });
    global.fetch = vi.fn();
  });

  it('renders search input + empty saved pool when switching to 儲存池 tab', async () => {
    const { getByTestId, findByText } = renderPage();
    expect(getByTestId('explore-page')).toBeTruthy();
    expect(getByTestId('explore-search-input')).toBeTruthy();
    fireEvent.click(getByTestId('explore-tab-saved'));
    expect(await findByText(/還沒有儲存任何 POI/)).toBeTruthy();
  });

  it('shows error toast when search query < 2 chars', () => {
    const { getByTestId } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    // showToast is mocked — assertion via no network call
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls /api/poi-search on valid submit + renders results', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { osm_id: 1, name: '沖繩水族館', address: 'Japan', lat: 26.6941, lng: 127.8778, category: 'tourism' },
        ],
      }),
    });
    const { getByTestId, findByText } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '沖繩' } });
    fireEvent.click(getByTestId('explore-search-submit'));
    expect(await findByText('沖繩水族館')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/poi-search?q='));
  });

  it('save button triggers find-or-create + saved-pois POST', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [{ osm_id: 99, name: 'Test POI', address: 'Addr', lat: 25, lng: 121, category: 'food' }],
      }),
    });
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/saved-pois') return Promise.resolve([]);
      if (path === '/pois/find-or-create') return Promise.resolve({ id: 42 });
      return Promise.resolve({});
    });

    const { getByTestId, findByTestId } = renderPage();
    const input = getByTestId('explore-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(getByTestId('explore-search-submit'));

    const saveBtn = await findByTestId('explore-save-btn-99');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/pois/find-or-create',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/saved-pois',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
