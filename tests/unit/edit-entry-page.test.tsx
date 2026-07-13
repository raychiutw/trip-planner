/**
 * EditEntryPage — fullpage entry edit (起訖時間 + 說明 + POI + 從上一站移動方式)
 *
 * Mockup: docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html
 *
 * 驗：
 *   - Initial render：時間 picker / 說明 textarea / POI 卡 / mode segmented 都呈現 entry 既有值
 *   - 時間驗證：start_time >= end_time / 格式錯誤 → validation error 顯示 + 儲存 disabled
 *   - Dirty-check：未變更 → 儲存 disabled；改任一 field → 啟用
 *   - 儲存：dirty.entry → PATCH entries / dirty.segment → PATCH segments（並行）
 *   - 取消：dirty 跳 ConfirmModal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditEntryPage from '../../src/pages/EditEntryPage';
import { pickTime } from './__helpers__/tripTimePicker';

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

// v2.55.x：EditEntryPage 已改用 goBackFocused（await flush 備註 → navigate 帶 ?focus=），
// 不再 import useNavigateBack；原本的 mock 已無對應 import，移除。

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
// v2.34.0: entry-level note 已 DROP (migration 0078)。Entry.note 不再存在於
// trip_entries；每個 POI 各自帶 note（trip_entry_pois.note）。fixture 移除 entry.note。
const ENTRY = {
  id: 42,
  dayId: 7,
  title: '花織そば',
  time: '12:00-13:30',
  startTime: '12:00',
  endTime: '13:30',
  // v2.55.x: entry.description（活動說明，trip_entries.description）可編輯。
  description: '放好行李休息一下，準備晚餐出門',
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
      // v2.34.0 — master 與 alternate 各自帶 per-POI note（trip_entry_pois.note）。
      master: { poiId: 100, name: '花織そば', type: 'restaurant', note: '正選備註：必點黑豚叉燒' },
      alternates: [
        // v2.28.0 — alternates surface restaurant fields (price/hours/reservation)
        {
          poiId: 201,
          name: '首里そば',
          sortOrder: 2,
          type: 'restaurant',
          category: null,
          hours: '11:00-18:00',
          rating: 4.5,
          price: '$',
          reservation: '無需預約',
          reservationUrl: null,
          note: '備選備註：赤湯辣味推薦',
        },
        {
          poiId: 202,
          name: 'やんばる食堂',
          sortOrder: 3,
          type: 'restaurant',
          category: null,
          hours: null,
          rating: null,
          price: null,
          reservation: '需電話預約',
          reservationUrl: 'https://example.com/r',
          // 空 note → 顯示「+ 加備註」affordance
          note: null,
        },
      ],
      entryPoisVersion: '2026-05-11T12:00:00',
    },
  ],
};

// v2.28.1 cross-region warning — master + alternates with lat/lng + sibling day entry coords
// 沖繩三點 (那覇~美國村) → 全部 < 30km from day average。Tokyo alternate (poiId=303) > 50km
// trigger warning. 同區 alternate (poiId=302) < 30km no warning。
const DAY_DATA_WITH_GEO = {
  id: 7,
  dayNum: 3,
  timeline: [
    {
      id: 41,
      title: '首里城',
      poiType: 'attraction',
      master: { poiId: 99, name: '首里城', type: 'attraction', lat: 26.2173, lng: 127.7195 },
      alternates: [],
      entryPoisVersion: '2026-05-11T12:00:00',
    },
    {
      id: 42,
      title: '花織そば',
      poiType: 'restaurant',
      master: { poiId: 100, name: '花織そば', type: 'restaurant', lat: 26.2124, lng: 127.6792 },
      alternates: [
        {
          poiId: 302,
          name: '北谷美食街',
          sortOrder: 2,
          type: 'restaurant',
          category: null,
          lat: 26.3158, lng: 127.7591, // 美國村 — 同區
        },
        {
          poiId: 303,
          name: 'Tokyo Tower 餐廳',
          sortOrder: 3,
          type: 'restaurant',
          category: null,
          lat: 35.6586, lng: 139.7454, // 東京 — 跨區
        },
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
  it('載入 entry → 起訖時間 picker trigger 顯示既有值', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    // v2.33.21: native <input type="time"> → TripTimePicker (button trigger 顯示 HH:MM)
    const startTrigger = screen.getByTestId('edit-entry-start-time').querySelector('button');
    const endTrigger = screen.getByTestId('edit-entry-end-time').querySelector('button');
    expect(startTrigger?.textContent).toContain('12:00');
    expect(endTrigger?.textContent).toContain('13:30');
  });

  // v2.34.0: entry-level「備註」section（trip_entries.note）已移除，改 per-POI 備註。
  it('不再渲染 entry-level「備註」section（migration 0078 DROP）', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alternates')).toBeTruthy();
    });
    expect(screen.queryByTestId('edit-entry-note-section')).toBeNull();
    expect(screen.queryByTestId('edit-entry-note')).toBeNull();
    expect(screen.queryByTestId('edit-entry-note-counter')).toBeNull();
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

  it('POI 卡右側顯示「置換景點」icon button + click navigate 到 change-poi route', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-change-poi')).toBeTruthy();
    });
    const btn = screen.getByTestId('edit-entry-change-poi') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toContain('置換景點');
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
    // type label：master.type='hotel' → '飯店' (v2.33.28 改 canonical POI_TYPE_LABELS)
    expect(poiCard.textContent).toContain('飯店');
    // v2.54.6 三色：master POI 卡依 master.type 上 tone — hotel → sage（住/移動=sage）。
    expect(poiCard.getAttribute('data-tone')).toBe('sage');
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

describe('EditEntryPage — 驗證 (v2.33.108)', () => {
  it('start_time >= end_time → validation error 顯示 (auto-save skipped)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    pickTime('edit-entry-start-time', '14:00');
    expect(screen.queryByTestId('edit-entry-validation')).toBeTruthy();
    // v2.33.108: 「儲存」button 移除，改 SaveStatus indicator (saved/pending/error)
    // validation error 時 effect skip auto-save — 不會 PATCH。
  });
});

describe('EditEntryPage — auto-save (v2.33.108)', () => {
  it('改 start_time → debounce 後 PATCH /entries 含 start_time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    pickTime('edit-entry-start-time', '11:30');
    // useEffect debounce 800ms 後 fire handleSave
    await vi.advanceTimersByTimeAsync(900);
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
    vi.useRealTimers();
  });

  // v2.34.0: entry-level note autosave 已移除，改 per-POI note autosave。
  // 見 describe('EditEntryPage — v2.34.0 per-POI 備註')。
});

// v2.55.x: segment 不存在時也能手動設移動方式（POST /segments 建立），不必等 recompute。
describe('EditEntryPage — segment 不存在時手動建立 (v2.55.x)', () => {
  it('no-segment（segmentMap empty）→ 移動區塊顯示可編輯 segmented control（非 placeholder）', async () => {
    // beforeEach 已 mockSegmentMap.clear() → segment 不存在
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-mode-section')).toBeTruthy();
    });
    // control 三個 mode button 都顯示（之前 no-segment 只顯示「尚未有移動段資料」placeholder）
    expect(screen.queryByTestId('edit-entry-mode-driving')).toBeTruthy();
    expect(screen.queryByTestId('edit-entry-mode-walking')).toBeTruthy();
    expect(screen.queryByTestId('edit-entry-mode-transit')).toBeTruthy();
    expect(screen.queryByText(/尚未有移動段資料/)).toBeNull();
  });

  it('no-segment + 選開車 → debounce 後 POST /segments 建立（from=prev 41, to=current 42）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-mode-driving')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-mode-driving'));
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string };
        return opts?.method === 'POST' && String(c[0]).endsWith('/segments');
      });
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as { body: string }).body);
      expect(body.mode).toBe('driving');
      expect(body.from_entry_id).toBe(41); // 首里城（prev entry）
      expect(body.to_entry_id).toBe(42);   // 花織そば（current entry）
    });
    vi.useRealTimers();
  });

  it('no-segment + 選大眾運輸 + 填分鐘 → POST /segments 帶 mode=transit + min', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-mode-transit')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-mode-transit'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-transit-min')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('edit-entry-transit-min'), { target: { value: '35' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string };
        return opts?.method === 'POST' && String(c[0]).endsWith('/segments');
      });
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as { body: string }).body);
      expect(body.mode).toBe('transit');
      expect(body.min).toBe(35);
    });
    vi.useRealTimers();
  });

  it('no-segment + 選大眾運輸（不填分鐘）→ POST /segments 帶 mode=transit、不帶 min（自動 DRIVE 估，v2.55.72）', async () => {
    // v2.55.72：大眾運輸不再強制手填分鐘 — 選了即存、預設用駕車估。對齊 TravelPillDialog。
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-mode-transit')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-mode-transit'));
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const postCall = calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string };
        return opts?.method === 'POST' && String(c[0]).endsWith('/segments');
      });
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as { body: string }).body);
      expect(body.mode).toBe('transit');
      expect('min' in body).toBe(false); // 不填分鐘＝走自動 DRIVE 估
    });
    vi.useRealTimers();
  });

  it('選 driving 建立後不重複 POST（originalRef reset 防 re-save loop）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-mode-driving')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-mode-driving'));
    await vi.advanceTimersByTimeAsync(900);
    // 第一次 POST 後再 advance 一個 debounce 窗，無新變化 → 不該有第二次 POST
    await vi.advanceTimersByTimeAsync(900);
    const postCalls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls.filter((c: unknown[]) => {
      const opts = c[1] as { method?: string };
      return opts?.method === 'POST' && String(c[0]).endsWith('/segments');
    });
    expect(postCalls.length).toBe(1);
    vi.useRealTimers();
  });
});

describe('EditEntryPage — 返回 (v2.33.108: 移除 cancel confirm — auto-save 已 commit)', () => {
  it('點返回 → 直接 navigate (無 ConfirmModal)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    const back = screen.getByLabelText('返回行程');
    fireEvent.click(back);
    // v2.55.x：goBackFocused 先 await flush 備註再 navigate（async）→ 帶 ?focus=<entryId>
    // 讓 TripPage 回前頁還原「當下景點展開」。仍無 ConfirmModal。
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining('focus=42')));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  it('改值後返回 → 仍直接 navigate (auto-save 已寫，無需 confirm)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    // v2.34.0: note textarea 已移除，改用時間 picker 製造 dirty 狀態。
    pickTime('edit-entry-start-time', '11:30');
    fireEvent.click(screen.getByLabelText('返回行程'));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalled());
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  it('編輯 per-POI 備註 → blur 啟動 PATCH → 點返回：navigate 等 PATCH resolve 才發生（stale-race barrier）', async () => {
    // 備註 PATCH 用可控閘門：resolve 前 hang。blur 先啟動 in-flight PATCH，返回時 goBackFocused
    // 的 flush 撞 in-flight → useAutosave flush barrier 必須 await 它，navigate 才不會搶在 commit 前。
    let resolvePatch!: () => void;
    const patchGate = new Promise<void>((r) => { resolvePatch = r; });
    setupAltsMocks(); // 先設 alts（含 apiFetchRaw resolved 預設）
    // 再覆蓋 apiFetchRaw：備註 PATCH 走可控閘門，其餘照常 resolved
    (apiFetchRaw as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      const okResp = { ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({}) };
      if (url.includes('/pois/100')) return patchGate.then(() => okResp);
      return Promise.resolve(okResp);
    });
    renderPage();
    await waitFor(() => expect(screen.queryByTestId('edit-entry-alternates')).toBeTruthy());

    // master 備註（poiId=100）：開編輯 → 打字 → blur（模擬點按鈕前 textarea 先失焦 → 送出 PATCH）
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-100'));
    fireEvent.change(screen.getByTestId('edit-entry-poi-note-input-100'), { target: { value: '新備註內容' } });
    fireEvent.blur(screen.getByTestId('edit-entry-poi-note-input-100'));
    fireEvent.click(screen.getByLabelText('返回行程'));

    // barrier：PATCH 未 resolve → navigate 不該發生（修復前 flush 撞空 body 即 return → 這裡會紅）
    await new Promise((r) => setTimeout(r, 0));
    expect(navigateSpy).not.toHaveBeenCalled();

    // PATCH commit → flush 放行 → navigate 帶 ?focus=42
    resolvePatch();
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining('focus=42')));
    const patchCall = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/pois/100'),
    );
    expect(JSON.parse((patchCall![1] as { body: string }).body).note).toBe('新備註內容');
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

  it('alternates 為 0 → section 仍渲染 + 可進同一個加入備選畫面', async () => {
    setupAltsMocks(DAY_DATA_NO_ALTS);
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alternates')).toBeTruthy();
    });
    expect(screen.queryByTestId('edit-entry-alt-empty')).toBeTruthy();
    expect(screen.getByTestId('edit-entry-alt-add-search').textContent).toContain('搜尋加入備選');
    expect(screen.getByTestId('edit-entry-alt-add-favorites').textContent).toContain('收藏加入備選');
  });

  it('每 row 含 ↑↓ / 設為正選 / × 四個 button', async () => {
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

  it('Tap 設為正選 → 開 confirm modal 含原正選與目標 POI 名稱', async () => {
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

  it('Confirm 設為正選 → 呼叫 PATCH /master with poiId + entryPoisVersion', async () => {
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

  it('刪除整個停留點 button 渲染 + tap 開 confirm modal', async () => {
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
    expect(modalText).toMatch(/刪除整個停留點/);
    expect(modalText).toMatch(/花織そば/);
    expect(modalText).toMatch(/2 個備選/);
  });

  it('Confirm 刪除停留點 → 呼叫 DELETE /entries/:id + navigate back', async () => {
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

  // v2.28.0 — restaurant inline info (price/hours/reservation) under type label
  describe('alternates row surface restaurant fields (v2.28.0)', () => {
    it('alternate type=restaurant 含 price/hours chips + reservation 可編 row', async () => {
      setupAltsMocks();
      renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('edit-entry-alt-extra-201')).toBeTruthy();
      });
      const extra = screen.getByTestId('edit-entry-alt-extra-201');
      expect(extra.textContent).toMatch(/\$/);          // price chip
      expect(extra.textContent).toMatch(/11:00-18:00/);  // hours chip
      // v2.55：reservation 從唯讀 chip 改成 PerPoiNoteRow 可編 row（不再在 extra chip 排）。
      const resvRow = screen.getByTestId('edit-entry-poi-reservation-read-201');
      expect(resvRow.textContent).toContain('無需預約');
    });

    it('reservationUrl 存在 → reservation row 右側顯外連 link（escUrl + noopener）', async () => {
      setupAltsMocks();
      renderPage();
      // alt 202 無 price/hours → extra chip 排不 render；reservation row 一定 render。
      await waitFor(() => {
        expect(screen.queryByTestId('edit-entry-poi-reservation-read-202')).toBeTruthy();
      });
      const resvRow = screen.getByTestId('edit-entry-poi-reservation-read-202');
      expect(resvRow.textContent).toContain('需電話預約');
      const link = resvRow.querySelector('a.tp-poi-note-link') as HTMLAnchorElement | null;
      expect(link).toBeTruthy();
      expect(link!.href).toBe('https://example.com/r');
      expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('rating 存在 → 渲染 star + 數字', async () => {
      setupAltsMocks();
      renderPage();
      await waitFor(() => {
        expect(screen.queryByTestId('edit-entry-alt-row-201')).toBeTruthy();
      });
      const row = screen.getByTestId('edit-entry-alt-row-201');
      expect(row.textContent).toMatch(/4\.5/);
    });
  });

  it('「搜尋加入備選」按鈕 → navigate 到 change-poi alternate search tab', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-add-search')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-add-search'));
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/change-poi?mode=alternate&tab=search');
  });

  it('「收藏加入備選」按鈕 → navigate 到 change-poi alternate favorites tab', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-add-favorites')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-add-favorites'));
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/change-poi?mode=alternate&tab=favorites');
  });

  // Round 9 — 409 STALE_ENTRY 處理 (cross-tab safety + auto-retry on benign race)
  describe('handleSetAsMaster — 409 STALE_ENTRY 處理', () => {
    it('一次 PATCH /master 409 + refresh 後 master 不變 → 自動 retry 成功', async () => {
      const { ApiError } = await import('../../src/lib/errors');
      setupAltsMocks();
      // 第一次 PATCH 409 STALE_ENTRY，第二次成功；DAY_DATA refresh 仍回原 master
      let patchCallCount = 0;
      (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/master') && opts?.method === 'PATCH') {
          patchCallCount += 1;
          if (patchCallCount === 1) {
            return Promise.reject(new ApiError('STALE_ENTRY', 409));
          }
          return Promise.resolve({});
        }
        if (url.includes('/entries/42')) return Promise.resolve({ ...ENTRY, entryPoisVersion: '999' });
        if (url.endsWith('/days')) return Promise.resolve(DAYS);
        if (url.includes('/days/3')) return Promise.resolve(DAY_DATA_WITH_ALTS);
        if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
        return Promise.resolve(null);
      });
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
        expect(patchCallCount).toBe(2); // 第一次 409，第二次成功 retry
      });
    });

    it('一次 PATCH /master 409 + refresh 後 master 已被其他 tab 改過 → abort retry + 顯示警示', async () => {
      const { ApiError } = await import('../../src/lib/errors');
      // refresh 後 day data 回新 master poiId 999 (不是原 100) — 模擬 cross-tab swap
      const DAY_DATA_AFTER_OTHER_TAB_SWAP = {
        ...DAY_DATA_WITH_ALTS,
        timeline: [
          DAY_DATA_WITH_ALTS.timeline[0],
          {
            ...DAY_DATA_WITH_ALTS.timeline[1],
            master: { poiId: 999, name: '別人改成的店', type: 'restaurant' },
            entryPoisVersion: '999',
          },
        ],
      };
      let patchCallCount = 0;
      let refreshed = false;
      (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/master') && opts?.method === 'PATCH') {
          patchCallCount += 1;
          return Promise.reject(new ApiError('STALE_ENTRY', 409));
        }
        // 一開始回原 DAY_DATA_WITH_ALTS，refresh 後回 AFTER_OTHER_TAB_SWAP
        if (url.includes('/days/3')) {
          const data = refreshed ? DAY_DATA_AFTER_OTHER_TAB_SWAP : DAY_DATA_WITH_ALTS;
          refreshed = true;
          return Promise.resolve(data);
        }
        if (url.includes('/entries/42')) return Promise.resolve({ ...ENTRY, entryPoisVersion: '999' });
        if (url.endsWith('/days')) return Promise.resolve(DAYS);
        if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
        return Promise.resolve(null);
      });
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
        // Abort — 只有第一次 PATCH，沒 retry
        expect(patchCallCount).toBe(1);
        // 顯示 cross-tab 警示 message
        const errorEl = screen.queryByText(/已被改成/);
        expect(errorEl).toBeTruthy();
      });
    });

    it('PATCH /master 非 STALE_ENTRY 錯誤 → 不 retry，直接 surface error', async () => {
      const { ApiError } = await import('../../src/lib/errors');
      let patchCallCount = 0;
      (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/master') && opts?.method === 'PATCH') {
          patchCallCount += 1;
          return Promise.reject(new ApiError('SYS_INTERNAL', 500));
        }
        if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
        if (url.endsWith('/days')) return Promise.resolve(DAYS);
        if (url.includes('/days/3')) return Promise.resolve(DAY_DATA_WITH_ALTS);
        if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
        return Promise.resolve(null);
      });
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
        // 沒 retry — 只一次 call
        expect(patchCallCount).toBe(1);
      });
    });
  });
});

// =========================================================================
// v2.28.1 — 跨區警告 (master swap confirm modal)
//
// 當 swap 目標 POI 距當日其他 entries 平均位置 > 50km，confirm modal 顯紅字
// 「⚠ 新正選距離本日其他點 X km，可能跨區，確定？」。
// 反向：< 50km 不顯。
// =========================================================================
describe('EditEntryPage — v2.28.1 跨區警告', () => {
  function setupGeoMocks() {
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/entries/42')) return Promise.resolve(ENTRY);
      if (url.endsWith('/days')) return Promise.resolve(DAYS);
      if (url.includes('/days/3')) return Promise.resolve(DAY_DATA_WITH_GEO);
      if (url.match(/\/trips\/[^/]+$/)) return Promise.resolve(TRIP_META);
      return Promise.resolve(null);
    });
    (apiFetchRaw as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(''),
    } as unknown as Response);
  }

  it('Tap 設為正選（跨區 alternate, > 50km）→ confirm modal 顯跨區警告', async () => {
    setupGeoMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-setmaster-303')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-setmaster-303'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
    });
    // Warning element should be visible with cross-region copy + distance number
    const warning = screen.getByTestId('confirm-modal-warning');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toMatch(/跨區|距離本日其他點/);
    // ~1556 km from day center → 顯數字 (km 級)
    expect(warning.textContent).toMatch(/\d+\s*km/);
  });

  it('Tap 設為正選（同區 alternate, < 50km）→ confirm modal 不顯跨區警告', async () => {
    setupGeoMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-alt-setmaster-302')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-alt-setmaster-302'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
    });
    expect(screen.queryByTestId('confirm-modal-warning')).toBeNull();
  });
});

// =========================================================================
// v2.34.0 — per-POI 備註（Variant B「點擊編輯備註行」）
//
// entry-level note 已 DROP；master + 每個 alternate 各掛一條 trip_entry_pois.note。
// 顯示：有 note → 顯示文字（點擊就地展開 textarea）；空 → 「+ 加備註」affordance。
// 編輯：textarea autosave (800ms debounce / onBlur flush / ⌘↩ 完成 / esc 關閉) →
//   PATCH /trips/:id/entries/:eid/pois/:poiId { note }，LWW（不帶 entryPoisVersion）。
// =========================================================================
describe('EditEntryPage — v2.34.0 per-POI 備註', () => {
  it('master 摘要卡顯示正選 note（read state）', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-entry-poi-note-read-100').textContent)
      .toContain('正選備註：必點黑豚叉燒');
  });

  it('有 note 的 alternate row 顯示該 note；空 note 的 row 顯示「+ 加備註」', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-201')).toBeTruthy();
    });
    // alt 201 有 note
    expect(screen.getByTestId('edit-entry-poi-note-read-201').textContent)
      .toContain('備選備註：赤湯辣味推薦');
    // alt 202 空 note → 「+ 加備註」affordance
    expect(screen.getByTestId('edit-entry-poi-note-read-202').textContent)
      .toContain('+ 加備註');
  });

  it('點擊 master note read row → 就地展開 textarea（edit state）', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-100'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-100')).toBeTruthy();
    });
    const ta = screen.getByTestId('edit-entry-poi-note-input-100') as HTMLTextAreaElement;
    expect(ta.value).toBe('正選備註：必點黑豚叉燒');
  });

  it('Space 鍵在 master note read row → 開啟編輯（role="button" a11y，需支援 Enter+Space）', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
    fireEvent.keyDown(screen.getByTestId('edit-entry-poi-note-read-100'), { key: ' ' });
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-100')).toBeTruthy();
    });
  });

  it('點擊空 note 的 alternate「+ 加備註」→ 展開空 textarea', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-202')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-202'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-202')).toBeTruthy();
    });
    expect((screen.getByTestId('edit-entry-poi-note-input-202') as HTMLTextAreaElement).value).toBe('');
  });

  it('編輯 master note → debounce 後 PATCH /entries/42/pois/100 with { note }，不帶 entryPoisVersion', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-100'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-100')).toBeTruthy();
    });
    const ta = screen.getByTestId('edit-entry-poi-note-input-100') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '改成新的正選備註' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const poiNoteCall = calls.find((c: unknown[]) => {
        const url = String(c[0]);
        const opts = c[1] as { method?: string } | undefined;
        return url.includes('/entries/42/pois/100') && opts?.method === 'PATCH';
      });
      expect(poiNoteCall).toBeTruthy();
      const body = JSON.parse((poiNoteCall![1] as { body: string }).body);
      expect(body.note).toBe('改成新的正選備註');
      // LWW — 不帶 OCC token
      expect(body.entryPoisVersion).toBeUndefined();
    });
    vi.useRealTimers();
  });

  it('編輯 alternate note → debounce 後 PATCH /entries/42/pois/201 with { note }', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-201')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-201'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-201')).toBeTruthy();
    });
    const ta = screen.getByTestId('edit-entry-poi-note-input-201') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '備選改新備註' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const poiNoteCall = calls.find((c: unknown[]) => {
        const url = String(c[0]);
        const opts = c[1] as { method?: string } | undefined;
        return url.includes('/entries/42/pois/201') && opts?.method === 'PATCH';
      });
      expect(poiNoteCall).toBeTruthy();
      const body = JSON.parse((poiNoteCall![1] as { body: string }).body);
      expect(body.note).toBe('備選改新備註');
    });
    vi.useRealTimers();
  });

  it('清空 note → PATCH body note 為空字串（端點轉 null 清除）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-201')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-201'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-201')).toBeTruthy();
    });
    const ta = screen.getByTestId('edit-entry-poi-note-input-201') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const calls = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls;
      const poiNoteCall = calls.find((c: unknown[]) => {
        const url = String(c[0]);
        const opts = c[1] as { method?: string } | undefined;
        return url.includes('/entries/42/pois/201') && opts?.method === 'PATCH';
      });
      expect(poiNoteCall).toBeTruthy();
      const body = JSON.parse((poiNoteCall![1] as { body: string }).body);
      expect(body.note).toBe('');
    });
    vi.useRealTimers();
  });

  it('點「完成」按鈕 → flush + 回 read state', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-100'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-done-100')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-done-100'));
    await waitFor(() => {
      // textarea 收起，回到 read row
      expect(screen.queryByTestId('edit-entry-poi-note-input-100')).toBeNull();
      expect(screen.queryByTestId('edit-entry-poi-note-read-100')).toBeTruthy();
    });
  });

  it('textarea esc → flush + 關閉回 read state', async () => {
    setupAltsMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-read-201')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-poi-note-read-201'));
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-201')).toBeTruthy();
    });
    const ta = screen.getByTestId('edit-entry-poi-note-input-201') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-poi-note-input-201')).toBeNull();
    });
  });
});

// =========================================================================
// v2.55.x — entry.description 說明欄 + 起訖時間移到最上方 + 時間可清空
// =========================================================================
describe('EditEntryPage — entry.description 說明欄（v2.55.x）', () => {
  it('載入 entry → 說明 textarea 顯示 entry.description', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-description-input')).toBeTruthy();
    });
    expect((screen.getByTestId('edit-entry-description-input') as HTMLTextAreaElement).value)
      .toBe('放好行李休息一下，準備晚餐出門');
  });

  it('欄位順序：起訖時間 → 說明 → POI 卡', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-time-section')).toBeTruthy();
      expect(screen.queryByTestId('edit-entry-description-section')).toBeTruthy();
      expect(screen.queryByTestId('edit-entry-poi-summary')).toBeTruthy();
    });
    const time = screen.getByTestId('edit-entry-time-section');
    const desc = screen.getByTestId('edit-entry-description-section');
    const poi = screen.getByTestId('edit-entry-poi-summary');
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    // time 在 desc 之前、desc 在 poi 之前（說明緊接時間下方）。
    expect(time.compareDocumentPosition(desc) & FOLLOWING).toBeTruthy();
    expect(desc.compareDocumentPosition(poi) & FOLLOWING).toBeTruthy();
  });

  it('改說明 → debounce 後 PATCH /entries/42 含 description', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-description-input')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '改成新的活動說明' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const patchCall = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string } | undefined;
        return String(c[0]).includes('/entries/42') && opts?.method === 'PATCH';
      });
      expect(patchCall).toBeTruthy();
      expect(JSON.parse((patchCall![1] as { body: string }).body).description).toBe('改成新的活動說明');
    });
    vi.useRealTimers();
  });

  it('清空說明（純空白）→ PATCH body.description 為 null', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-description-input')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('edit-entry-description-input'), { target: { value: '   ' } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const patchCall = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string } | undefined;
        return String(c[0]).includes('/entries/42') && opts?.method === 'PATCH';
      });
      expect(patchCall).toBeTruthy();
      expect(JSON.parse((patchCall![1] as { body: string }).body).description).toBeNull();
    });
    vi.useRealTimers();
  });

  it('時間 picker clearable → popover 顯「清除時間」→ 點擊後 PATCH start_time null', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('edit-entry-start-time')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('edit-entry-start-time').querySelector('button')!);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="tp-time-clear"]')).toBeTruthy();
    });
    fireEvent.click(document.querySelector('[data-testid="tp-time-clear"]') as HTMLElement);
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => {
      const patchCall = (apiFetchRaw as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => {
        const opts = c[1] as { method?: string } | undefined;
        return String(c[0]).includes('/entries/42') && opts?.method === 'PATCH';
      });
      expect(patchCall).toBeTruthy();
      expect(JSON.parse((patchCall![1] as { body: string }).body).start_time).toBeNull();
    });
    vi.useRealTimers();
  });
});
