/**
 * TripHealthCheckPage — 4 state 渲染 + polling + 觸發 + entry actions
 *
 * 對齊 mockup `/tmp/TripAIHealth-variants.html` Variant C sign-off + DESIGN.md
 * tp-ai-health-* spec：
 *  - empty → 「開始健檢」CTA
 *  - pending → loading view + polling
 *  - completed → severity-grouped findings + 「重新生成」
 *  - failed → error view + 「重新生成」
 *  - re-generating（pending + 舊 findings） → 舊 results dim + 「再重新生成」 disabled
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const apiFetchRawMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: (path: string, init?: RequestInit) => apiFetchRawMock(path, init),
}));

vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', email: 'ray@x.com', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '' },
    reload: () => {},
  }),
}));
vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({ default: () => null }));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import TripHealthCheckPage from '../../src/pages/TripHealthCheckPage';

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? status : status === 200 ? 500 : status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockSequence(responses: Response[]) {
  apiFetchRawMock.mockReset();
  let i = 0;
  apiFetchRawMock.mockImplementation(async (path: string) => {
    // Trip name request 永遠回 same trip
    if (path.startsWith('/trips/T1') && !path.includes('/health-check')) {
      return makeResponse({ id: 'T1', title: '2026 沖繩七日遊' });
    }
    // health-check responses 依序取
    const r = responses[i] || responses[responses.length - 1];
    if (responses[i]) i++;
    return r;
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/T1/health']}>
      <Routes>
        <Route path="/trip/:tripId/health" element={<TripHealthCheckPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TripHealthCheckPage', () => {
  it('empty state — 沒做過健檢顯示 CTA 「開始健檢」', async () => {
    mockSequence([makeResponse({ report: null })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-empty')).toBeTruthy();
    });
    expect(screen.getByText('尚未健檢過此行程')).toBeTruthy();
    const cta = screen.getByTestId('ai-health-start-btn');
    expect(cta.textContent).toContain('開始健檢');
  });

  it('completed state — render severity groups + counts + 重新生成', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'completed',
          requestId: 99,
          findings: [
            { severity: 'high', title: 'Day 3 行程過密', description: '8 個景點 110 km', actionTarget: { day: 3 } },
            { severity: 'medium', title: 'Day 2 缺午餐', description: '11:30-14:30 連續景點' },
            { severity: 'low', title: '可加美麗海水族館', description: '順路 5km' },
          ],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-results')).toBeTruthy();
    });
    expect(screen.getByTestId('ai-health-group-high')).toBeTruthy();
    expect(screen.getByTestId('ai-health-group-medium')).toBeTruthy();
    expect(screen.getByTestId('ai-health-group-low')).toBeTruthy();
    expect(screen.getByText('Day 3 行程過密')).toBeTruthy();
    const regen = screen.getByTestId('ai-health-start-btn');
    expect(regen.textContent).toContain('重新生成');
  });

  it('Phase 2: dimension chip + suggestion 顯示', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'completed',
          requestId: 99,
          findings: [
            {
              severity: 'high',
              dimension: 'timing',
              title: 'Check-in 衝突',
              description: '17:10 結束 → travel 45 min → 17:30 check-in 物理上不可行',
              suggestion: '把末站換成更近的景點',
              actionTarget: { day: 2, entryId: 42 },
            },
            {
              severity: 'medium',
              dimension: 'meals',
              title: '缺午餐',
              description: '11:30–14:30 連續景點',
            },
          ],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-results')).toBeTruthy();
    });
    expect(screen.getByTestId('ai-health-finding-dimension-high-0').textContent).toBe('時間');
    expect(screen.getByTestId('ai-health-finding-dimension-medium-0').textContent).toBe('餐飲');
    expect(screen.getByTestId('ai-health-finding-suggestion-high-0')).toBeTruthy();
    expect(screen.getByText('把末站換成更近的景點')).toBeTruthy();
    expect(screen.queryByTestId('ai-health-finding-suggestion-medium-0')).toBeNull();
  });

  it('Phase 2: action_target.entry_id → 「前往景點」優先於 day-only button', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'completed',
          requestId: 99,
          findings: [
            {
              severity: 'high',
              title: 'Entry-level issue',
              description: 'X',
              actionTarget: { day: 2, entryId: 42 },
            },
          ],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-results')).toBeTruthy();
    });
    const entryBtn = screen.getByTestId('ai-health-finding-goto-entry-high-0');
    expect(entryBtn.textContent).toBe('前往景點');
    expect(screen.queryByText('前往 Day 2')).toBeNull();
    fireEvent.click(entryBtn);
    expect(navigateMock).toHaveBeenCalledWith('/trip/T1/stop/42/edit');
  });

  it('high finding 含 action_target.day → 顯示「前往 Day N」按鈕並導航', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'completed',
          requestId: 99,
          findings: [
            { severity: 'high', title: 'X', description: 'd', actionTarget: { day: 3 } },
          ],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-results')).toBeTruthy();
    });
    const dayBtn = screen.getByText('前往 Day 3');
    fireEvent.click(dayBtn);
    expect(navigateMock).toHaveBeenCalledWith('/trip/T1?day=3');
  });

  it('failed state — 顯示錯誤訊息 + 「重新生成」可重試', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'failed',
          requestId: 99,
          findings: [],
          errorMessage: 'AI 服務暫時無法回應',
          createdAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-failed')).toBeTruthy();
    });
    expect(screen.getByText('AI 服務暫時無法回應')).toBeTruthy();
  });

  it('pending state（無舊結果）— loading view 顯示', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'pending',
          requestId: 100,
          findings: [],
          createdAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-loading')).toBeTruthy();
    });
    const btn = screen.getByTestId('ai-health-start-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('健檢進行中');
  });

  it('re-generating state — pending + 舊 findings → 顯示「再重新生成」 disabled', async () => {
    mockSequence([
      makeResponse({
        report: {
          tripId: 'T1',
          userId: 'ray@x.com',
          status: 'pending',
          requestId: 200,
          findings: [
            { severity: 'high', title: '舊結果 A', description: '保留' },
          ],
          createdAt: new Date().toISOString(),
        },
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-regenerating')).toBeTruthy();
    });
    // 舊結果仍可看 (dim)
    expect(screen.getByText('舊結果 A')).toBeTruthy();
    const btn = screen.getByTestId('ai-health-start-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('再重新生成');
  });

  it('「開始健檢」按下後送 POST /trips/:id/health-check', async () => {
    apiFetchRawMock.mockReset();
    apiFetchRawMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/trips/T1') && !path.includes('/health-check')) {
        return makeResponse({ id: 'T1', title: '2026 沖繩七日遊' });
      }
      if (init?.method === 'POST') {
        return makeResponse({
          report: {
            tripId: 'T1',
            userId: 'ray@x.com',
            status: 'pending',
            requestId: 300,
            findings: [],
            createdAt: new Date().toISOString(),
          },
        }, true, 202);
      }
      return makeResponse({ report: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('ai-health-empty')).toBeTruthy();
    });
    const cta = screen.getByTestId('ai-health-start-btn');
    fireEvent.click(cta);

    await waitFor(() => {
      const postCalls = apiFetchRawMock.mock.calls.filter(
        (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });
    const postCalls = apiFetchRawMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCalls[0][0]).toBe('/trips/T1/health-check');
  });
});
