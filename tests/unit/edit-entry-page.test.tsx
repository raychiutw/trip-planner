/**
 * EditEntryPage — v2.26.0 fullpage entry edit (起訖時間 + 從上一站移動方式 + 備註)
 *
 * Mockup: docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html
 *
 * 驗：
 *   - Initial render：時間 input / mode segmented / 備註 textarea 都呈現 entry 既有值
 *   - 時間驗證：start_time >= end_time / 格式錯誤 → validation error 顯示 + 儲存 disabled
 *   - Dirty-check：未變更 → 儲存 disabled；改任一 field → 啟用
 *   - 儲存：dirty.entry → PATCH entries / dirty.segment → PATCH segments（並行）
 *   - 取消：dirty 跳 ConfirmModal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditEntryPage from '../../src/pages/EditEntryPage';

// Mocks
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { email: 'user@test.com' }, loading: false }),
}));

vi.mock('../../src/hooks/useNavigateBack', () => ({
  useNavigateBack: (_fallback: string) => () => navigateSpy('back'),
}));

vi.mock('../../src/components/shell/AppShell', () => ({
  default: ({ main }: { main: React.ReactNode }) => <>{main}</>,
}));
vi.mock('../../src/components/shell/DesktopSidebarConnected', () => ({
  default: () => null,
}));
vi.mock('../../src/components/shell/GlobalBottomNav', () => ({
  default: () => null,
}));

// Stub apiFetch / apiFetchRaw
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: vi.fn(),
  apiFetchRaw: vi.fn(),
}));

// segments
const mockSegmentMap = new Map();
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: mockSegmentMap, loading: false }),
}));

import { apiFetch, apiFetchRaw } from '../../src/lib/apiClient';

// API 走 json() 自動 deepCamel → fixture 必須用 camelCase 對齊 real API。
// v2.26.0 ship 時 fixture 用 snake_case，跟 frontend code 同款，CI mask 掉
// 真實 API 用 camelCase 的事實 → production 一上線就壞（time 空白 + POI 卡
// 全消失），但測試從沒驗到。v2.26.3 補修 + 同步 fixture。
const ENTRY = {
  id: 42,
  dayId: 7,
  title: '花織そば',
  time: '12:00-13:30',
  startTime: '12:00',
  endTime: '13:30',
  note: '老店',
  poiId: 100,
};

const DAYS = [{ id: 7, dayNum: 3 }];
const DAY_DATA = {
  id: 7,
  dayNum: 3,
  timeline: [
    { id: 41, title: '首里城', poiType: 'attraction' },
    { id: 42, title: '花織そば', poiType: 'restaurant' },
  ],
};

function setupApiMocks() {
  (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
    if (url.endsWith('/days')) return Promise.resolve(DAYS);
    if (url.includes('/days/3')) return Promise.resolve(DAY_DATA);
    return Promise.resolve(null);
  });
  (apiFetchRaw as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, status: 200, text: () => Promise.resolve(''),
  } as unknown as Response);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trip/okinawa-2026/stop/42/edit']}>
      <Routes>
        <Route path="/trip/:tripId/stop/:entryId/edit" element={<EditEntryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigateSpy.mockClear();
  mockSegmentMap.clear();
  setupApiMocks();
});

describe('EditEntryPage — 載入 + 初始呈現', () => {
  it('載入 entry → 起訖時間 input 顯示既有值', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    const start = screen.getByTestId('edit-entry-start-time') as HTMLInputElement;
    const end = screen.getByTestId('edit-entry-end-time') as HTMLInputElement;
    expect(start.value).toBe('12:00');
    expect(end.value).toBe('13:30');
  });

  it('備註 textarea 顯示既有值 + counter', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-note')).toBeTruthy();
    });
    const note = screen.getByTestId('edit-entry-note') as HTMLTextAreaElement;
    expect(note.value).toBe('老店');
    expect(screen.getByTestId('edit-entry-note-counter').textContent).toBe('2 / 1000');
  });

  it('停留時間 chip 顯示「停留 90 分鐘」', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-duration')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-entry-duration').textContent).toMatch(/90/);
  });

  it('Day 1 第一個 entry（無 prev）→ mode section 不渲染', async () => {
    // 重新 mock：entry 42 是 timeline[0]
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
      if (url.endsWith('/days')) return Promise.resolve(DAYS);
      if (url.includes('/days/3')) return Promise.resolve({
        id: 7, dayNum: 3,
        timeline: [
          { id: 42, title: '花織そば', poiType: 'restaurant' }, // <-- index 0
          { id: 99, title: '海中道路', poiType: 'attraction' },
        ],
      });
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-time-section')).toBeTruthy();
    });
    expect(screen.queryByTestId('edit-entry-mode-section')).toBeNull();
  });
});

describe('EditEntryPage — 驗證', () => {
  it('start_time >= end_time → validation error + 儲存 disabled', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    const start = screen.getByTestId('edit-entry-start-time') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '14:00' } });
    expect(screen.queryByTestId('edit-entry-validation')).toBeTruthy();
    const save = screen.getByTestId('edit-entry-titlebar-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});

describe('EditEntryPage — 儲存', () => {
  it('改 start_time + 點儲存 → PATCH /entries 含 start_time', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    const start = screen.getByTestId('edit-entry-start-time') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '11:30' } });
    const save = screen.getByTestId('edit-entry-titlebar-save');
    fireEvent.click(save);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string };
        return opts?.method === 'PATCH';
      });
      expect(patchCall).toBeTruthy();
      const opts = patchCall![1] as { body: string };
      const body = JSON.parse(opts.body);
      expect(body.start_time).toBe('11:30');
    });
  });

  it('改備註 + 點儲存 → PATCH /entries 含 note', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-note')).toBeTruthy();
    });
    const note = screen.getByTestId('edit-entry-note') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: '更新的備註' } });
    fireEvent.click(screen.getByTestId('edit-entry-titlebar-save'));
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string };
        return opts?.method === 'PATCH';
      });
      expect(patchCall).toBeTruthy();
      const opts = patchCall![1] as { body: string };
      const body = JSON.parse(opts.body);
      expect(body.note).toBe('更新的備註');
    });
  });
});

describe('EditEntryPage — 取消保護', () => {
  it('未改 → 點返回 → 直接 navigate', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    // back button 由 TitleBar 渲染（aria-label="返回行程"）
    const back = screen.getByLabelText('返回行程');
    fireEvent.click(back);
    expect(navigateSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  it('已改 → 點返回 → 跳 ConfirmModal', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-note')).toBeTruthy();
    });
    const note = screen.getByTestId('edit-entry-note') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'dirty' } });
    fireEvent.click(screen.getByLabelText('返回行程'));
    expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
  });

  it('ConfirmModal「繼續編輯」 → modal 關閉', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-note')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('edit-entry-note'), { target: { value: 'dirty' } });
    fireEvent.click(screen.getByLabelText('返回行程'));
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });
});
