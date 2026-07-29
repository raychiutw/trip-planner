import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import NoteAiExclusionsDialog from '../../src/components/trip-notes/NoteAiExclusionsDialog';
import TripNotesPage from '../../src/pages/TripNotesPage';

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));
vi.mock('../../src/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ ready: true }),
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ email: 'owner@test' }),
}));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({ default: () => null }));

const NOTES = {
  flights: [],
  lodgings: [{
    id: 1,
    sortOrder: 0,
    name: 'Naha Hotel',
    address: '',
    checkInAt: '',
    checkOutAt: '',
    bookingNo: '',
    phone: '',
    note: '',
    version: 0,
  }],
  reservations: [],
  pretripNotes: [],
  emergencyContacts: [],
};

const JOBS = [
  {
    docType: 'lodging-tips',
    status: 'idle',
    jobId: null,
    requestId: null,
    generation: 0,
    exclusionCount: 1,
  },
  {
    docType: 'tips',
    status: 'processing',
    jobId: 11,
    requestId: 21,
    generation: 2,
    createdAt: '2026-07-28 03:00:00',
    startedAt: '2026-07-28 03:01:00',
    exclusionCount: 1,
  },
  {
    docType: 'emergency',
    status: 'completed',
    jobId: 12,
    requestId: 22,
    generation: 1,
    insertedCount: 3,
    replacedCount: 2,
    preservedManualCount: 1,
    duplicateExcludedCount: 1,
    suppressedCount: 0,
    exclusionCount: 2,
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/trip-1/notes']}>
      <Routes>
        <Route path="/trip/:tripId/notes" element={<TripNotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  window.scrollTo = vi.fn();
});

describe('TripNotesPage AI state', () => {
  it('reload 後恢復三種 job；只停用同 docType，顯示完成摘要與各 section 排除數', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path.endsWith('/notes/ai-state')) return Promise.resolve({ jobs: JOBS });
      if (path.endsWith('/notes')) return Promise.resolve(NOTES);
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('trip-notes-section-head-pretrip'));
    fireEvent.click(screen.getByTestId('trip-notes-section-head-emergency'));

    await waitFor(() => {
      expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeDisabled();
    });
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeEnabled();
    expect(screen.getByTestId('trip-notes-ai-btn-emergency')).toBeEnabled();
    // 2026-07-29：原本鎖「通常 3–7 分鐘」，但 prod 實測 completed 的 job 有
    // 12 / 26 / 101 分鐘 —— 那句文案會讓使用者以為卡住而重按（重按會建新一代）。
    // 現在鎖住「有講區間」+「不再宣稱 3–7 分鐘」。
    expect(screen.getByTestId('trip-notes-ai-status-tips')).toHaveTextContent('通常 2–15 分鐘');
    expect(screen.getByTestId('trip-notes-ai-status-tips')).not.toHaveTextContent('3–7 分鐘');
    expect(screen.getByTestId('trip-notes-ai-status-tips')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('trip-notes-ai-status-emergency')).toHaveTextContent(
      '新增 3、替換 2、保留人工 1、排除 1、略過 0',
    );
    expect(screen.getByTestId('trip-notes-exclusions-pretrip')).toHaveTextContent('已排除 2 項');
    expect(screen.getByTestId('trip-notes-exclusions-emergency')).toHaveTextContent('已排除 2 項');
  });

  it('逾時後保留重新生成入口，點擊只重啟該 docType', async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/notes/ai-state')) {
        return Promise.resolve({
          jobs: JOBS.map((job) => job.docType === 'tips'
            ? { ...job, status: 'timedOut', errorMessage: '逾時' }
            : { ...job, status: 'idle' }),
        });
      }
      if (path.endsWith('/notes')) return Promise.resolve(NOTES);
      if (path.endsWith('/notes/tips/generate') && init?.method === 'POST') {
        return Promise.resolve({
          jobId: 31,
          requestId: 41,
          status: 'pending',
          generation: 3,
          timeoutAt: '2026-07-28 04:10:00',
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('trip-notes-section-head-pretrip'));
    const button = screen.getByTestId('trip-notes-ai-btn-pretrip');
    expect(button).toBeEnabled();
    expect(screen.getByTestId('trip-notes-ai-status-tips')).toHaveTextContent('可按重新生成重試');
    fireEvent.click(button);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      '/trips/trip-1/notes/tips/generate',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip-lodging')).toBeEnabled();
  });

  it('切換行程後忽略前一行程延遲回來的 ai-state', async () => {
    const tripA = deferred<{ jobs: typeof JOBS }>();
    const tripB = deferred<{ jobs: typeof JOBS }>();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/trips/trip-a/notes/ai-state') return tripA.promise;
      if (path === '/trips/trip-b/notes/ai-state') return tripB.promise;
      if (path.endsWith('/notes')) return Promise.resolve(NOTES);
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/trip/trip-b/notes')}>切換行程</button>
          <Routes>
            <Route path="/trip/:tripId/notes" element={<TripNotesPage />} />
          </Routes>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={['/trip/trip-a/notes']}>
        <Harness />
      </MemoryRouter>,
    );
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      '/trips/trip-a/notes/ai-state',
      undefined,
    ));
    fireEvent.click(screen.getByRole('button', { name: '切換行程' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      '/trips/trip-b/notes/ai-state',
      undefined,
    ));

    await act(async () => {
      tripB.resolve({
        jobs: JOBS.map((job) => job.docType === 'tips'
          ? { ...job, status: 'processing', jobId: 99 }
          : { ...job, status: 'idle' }),
      });
    });
    fireEvent.click(await screen.findByTestId('trip-notes-section-head-pretrip'));
    await waitFor(() => expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeDisabled());

    await act(async () => {
      tripA.resolve({
        jobs: JOBS.map((job) => ({ ...job, status: 'idle', jobId: null })),
      });
    });
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeDisabled();
  });

  it('active job 的慢 polling 不會被下一個 interval 永久作廢', async () => {
    vi.useFakeTimers();
    const slowPoll = deferred<{ jobs: typeof JOBS }>();
    let stateCalls = 0;
    apiFetchMock.mockImplementation((path: string) => {
      if (path.endsWith('/notes/ai-state')) {
        stateCalls++;
        return stateCalls === 1 ? Promise.resolve({ jobs: JOBS }) : slowPoll.promise;
      }
      if (path.endsWith('/notes')) return Promise.resolve(NOTES);
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const view = renderPage();
    try {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(stateCalls).toBe(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(stateCalls).toBe(2);
      await act(async () => {
        slowPoll.resolve({ jobs: JOBS });
      });
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it('切換行程後忽略前一行程延遲完成的生成 POST', async () => {
    const generateA = deferred<{
      jobId: number;
      requestId: number;
      status: 'pending';
      generation: number;
      timeoutAt: string;
    }>();
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/notes/ai-state')) {
        return Promise.resolve({
          jobs: JOBS.map((job) => ({ ...job, status: 'idle', jobId: null })),
        });
      }
      if (path.endsWith('/notes')) return Promise.resolve(NOTES);
      if (path === '/trips/trip-a/notes/tips/generate' && init?.method === 'POST') {
        return generateA.promise;
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/trip/trip-b/notes')}>切換行程</button>
          <Routes>
            <Route path="/trip/:tripId/notes" element={<TripNotesPage />} />
          </Routes>
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={['/trip/trip-a/notes']}>
        <Harness />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTestId('trip-notes-section-head-pretrip'));
    fireEvent.click(screen.getByTestId('trip-notes-ai-btn-pretrip'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      '/trips/trip-a/notes/tips/generate',
      expect.objectContaining({ method: 'POST' }),
    ));

    fireEvent.click(screen.getByRole('button', { name: '切換行程' }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      '/trips/trip-b/notes/ai-state',
      undefined,
    ));
    expect(await screen.findByTestId('trip-notes-ai-btn-pretrip')).toBeEnabled();

    await act(async () => {
      generateA.resolve({
        jobId: 101,
        requestId: 201,
        status: 'pending',
        generation: 2,
        timeoutAt: '2026-07-28 05:10:00',
      });
    });
    expect(screen.getByTestId('trip-notes-ai-btn-pretrip')).toBeEnabled();
  });
});

describe('NoteAiExclusionsDialog', () => {
  it('可鍵盤關閉、列出刪除時間並單筆恢復；關閉後焦點回入口', async () => {
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve({ ok: true });
      if (path.endsWith('/tips/exclusions')) {
        return Promise.resolve({
          items: [{
            id: 7,
            docType: 'tips',
            semanticKey: 'tips:currency',
            label: '貨幣',
            deletedAt: '2026-07-28 03:00:00',
          }],
        });
      }
      if (path.endsWith('/lodging-tips/exclusions')) return Promise.resolve({ items: [] });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const onClose = vi.fn();
    const onRestored = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>已排除 1 項</button>
          <NoteAiExclusionsDialog
            open={open}
            tripId="trip-1"
            docTypes={['tips', 'lodging-tips']}
            title="已排除的行前須知"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            onRestored={onRestored}
          />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '已排除 1 項' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: '已排除的行前須知' })).toBeInTheDocument();
    expect(await screen.findByText('貨幣')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '恢復「貨幣」' }));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(screen.queryByText('貨幣')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
