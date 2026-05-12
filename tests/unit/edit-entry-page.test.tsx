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

// v2.27.0 multi-POI per entry — DAY_DATA with master + alternates
const DAY_DATA_WITH_ALTS = {
  id: 7,
  dayNum: 3,
  timeline: [
    { id: 41, title: '首里城', poiType: 'attraction' },
    {
      id: 42,
      title: '花織そば',
      poiType: 'restaurant',
      master: { poiId: 100, name: '花織そば', type: 'restaurant' },
      alternates: [
        { poiId: 201, name: '首里そば', sortOrder: 2, type: 'restaurant', category: null },
        { poiId: 202, name: 'やんばる食堂', sortOrder: 3, type: 'restaurant', category: null },
      ],
      entryPoisVersion: '2026-05-11T12:00:00',
    },
  ],
};

const DAY_DATA_NO_ALTS = {
  id: 7,
  dayNum: 3,
  timeline: [
    { id: 41, title: '首里城', poiType: 'attraction' },
    {
      id: 42,
      title: '花織そば',
      poiType: 'restaurant',
      master: { poiId: 100, name: '花織そば', type: 'restaurant' },
      alternates: [],
      entryPoisVersion: '2026-05-11T12:00:00',
    },
  ],
};

const TRIP_META = { title: '沖縄自駕五日遊', name: null };

function setupApiMocks() {
  (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
    if (url.endsWith('/days')) return Promise.resolve(DAYS);
    if (url.includes('/days/3')) return Promise.resolve(DAY_DATA);
    // v2.26.4: trip meta fetch for TitleBar 行程名稱
    if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
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

  // v2.26.4 — V1 mockup sign-off：TitleBar inline trip name + POI 卡 swap button
  it('TitleBar 顯示「編輯景點 · {trip name}」', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText(/沖縄自駕五日遊/)).toBeTruthy();
    });
    // TitleBar 同行包含「編輯景點」+ trip name（中間以 · 分隔）
    const titleEl = screen.getByText(/編輯景點/);
    expect(titleEl.textContent).toContain('編輯景點');
    expect(titleEl.textContent).toContain('沖縄自駕五日遊');
  });

  it('trip meta 還沒載入 → TitleBar 仍顯示「編輯景點」（fallback）', async () => {
    // 讓 trip meta endpoint pending 不解析
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
      if (url.endsWith('/days')) return Promise.resolve(DAYS);
      if (url.includes('/days/3')) return Promise.resolve(DAY_DATA);
      if (url.match(/\/trips\/[^/]+$/)) return new Promise(() => {}); // never resolves
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    // TitleBar 不該卡 — 只顯示「編輯景點」
    expect(screen.getByText(/編輯景點/).textContent).toContain('編輯景點');
  });

  it('POI 卡右側顯示「變更景點」icon button + click navigate 到 change-poi route', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-change-poi')).toBeTruthy();
    });
    const btn = screen.getByTestId('edit-entry-change-poi') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toContain('變更景點');
    fireEvent.click(btn);
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/change-poi');
  });

  it('停留時間 chip 顯示「停留 90 分鐘」', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-duration')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-entry-duration').textContent).toMatch(/90/);
  });

  // v2.27.0 regression test：POI 卡名稱必須 reflect master.name，不能被 entry.title 蓋掉。
  // QA finding: 在 4f4cad2 修復前，master swap 後 POI card 還是顯示舊 entry.title。
  // Initial useEffect was overwriting refreshEntryPois 設的 master-aware value。
  it('POI 卡名稱優先用 master.name 而非 entry.title（master swap 不被覆寫）', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/42')) return Promise.resolve({ ...ENTRY, title: 'Old Stale Title' });
      if (url.endsWith('/days')) return Promise.resolve(DAYS);
      if (url.includes('/days/3')) return Promise.resolve({
        id: 7, dayNum: 3,
        timeline: [
          {
            id: 42,
            title: 'Old Stale Title',
            poiType: 'attraction',
            // master.name 跟 me.title 不同 — 模擬 swap 後 entry.title 還沒同步
            master: { poiId: 999, name: 'New Master POI', type: 'hotel' },
            alternates: [],
            entryPoisVersion: '2026-05-12T00:00:00',
          },
        ],
      });
      if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-summary')).toBeTruthy();
    });
    const poiCard = screen.getByTestId('edit-entry-poi-summary');
    // 應顯示 master.name "New Master POI"，不是 entry.title "Old Stale Title"
    expect(poiCard.textContent).toContain('New Master POI');
    expect(poiCard.textContent).not.toContain('Old Stale Title');
    // type label：master.type='hotel' → '住宿'
    expect(poiCard.textContent).toContain('住宿');
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

// =========================================================================
// v2.27.0 Multi-POI per entry — alternates section + master swap + delete stop
// =========================================================================

function setupAltsMocks(dayDataOverride?: typeof DAY_DATA_WITH_ALTS) {
  const dayData = dayDataOverride ?? DAY_DATA_WITH_ALTS;
  (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
    if (url.endsWith('/days')) return Promise.resolve(DAYS);
    if (url.includes('/days/3')) return Promise.resolve(dayData);
    if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
    if (url.includes('/master')) return Promise.resolve({ masterPoiId: 201 });
    if (url.includes('/alternates/reorder')) return Promise.resolve({ order: [] });
    return Promise.resolve(null);
  });
  (apiFetchRaw as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, status: 200, text: () => Promise.resolve(''),
  } as unknown as Response);
}

describe('EditEntryPage — v2.27.0 alternates section', () => {
  it('alternates 有 2 個 → section 渲染 + count chip "2 個"', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alternates')).toBeTruthy();
    });
    const section = screen.getByTestId('edit-entry-alternates');
    expect(section.textContent).toMatch(/2 個/);
    expect(screen.getByTestId('edit-entry-alt-row-201')).toBeTruthy();
    expect(screen.getByTestId('edit-entry-alt-row-202')).toBeTruthy();
  });

  it('alternates 為 0 → section hidden + 顯示單一「加備案景點」CTA', async () => {
    setupAltsMocks(DAY_DATA_NO_ALTS);
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-add-zero')).toBeTruthy();
    });
    expect(screen.queryByTestId('edit-entry-alternates')).toBeNull();
  });

  it('每 row 含 ↑↓ / 設為首選 / × 四個 button', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-row-201')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-entry-alt-up-201')).toBeTruthy();
    expect(screen.getByTestId('edit-entry-alt-down-201')).toBeTruthy();
    expect(screen.getByTestId('edit-entry-alt-setmaster-201')).toBeTruthy();
    expect(screen.getByTestId('edit-entry-alt-delete-201')).toBeTruthy();
  });

  it('第一個 row 的 ↑ 按鈕 disabled，最後一個 row 的 ↓ 按鈕 disabled', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-up-201')).toBeTruthy();
    });
    expect((screen.getByTestId('edit-entry-alt-up-201') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('edit-entry-alt-down-202') as HTMLButtonElement).disabled).toBe(true);
    // 中間操作可用
    expect((screen.getByTestId('edit-entry-alt-down-201') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('edit-entry-alt-up-202') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Tap 設為首選 → 開 confirm modal 含原首選與目標 POI 名稱', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-setmaster-201')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-setmaster-201'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
    });
    const modalText = screen.getByTestId('confirm-modal').textContent ?? '';
    expect(modalText).toMatch(/首里そば/);
    expect(modalText).toMatch(/花織そば/);
  });

  it('Confirm 設為首選 → 呼叫 PATCH /master with poiId + entryPoisVersion', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-setmaster-201')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-setmaster-201'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal-confirm')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => {
      const calls = (apiFetch as ReturnType<typeof vi.fn>).mock.calls;
      const masterCall = calls.find((c) => typeof c[0] === 'string' && (c[0] as string).includes('/master'));
      expect(masterCall).toBeTruthy();
      const opts = masterCall![1] as RequestInit;
      const body = JSON.parse(opts.body as string);
      expect(body.poiId).toBe(201);
      // round 4 fix A1: canonical field name is entryPoisVersion (matches GET response)
      expect(body.entryPoisVersion).toBe('2026-05-11T12:00:00');
    });
  });

  it('刪除整個 stop button 渲染 + tap 開 confirm modal', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-delete-stop')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-delete-stop'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
    });
    const modalText = screen.getByTestId('confirm-modal').textContent ?? '';
    expect(modalText).toMatch(/刪除整個 stop/);
    expect(modalText).toMatch(/花織そば/);
    expect(modalText).toMatch(/2 個備案/);
  });

  it('Confirm 刪除 stop → 呼叫 DELETE /entries/:id + navigate back', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-delete-stop')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-delete-stop'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal-confirm')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const deleteCall = calls.find((c) => {
        const url = String(c[0]);
        const opts = c[1] as RequestInit | undefined;
        return url.includes('/entries/42') && opts?.method === 'DELETE';
      });
      expect(deleteCall).toBeTruthy();
      expect(navigateSpy).toHaveBeenCalled();
    });
  });

  it('「從搜尋加備案」按鈕 → navigate /trip/:id/stop/:eid/change-poi?mode=alternate', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-add-search')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-add-search'));
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.stringContaining('change-poi?mode=alternate'),
    );
  });
});
