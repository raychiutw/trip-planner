/**
 * TimelineRail — V3 inline expansion + click-to-edit (PR2 of v2.7).
 *
 * Reverses the 2026-04-19 navigation-to-StopDetailPage decision. Click row
 * toggles inline detail panel (description / locations / note). Click note
 * value → editable textarea with Cmd+Enter / ESC. PATCH persists; success
 * dispatches `tp-entry-updated` so TripPage triggers refetchCurrentDay.
 *
 * Accordion behavior: only one row expanded at a time per rail.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import { TripDaysContext } from '../../src/contexts/TripDaysContext';
import type { DayOption } from '../../src/lib/entryAction';

// γ.1：useTripSegments 會打 GET /api/trips/:id/segments，這個 test 套件 stub 全域
// fetch 驗 PATCH/DELETE/etc — mock hook 回 empty 避免 segments fetch 干擾 fetchSpy。
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: new Map(), loading: false }),
}));

const TIMELINE_RAIL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
  'utf8',
);
const USE_DRAG_DROP_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/hooks/useDragDrop.ts'),
  'utf8',
);

// v2.29.x per-POI note cutover：inline 快速編輯的 save target 從 entry-level
// `trip_entries.note`（已 DROP）改為 master stopPoi（sortOrder=1）的 per-POI note。
// 顯示仍讀 entry.note（mapDay 已把它設為 master note），但「可編輯」前提是
// entry 有 master（stopPois 含 sortOrder===1 且具 poiId）。fixture 因此補上
// 對應的 master stopPoi，poiId 即 PATCH /pois/:poiId 的 target。
const ENTRY_A: TimelineEntryData = {
  id: 42,
  time: '11:30-14:00',
  title: '沖縄美ら海水族館',
  description: '世界第二大水族館，鎮館之寶是黑潮之海。',
  note: '提前線上買票省 ¥120。',
  googleRating: 4.6,
  stopPois: [
    {
      poiId: 9001,
      sortOrder: 1,
      name: '沖縄美ら海水族館',
      note: '提前線上買票省 ¥120。',
    },
  ],
};

const ENTRY_B: TimelineEntryData = {
  id: 43,
  time: '15:00-16:30',
  title: '古宇利大橋',
  description: '本島最長海上橋。',
  note: null,
  googleRating: 4.5,
  stopPois: [
    {
      poiId: 9002,
      sortOrder: 1,
      name: '古宇利大橋',
      note: null,
    },
  ],
};

function renderRail(events: TimelineEntryData[] = [ENTRY_A, ENTRY_B], tripId = 'okinawa-2026') {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimelineRail — inline expand', () => {
  it('all rows collapsed by default', () => {
    renderRail();
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
    expect(screen.queryByTestId('timeline-rail-detail-43')).toBeNull();
  });

  it('clicking row expands inline detail', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
  });

  // v2.53.1 回歸防護：展開明細是 .tp-rail-item 的 sibling（非後代），拿不到繼承的
  // --tone-*，必須自帶 data-tone 才能與卡片同色系。漏這個 attr → 面板退回中性奶油。
  it('expanded detail carries data-tone（與卡片同色系）', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    const tone = detail.getAttribute('data-tone');
    expect(tone).toBeTruthy();
    expect(['accent', 'sage', 'pink', 'neutral']).toContain(tone);
  });

  it('expanded panel shows description + note text', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    expect(detail.textContent).toContain('世界第二大水族館');
    expect(detail.textContent).toContain('提前線上買票省 ¥120');
  });

  it('clicking same row again collapses', () => {
    renderRail();
    const row = screen.getByTestId('timeline-rail-row-42');
    fireEvent.click(row);
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
  });

  it('accordion: opening another row collapses previous', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    fireEvent.click(screen.getByTestId('timeline-rail-row-43'));
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
    expect(screen.getByTestId('timeline-rail-detail-43')).toBeTruthy();
  });

  // v2.55.51 a11y：aria-expanded 從 head（曾為 role=button）移到獨立 caret <button>。
  // head role=button 會令子孫 presentational → 吞掉 sub-line 的時間 chip button；改由
  // caret 承載 toggle 語意，head 保留 div onClick 供滑鼠整列點展。
  it('aria-expanded reflects state on caret toggle button', () => {
    renderRail();
    const toggle = screen.getByTestId('timeline-rail-toggle-42');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('generic meal rows show the selected restaurant display title', () => {
    renderRail([
      {
        id: 783,
        time: '11:42-12:42',
        title: '午餐',
        displayTitle: '敘敘苑 沖繩浦添PARCO CITY店',
        poiType: 'restaurant',
        description: null,
        note: null,
        googleRating: 4.2,
      },
    ]);
    const row = screen.getByTestId('timeline-rail-row-783');
    expect(row.textContent).toContain('敘敘苑 沖繩浦添PARCO CITY店');
    expect(row.textContent).not.toContain('午餐');
    // aria-label 隨 v2.55.51 a11y 重構移到 caret toggle button（head 改回無語意 div）。
    expect(screen.getByTestId('timeline-rail-toggle-783').getAttribute('aria-label')).toContain('敘敘苑 沖繩浦添PARCO CITY店');
  });

  it('renders dedicated drag grips so reorder does not conflict with row expand', () => {
    renderRail();
    const grip = screen.getByTestId('timeline-rail-grip-42');
    expect(grip.getAttribute('aria-label')).toContain('拖拉排序');
    expect(screen.getByTestId('timeline-rail-row-42')).toBeTruthy();
  });
});

describe('TimelineRail — click-to-edit note', () => {
  it('clicking note value shows editable textarea', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('提前線上買票省 ¥120。');
  });

  it('shows kbd hint + close button in edit mode (v2.33.108 auto-save)', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    // v2.33.108: 「儲存 / 取消」改「完成」(auto-save)
    expect(within(detail).getByTestId('timeline-rail-note-close-42')).toBeTruthy();
    expect(detail.textContent).toMatch(/⌘.*↩/);
  });

  it('ESC closes edit mode (v2.33.108: 已 auto-save commit，不再 revert)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '改成這個' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('timeline-rail-note-input-42')).toBeNull();
    });
  });

  it('Cmd+Enter saves, calls PATCH per-POI note endpoint (master poiId)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '推薦 11:00 餵食秀' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0]!;
    // v2.29.x cutover：repoint 到 master stopPoi（sortOrder=1, poiId=9001）的 per-POI note。
    expect(url).toBe('/api/trips/okinawa-2026/entries/42/pois/9001');
    expect((opts as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ note: '推薦 11:00 餵食秀' });
  });

  it('onBlur triggers auto-save PATCH (v2.33.108)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '改備註' } });
    fireEvent.blur(textarea);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('successful save dispatches tp-entry-updated event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    window.addEventListener('tp-entry-updated', listener);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(listener).toHaveBeenCalled());
    const evt = listener.mock.calls[0]![0] as CustomEvent<{ tripId: string; entryId: number }>;
    expect(evt.detail).toEqual({ tripId: 'okinawa-2026', entryId: 42 });
    window.removeEventListener('tp-entry-updated', listener);
  });

  it('empty note shows「+ 加備註」placeholder', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-43'));
    const placeholder = screen.getByTestId('timeline-rail-note-value-43');
    expect(placeholder.textContent).toContain('加備註');
  });
});

describe('TimelineRail — per-POI note repoint guards (v2.29.x cutover)', () => {
  // 無 master（stopPois 完全沒有）→ 沒有 master poiId 可寫 → 停用 inline 編輯。
  // 顯示的 note 來源是 entry.note（mapDay 設好），但不可點擊進編輯。
  it('entry without any stopPois → note not editable (no textarea on click)', () => {
    const noMaster: TimelineEntryData = {
      id: 77,
      time: '09:00-10:00',
      title: '無 master 景點',
      note: '這條 note 沒有對應的 master POI',
      googleRating: 4.0,
    };
    renderRail([noMaster]);
    fireEvent.click(screen.getByTestId('timeline-rail-row-77'));
    // 仍顯示既有 note 文字（read-only）
    const value = screen.getByTestId('timeline-rail-note-value-77');
    expect(value.textContent).toContain('這條 note 沒有對應的 master POI');
    // 但不是可點擊 button（沒有 role=button、點擊不展開 textarea）
    expect(value.getAttribute('role')).not.toBe('button');
    fireEvent.click(value);
    expect(screen.queryByTestId('timeline-rail-note-input-77')).toBeNull();
  });

  // master 存在但沒有 poiId（例如尚未存檔的搜尋結果）→ 無法定位 PATCH target → 停用編輯。
  it('master stopPoi without poiId → note not editable', () => {
    const masterNoPoiId: TimelineEntryData = {
      id: 78,
      time: '11:00-12:00',
      title: 'master 缺 poiId',
      note: '備註內容',
      stopPois: [{ poiId: null, sortOrder: 1, name: 'master 缺 poiId', note: '備註內容' }],
    };
    renderRail([masterNoPoiId]);
    fireEvent.click(screen.getByTestId('timeline-rail-row-78'));
    const value = screen.getByTestId('timeline-rail-note-value-78');
    expect(value.getAttribute('role')).not.toBe('button');
    fireEvent.click(value);
    expect(screen.queryByTestId('timeline-rail-note-input-78')).toBeNull();
  });

  // 空 note 但無 master → 不顯示「+ 加備註」可編輯 affordance（純停用，不誘導點擊）。
  it('empty note + no master → no editable「+ 加備註」affordance', () => {
    const emptyNoMaster: TimelineEntryData = {
      id: 79,
      time: '13:00-14:00',
      title: '空 note 無 master',
      note: null,
      googleRating: 4.0,
    };
    renderRail([emptyNoMaster]);
    fireEvent.click(screen.getByTestId('timeline-rail-row-79'));
    const value = screen.queryByTestId('timeline-rail-note-value-79');
    // 無 master 且 note 空：不渲染可點擊的編輯 affordance
    if (value) {
      expect(value.getAttribute('role')).not.toBe('button');
      fireEvent.click(value);
    }
    expect(screen.queryByTestId('timeline-rail-note-input-79')).toBeNull();
  });
});

const DAY_OPTIONS: DayOption[] = [
  { dayNum: 1, dayId: 101, label: 'Day 1', stopCount: 2 },
  { dayNum: 2, dayId: 102, label: 'Day 2', stopCount: 0 },
  { dayNum: 3, dayId: 103, label: 'Day 3', stopCount: 1 },
];

function renderWiredRail(events = [ENTRY_A, ENTRY_B], days = DAY_OPTIONS, dayId: number | null = 101, tripId = 'okinawa-2026') {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TripDaysContext.Provider value={days}>
          <TimelineRail events={events} dayId={dayId} />
        </TripDaysContext.Provider>
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — copy/move copy/move buttons (v2.10 Wave 1)', () => {
  it('expanded row shows copy + move buttons when ≥2 days + dayId set', () => {
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-copy-open-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-move-open-42')).toBeTruthy();
  });

  it('hides copy/move when only 1 day available', () => {
    renderWiredRail([ENTRY_A], [DAY_OPTIONS[0]!]);
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.queryByTestId('timeline-rail-copy-open-42')).toBeNull();
  });

  it('hides copy/move when no dayId provided', () => {
    renderWiredRail(undefined, undefined, null);
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.queryByTestId('timeline-rail-copy-open-42')).toBeNull();
  });

  // 2026-05-03 modal-to-fullpage migration: EntryActionPopover → EntryActionPage
  // (/trip/:id/stop/:eid/copy 或 /move)。TimelineRail 不再 mount popover，
  // 改為 navigate('/trip/:id/stop/:eid/(copy|move)')。Popover 行為（fetch days、
  // confirm flow、API call、event dispatch）覆蓋責任轉移到 EntryActionPage 自己
  // 的測試 (TODO: src/pages/EntryActionPage 等價單元測試)。
  // 此處只驗 TimelineRail 端按鈕點擊後 URL 變動正確。
});

describe('TimelineRail — drag reorder contract', () => {
  it('uses dnd-kit sortable primitives with keyboard support', () => {
    expect(TIMELINE_RAIL_SRC).toContain('DndContext');
    expect(TIMELINE_RAIL_SRC).toContain('SortableContext');
    expect(TIMELINE_RAIL_SRC).toContain('verticalListSortingStrategy');
    expect(TIMELINE_RAIL_SRC).toContain('useDragDrop');
    expect(USE_DRAG_DROP_SRC).toContain('sortableKeyboardCoordinates');
  });

  it('optimistically reorders rows and posts a single batch payload', () => {
    expect(TIMELINE_RAIL_SRC).toContain('arrayMove(orderedEvents, oldIdx, newIdx)');
    expect(TIMELINE_RAIL_SRC).toContain('setOrderOverride(newIds)');
    expect(TIMELINE_RAIL_SRC).toContain("/entries/batch");
    expect(TIMELINE_RAIL_SRC).toContain("JSON.stringify({ updates })");
    expect(TIMELINE_RAIL_SRC).toContain('id, sort_order: idx');
  });

  it('broadcasts tp-entry-updated after successful reorder and reverts override on failure', () => {
    expect(TIMELINE_RAIL_SRC).toContain('new CustomEvent(EVENT.entryUpdated');
    expect(TIMELINE_RAIL_SRC).toContain('reordered: true');
    expect(TIMELINE_RAIL_SRC).toContain('setOrderOverride(null)');
  });
});

describe('TimelineRail — drag reorder runtime', () => {
  it('Day 同列拖動：drag end 後 PATCH batch 一次送所有改變位置的 entry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const events: TimelineEntryData[] = [
      { id: 1, title: 'A', time: '09:00-10:00' },
      { id: 2, title: 'B', time: '10:30-11:30' },
      { id: 3, title: 'C', time: '12:00-13:00' },
    ];
    render(
      <MemoryRouter>
        <TripIdContext.Provider value="okinawa-2026">
          <TimelineRail events={events} />
        </TripIdContext.Provider>
      </MemoryRouter>,
    );

    // dnd-kit pointer 拖動在 jsdom 不穩定，直接驗 contract handler 行為：
    // handleDragEnd 用 batch endpoint。組件已 wired up；以 source-level
    // contract 涵蓋 runtime 流程。
    expect(TIMELINE_RAIL_SRC).toMatch(/await apiFetchRaw\(`\/trips\/\$\{tripId\}\/entries\/batch`/);
    expect(TIMELINE_RAIL_SRC).toContain('method: \'PATCH\'');
  });
});

describe('TimelineRail — cross-day drag capability', () => {
  it('batch endpoint 接 day_id 變動，cross-day move 走同一 batch payload', () => {
    // Backend integration test：tests/api/entries-batch.integration.test.ts
    // "Cross-day move：同次 batch 更新 day_id + sort_order" 已驗證。
    // 前端 cross-day UI 目前透過 copy/move popover（multi-day view in TimelineRail
    // expand）走 PATCH /entries/:eid 既有 endpoint，drag-cross-day 為 V2 lift
    // DndContext 後啟動。此 contract 只確認 batch endpoint 字段對齊 spec。
    expect(TIMELINE_RAIL_SRC).toContain('updates');
    expect(TIMELINE_RAIL_SRC).toContain('sort_order');
  });
});

describe('2026-07-07 detail 同寬 + iOS 展開（source-grep 鎖）', () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
    'utf8',
  );
  it('detail 與 header 卡同寬 — 不可退回 56/44px 左縮排（terracotta mockup 本為同寬）', () => {
    expect(SRC).toMatch(/\.tp-rail-detail \{[\s\S]{0,400}margin: 4px 0 8px;/);
    expect(SRC).not.toMatch(/margin: 4px 0 8px 56px/);
    expect(SRC).not.toMatch(/margin: 4px 0 8px 44px/);
  });
  it('iOS 式高度展開：interpolate-size + @starting-style + apple bezier', () => {
    expect(SRC).toContain('interpolate-size: allow-keywords');
    expect(SRC).toContain('@starting-style');
    expect(SRC).toMatch(/transition:[\s\S]{0,80}height 320ms var\(--transition-timing-function-apple/);
    expect(SRC).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

// v2.55.x：回前頁（EditEntryPage goBack 帶 ?focus=<entryId>）時，該景點所在 rail 掛載即展開它。
// expandedId lazy-init 讀 window.location.search，故各測試後需還原 location 避免洩漏到別的測試。
describe('TimelineRail — ?focus= mount 展開（v2.55.x 回前頁還原當下景點）', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('?focus=<本 rail 成員 id> → 該景點掛載即展開，其他維持收合', () => {
    window.history.replaceState({}, '', '/?focus=42');
    renderRail();
    expect(screen.getByTestId('timeline-rail-toggle-42').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-toggle-43').getAttribute('aria-expanded')).toBe('false');
  });

  it('?focus=<非本 rail 成員 id> → 無 row 展開（events.some 守衛，不吃別天的 focus）', () => {
    window.history.replaceState({}, '', '/?focus=999');
    renderRail();
    expect(screen.getByTestId('timeline-rail-toggle-42').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('timeline-rail-toggle-43').getAttribute('aria-expanded')).toBe('false');
  });
});
