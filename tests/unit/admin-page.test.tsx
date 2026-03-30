import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../../src/pages/AdminPage';

vi.mock('../../src/hooks/useDarkMode', () => ({ useDarkMode: () => {} }));
vi.mock('../../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true, reportFetchResult: () => {} }));
vi.mock('../../src/hooks/useOfflineToast', () => ({
  useOfflineToast: () => ({ showOffline: false, showReconnect: false }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_TRIPS = [
  { tripId: 'trip-1', name: '沖繩自駕', published: 1 },
  { tripId: 'trip-2', name: '釜山旅行', published: 0 },
];

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true, status: 200, json: async () => MOCK_TRIPS,
  });
});

describe('AdminPage', () => {
  it('renders page title', () => {
    const { getByText } = renderAdmin();
    expect(getByText('權限管理')).toBeTruthy();
  });

  it('has close button with aria-label', () => {
    const { container } = renderAdmin();
    expect(container.querySelector('[aria-label="關閉"]')).toBeTruthy();
  });

  it('has trip select with aria-label', () => {
    const { container } = renderAdmin();
    expect(container.querySelector('[aria-label="選擇行程"]')).toBeTruthy();
  });

  it('loads and displays trip options', async () => {
    const { getByText } = renderAdmin();
    await waitFor(() => expect(getByText('沖繩自駕')).toBeTruthy());
    expect(getByText('(已下架) 釜山旅行')).toBeTruthy();
  });

  it('shows empty state before trip selection', () => {
    const { getByText } = renderAdmin();
    expect(getByText('請先選擇行程')).toBeTruthy();
  });

  it('has email input and add button', () => {
    const { getByPlaceholderText, getByText } = renderAdmin();
    expect(getByPlaceholderText('email@example.com')).toBeTruthy();
    expect(getByText('新增')).toBeTruthy();
  });

  it('has three section titles', () => {
    const { getByText } = renderAdmin();
    expect(getByText('選擇行程')).toBeTruthy();
    expect(getByText('已授權成員')).toBeTruthy();
    expect(getByText('新增成員')).toBeTruthy();
  });

  it('has ToastContainer for status feedback', () => {
    const { container } = renderAdmin();
    // ToastContainer renders a fixed div; Toast bubbles use aria-live="polite"
    expect(container.querySelector('.fixed')).toBeTruthy();
  });

  it('uses zero legacy CSS class names', () => {
    const { container } = renderAdmin();
    const html = container.innerHTML;
    expect(html).not.toContain('class="admin-');
    expect(html).not.toContain('class="page-layout"');
    expect(html).not.toContain('class="sticky-nav"');
    expect(html).not.toContain('class="nav-title"');
    expect(html).not.toContain('class="container"');
  });

  it('uses Tailwind inline classes', () => {
    const { container } = renderAdmin();
    const html = container.innerHTML;
    // Verify Tailwind utility classes are present
    expect(html).toContain('flex');
    expect(html).toContain('rounded');
  });
});
