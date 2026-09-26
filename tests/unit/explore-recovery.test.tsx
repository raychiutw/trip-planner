import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init) }));
vi.mock('../../src/components/shared/Toast', () => ({ default: () => null, showToast: vi.fn() }));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

import ExplorePage from '../../src/pages/ExplorePage';
import { showToast } from '../../src/components/shared/Toast';

const poi = (place_id: string) => ({ place_id, name: place_id, address: 'addr', lat: 1, lng: 2, category: 'cafe' });

let observe: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(showToast).mockClear();
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((path) => path === '/poi-favorites' ? Promise.resolve([]) : Promise.resolve({ results: [] }));
  class Observer {
    constructor(callback: typeof observe) { observe = callback; }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', Observer);
});

async function open() {
  const page = render(<MemoryRouter><ExplorePage /></MemoryRouter>);
  await waitFor(() => expect((screen.getByTestId('explore-search-submit') as HTMLButtonElement).disabled).toBe(false));
  return page;
}

function search(q: string) {
  fireEvent.change(screen.getByTestId('explore-search-input'), { target: { value: q } });
  fireEvent.click(screen.getByTestId('explore-search-submit'));
}

describe('Explore search recovery', () => {
  it('keeps the visible query results when a new search fails', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')] });
      if (path.includes('q=second')) return Promise.reject(new Error('offline'));
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    search('second');
    await waitFor(() => expect(screen.getByTestId('explore-search-submit').textContent).toBe('搜尋'));
    expect(screen.getByText('first')).toBeTruthy();
    expect((screen.getByTestId('explore-search-input') as HTMLInputElement).value).toBe('second');
  });

  it('distinguishes failed first search from a successful empty result', async () => {
    apiFetchMock.mockImplementation((path) => path === '/poi-favorites' ? Promise.resolve([])
      : Promise.reject(new Error('offline')));
    await open();
    expect(screen.getByText('搜尋暫時失敗')).toBeTruthy();
    expect(screen.queryByText('試試這些')).toBeNull();
  });

  it('keeps prior pages after load-more failure and retries the same cursor on request', async () => {
    let pageCalls = 0;
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path.includes('pageToken=next')) {
        pageCalls++;
        return pageCalls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ results: [poi('second')] });
      }
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')], nextPageToken: 'next' });
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    await act(async () => { observe?.([{ isIntersecting: true }]); });
    const retry = await screen.findByRole('button', { name: /重試載入更多/ });
    expect(screen.getByText('first')).toBeTruthy();
    expect(pageCalls).toBe(1);
    fireEvent.click(retry);
    await screen.findByText('second');
    expect(pageCalls).toBe(2);
    expect(screen.getAllByText('first')).toHaveLength(1);
  });

  it('does not mix a late page from another search into current results', async () => {
    let finishPage!: (value: unknown) => void;
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path.includes('pageToken=next')) return new Promise((resolve) => { finishPage = resolve; });
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')], nextPageToken: 'next' });
      if (path.includes('q=second')) return Promise.resolve({ results: [poi('second')] });
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    await act(async () => { observe?.([{ isIntersecting: true }]); });
    await waitFor(() => expect(finishPage).toBeTypeOf('function'));
    search('second');
    await screen.findByText('second');
    await act(async () => { finishPage({ results: [poi('stale')] }); });
    await waitFor(() => expect(screen.queryByText('stale')).toBeNull());
    expect(screen.queryByText('first')).toBeNull();
  });

  it('paginates the displayed search even after the input is edited and deduplicates overlapping places', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path.includes('pageToken=next')) return Promise.resolve({ results: [poi('first'), poi('second')] });
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')], nextPageToken: 'next' });
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    fireEvent.change(screen.getByTestId('explore-search-input'), { target: { value: 'unsent' } });
    await act(async () => { observe?.([{ isIntersecting: true }]); });
    await screen.findByText('second');
    expect(apiFetchMock.mock.calls.map((c) => c[0])).toContain('/poi-search?q=first&limit=20&pageToken=next');
    expect(screen.getAllByText('first')).toHaveLength(1);
  });

  it('restores read results and query when returning from add-to-trip', async () => {
    apiFetchMock.mockImplementation((path) => {
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')], nextPageToken: 'next' });
      return Promise.resolve({ results: [] });
    });
    const page = await open();
    search('first');
    await screen.findByText('first');
    fireEvent.click(screen.getByTestId('explore-cat-咖啡廳'));
    fireEvent.click(screen.getByTestId('explore-region-pill'));
    fireEvent.click(screen.getByTestId('explore-region-option-東京'));
    fireEvent.click(screen.getByTestId('explore-add-to-trip-btn-first'));
    // A return to /explore mounts the page again after the add-to-trip flow.
    page.unmount();
    await open();
    expect((screen.getByTestId('explore-search-input') as HTMLInputElement).value).toBe('first');
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByTestId('explore-load-more')).toBeTruthy();
    expect(screen.getByTestId('explore-region-pill').textContent).toContain('東京');
    expect(screen.getByTestId('explore-cat-咖啡廳').getAttribute('aria-pressed')).toBe('true');
  });

  it('confirms a saved favorite without another list read or losing search results', async () => {
    let favoriteReads = 0;
    apiFetchMock.mockImplementation((path, init) => {
      if (path === '/poi-favorites') {
        if (init?.method === 'POST') return Promise.resolve({ id: 71 });
        favoriteReads++;
        return favoriteReads > 1 ? Promise.reject(new Error('offline')) : Promise.resolve([]);
      }
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')] });
      if (path === '/pois/find-or-create') return Promise.resolve({ id: 41 });
      return Promise.resolve({ id: 71 });
    });
    await open();
    search('first');
    await screen.findByText('first');
    fireEvent.click(screen.getByTestId('explore-save-btn-first'));
    await waitFor(() => expect(screen.getByTestId('explore-save-btn-first').getAttribute('aria-label')).toContain('已收藏'));
    expect(screen.getByText('first')).toBeTruthy();
    expect(showToast).toHaveBeenCalledWith('已加入收藏「first」', 'success', 2000);
    expect(favoriteReads).toBe(1);
  });

  it('does not let an older favorite-list response undo a confirmed save', async () => {
    let finishList!: (rows: unknown[]) => void;
    apiFetchMock.mockImplementation((path, init) => {
      if (path === '/poi-favorites' && init?.method === 'POST') return Promise.resolve({ id: 71 });
      if (path === '/poi-favorites') return new Promise((resolve) => { finishList = resolve; });
      if (path === '/pois/find-or-create') return Promise.resolve({ id: 41 });
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')] });
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    fireEvent.click(screen.getByTestId('explore-save-btn-first'));
    await waitFor(() => expect(screen.getByTestId('explore-save-btn-first').getAttribute('aria-label')).toContain('已收藏'));
    await act(async () => { finishList([]); });
    expect(screen.getByTestId('explore-save-btn-first').getAttribute('aria-label')).toContain('已收藏');
  });

  it('keeps the place visible and offers another save attempt after favorite failure', async () => {
    apiFetchMock.mockImplementation((path, init) => {
      if (path === '/poi-favorites' && init?.method === 'POST') return Promise.reject(new Error('offline'));
      if (path === '/poi-favorites') return Promise.resolve([]);
      if (path === '/pois/find-or-create') return Promise.resolve({ id: 41 });
      if (path.includes('q=first')) return Promise.resolve({ results: [poi('first')] });
      return Promise.resolve({ results: [] });
    });
    await open();
    search('first');
    await screen.findByText('first');
    fireEvent.click(screen.getByTestId('explore-save-btn-first'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('加入收藏失敗：offline', 'error', 3000));
    expect(screen.getByText('first')).toBeTruthy();
    expect((screen.getByTestId('explore-save-btn-first') as HTMLButtonElement).disabled).toBe(false);
  });

  it('uses native buttons for region and category filters and returns focus after choosing a region', async () => {
    apiFetchMock.mockImplementation((path) => path === '/poi-favorites' ? Promise.resolve([])
      : Promise.resolve({ results: [poi('first')] }));
    await open();
    search('first');
    await screen.findByText('first');
    const region = screen.getByTestId('explore-region-pill');
    region.focus();
    fireEvent.click(region);
    const option = screen.getByTestId('explore-region-option-東京');
    expect(option.tagName).toBe('BUTTON');
    expect(option.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(option);
    expect(document.activeElement).toBe(region);
    expect(region.textContent).toContain('東京');
    const category = screen.getByTestId('explore-cat-咖啡廳');
    expect(category.tagName).toBe('BUTTON');
    fireEvent.click(category);
    expect(category.getAttribute('aria-pressed')).toBe('true');
  });
});
