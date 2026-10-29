import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TripHealthCheckPage from '../../src/pages/TripHealthCheckPage';

const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
const authUser = vi.hoisted(() => ({ id: 'u1', email: 'owner@test' }));
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init) }));
vi.mock('../../src/hooks/useRequireAuth', () => ({ useRequireAuth: () => ({ user: authUser }) }));
vi.mock('../../src/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: authUser }) }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));

const oldFinding = { severity: 'high', title: '舊問題', description: '先前的建議', actionTarget: { day: 2 } };
const newFinding = { severity: 'low', title: '新問題', description: '本次的建議', actionTarget: { entryId: 42 } };
const report = (tripId: string, status: 'pending' | 'completed' | 'failed', requestId: number, findings = [oldFinding]) => ({
  tripId, userId: 'u1', status, requestId, findings, createdAt: '2026-09-26 01:00:00',
  completedAt: status === 'completed' ? '2026-09-26 01:05:00' : '2026-09-25 01:05:00',
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function Harness() {
  const location = useLocation();
  return <>
    <Link to="/trip/T2/health">切換行程</Link>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <Routes>
      <Route path="/trip/:tripId/health" element={<TripHealthCheckPage />} />
      <Route path="/trip/:tripId" element={<div>行程日期</div>} />
      <Route path="/trip/:tripId/stop/:entryId/edit" element={<div>編輯景點</div>} />
    </Routes>
  </>;
}
function renderPage() {
  return render(<MemoryRouter initialEntries={['/trip/T1/health']}><Harness /></MemoryRouter>);
}
function common(path: string) {
  if (path.endsWith('/days?all=1')) return Promise.resolve(response([{ timeline: [{ id: 1 }] }]));
  if (!path.endsWith('/health-check')) return Promise.resolve(response({ id: path.split('/')[2], title: '測試行程' }));
  return null;
}

beforeEach(() => {
  vi.useRealTimers();
  apiFetchRawMock.mockReset();
  window.scrollTo = vi.fn();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
});

describe('TripHealthCheckPage report recovery', () => {
  it('首次報告讀取失敗顯示未知與重試，恢復後 finding 可回到正確日期', async () => {
    let reads = 0;
    apiFetchRawMock.mockImplementation((path) => {
      const other = common(path);
      if (other) return other;
      reads++;
      return reads === 1 ? Promise.reject(new Error('offline'))
        : Promise.resolve(response({ report: report('T1', 'completed', 10) }));
    });
    renderPage();
    expect(await screen.findByTestId('ai-health-read-error')).toHaveTextContent('最新狀態未知');
    expect(screen.queryByText('尚未健檢過此行程')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-health-start-btn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重試讀取健檢狀態' }));
    expect(await screen.findByText('舊問題')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-health-read-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-health-group-high')).toHaveTextContent('高優先');
    fireEvent.click(screen.getByRole('button', { name: '前往 Day 2' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/T1?day=2');
  });

  it('連續讀取失敗不顯示空報告或允許重新生成', async () => {
    apiFetchRawMock.mockImplementation((path) => common(path) ?? Promise.reject(new Error('offline')));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '重試讀取健檢狀態' }));
    expect(await screen.findByTestId('ai-health-read-error')).toHaveTextContent('最新狀態未知');
    expect(screen.queryByTestId('ai-health-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-health-start-btn')).not.toBeInTheDocument();
  });

  it('輪詢失敗時保留舊 finding 並標示新鮮度，重試後顯示新報告與景點路由', async () => {
    vi.useFakeTimers();
    let reads = 0;
    apiFetchRawMock.mockImplementation((path) => {
      const other = common(path);
      if (other) return other;
      reads++;
      return reads === 1 ? Promise.resolve(response({ report: report('T1', 'pending', 11) }))
        : reads === 2 ? Promise.reject(new Error('offline'))
          : Promise.resolve(response({ report: report('T1', 'completed', 11, [newFinding]) }));
    });
    const view = renderPage();
    try {
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(screen.getByTestId('ai-health-read-error')).toHaveTextContent('最新狀態未知');
      expect(screen.getByText('舊問題')).toBeInTheDocument();
      expect(screen.getByTestId('ai-health-results')).toHaveTextContent('上次報告');
      fireEvent.click(screen.getByRole('button', { name: '重試讀取健檢狀態' }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByText('新問題')).toBeInTheDocument();
      expect(screen.queryByText('舊問題')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '前往景點' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/trip/T1/stop/42/edit');
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it('重跑時保留上一份報告，POST 等待中與狀態未知時都不重複提交', async () => {
    const post = deferred<Response>();
    apiFetchRawMock.mockImplementation((path, init) => {
      const other = common(path);
      if (other) return other;
      if (init?.method === 'POST') return post.promise;
      return Promise.resolve(response({ report: report('T1', 'completed', 10) }));
    });
    renderPage();
    expect(await screen.findByText('舊問題')).toBeInTheDocument();
    const button = screen.getByTestId('ai-health-start-btn');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(apiFetchRawMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(button).toBeDisabled();
    await act(async () => { post.resolve(response({ report: report('T1', 'pending', 11) }, 202)); });
    expect(screen.getByText('舊問題')).toBeInTheDocument();
    expect(screen.getByTestId('ai-health-results')).toHaveTextContent('上次報告');
  });

  it('提交結果未知時保留零問題的舊報告並暫停重送；403 保留報告且顯示權限原因', async () => {
    let posts = 0;
    apiFetchRawMock.mockImplementation((path, init) => {
      const other = common(path);
      if (other) return other;
      if (init?.method === 'POST') {
        posts++;
        return posts === 1 ? Promise.reject(new Error('connection lost'))
          : Promise.resolve(response({ error: { code: 'PERM_DENIED' } }, 403));
      }
      return Promise.resolve(response({ report: report('T1', 'completed', 10, []) }));
    });
    renderPage();
    expect(await screen.findByText('看起來沒有問題')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-health-start-btn'));
    expect(await screen.findByText('上次報告：沒有找到問題')).toBeInTheDocument();
    expect(screen.getByTestId('ai-health-start-btn')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '重試讀取健檢狀態' }));
    await waitFor(() => expect(screen.getByText('看起來沒有問題')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('ai-health-start-btn'));
    expect(await screen.findByText('沒有權限執行此行程的 AI 健檢')).toBeInTheDocument();
    expect(screen.getByText('看起來沒有問題')).toBeInTheDocument();
  });

  it('零問題的舊報告在重新健檢期間仍可辨識為上次結果', async () => {
    apiFetchRawMock.mockImplementation((path, init) => {
      const other = common(path);
      if (other) return other;
      return Promise.resolve(response({ report: report('T1', init?.method === 'POST' ? 'pending' : 'completed', init?.method === 'POST' ? 11 : 10, []) }, init?.method === 'POST' ? 202 : 200));
    });
    renderPage();
    expect(await screen.findByText('看起來沒有問題')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-health-start-btn'));
    expect(await screen.findByText('上次報告：沒有找到問題')).toBeInTheDocument();
    expect(screen.getByTestId('ai-health-loading')).toBeInTheDocument();
  });

  it('切換行程後忽略舊行程晚到的報告', async () => {
    const old = deferred<Response>();
    apiFetchRawMock.mockImplementation((path) => {
      const other = common(path);
      if (other) return other;
      return path.includes('/T1/') ? old.promise
        : Promise.resolve(response({ report: report('T2', 'completed', 20, [newFinding]) }));
    });
    renderPage();
    await waitFor(() => expect(apiFetchRawMock).toHaveBeenCalledWith('/trips/T1/health-check', expect.anything()));
    fireEvent.click(screen.getByRole('link', { name: '切換行程' }));
    expect(await screen.findByText('新問題')).toBeInTheDocument();
    await act(async () => { old.resolve(response({ report: report('T1', 'completed', 10) })); });
    expect(screen.getByText('新問題')).toBeInTheDocument();
    expect(screen.queryByText('舊問題')).not.toBeInTheDocument();
  });
});
