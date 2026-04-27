/**
 * IdeasTabContent — TripSheet Ideas tab real UI 測試（B-P5 / B-P6 task 4.1）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import IdeasTabContent from '../../src/components/trip/IdeasTabContent';

vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: vi.fn(),
}));

import { apiFetchRaw } from '../../src/lib/apiClient';
const apiMock = vi.mocked(apiFetchRaw);
const IDEAS_TAB_CONTENT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/trip/IdeasTabContent.tsx'),
  'utf8',
);
const USE_DRAG_DROP_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/hooks/useDragDrop.ts'),
  'utf8',
);

const SAMPLE_IDEA = {
  id: 1,
  tripId: 'test-trip',
  poiId: 100,
  title: '美麗海水族館',
  poiAddress: '沖繩縣國頭郡',
  poiType: 'sight',
  addedAt: '2026-04-25',
  promotedToEntryId: null,
  archivedAt: null,
};

const PROMOTED_IDEA = { ...SAMPLE_IDEA, id: 2, title: '已排入', promotedToEntryId: 999 };

function mockGet(ideas: typeof SAMPLE_IDEA[]) {
  apiMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ ideas }),
  } as Response);
}

beforeEach(() => {
  apiMock.mockReset();
});

describe('IdeasTabContent', () => {
  it('initial render shows loading state', () => {
    apiMock.mockImplementation(() => new Promise(() => {})); // never resolve
    render(<IdeasTabContent tripId="test-trip" />);
    expect(screen.getByTestId('ideas-loading')).toBeTruthy();
  });

  it('empty fetch shows 「還沒收藏任何想法」 empty state', async () => {
    mockGet([]);
    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => expect(screen.getByTestId('ideas-empty')).toBeTruthy());
    expect(screen.getByText('還沒收藏任何想法')).toBeTruthy();
  });

  it('non-empty fetch renders idea cards', async () => {
    mockGet([SAMPLE_IDEA]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => expect(screen.getByTestId('ideas-list')).toBeTruthy());
    expect(screen.getByText('美麗海水族館')).toBeTruthy();
    expect(screen.getByText('sight')).toBeTruthy();
  });

  it('promote button reads Day timeline, POSTs smart placement time, then PATCHes idea', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        timeline: [
          { id: 10, time: '09:00-10:30', sortOrder: 0 },
          { id: 11, time: '11:00-12:00', sortOrder: 1 },
        ],
      }),
    } as Response); // GET Day for smart placement
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 555 }),
    } as Response); // POST entry
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response); // PATCH idea
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ideas: [{ ...SAMPLE_IDEA, promotedToEntryId: 555 }] }),
    } as Response); // reload

    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => screen.getByTestId('ideas-promote-1-day-1'));
    fireEvent.click(screen.getByTestId('ideas-promote-1-day-1'));

    await waitFor(() => {
      const calls = apiMock.mock.calls.map((c) => c[0]);
      expect(calls).toContain('/trips/test-trip/days/1');
      expect(calls).toContain('/trips/test-trip/days/1/entries');
      expect(calls).toContain('/trip-ideas/1');
    });
    const createCall = apiMock.mock.calls.find((c) => c[0] === '/trips/test-trip/days/1/entries');
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      title: '美麗海水族館',
      time: '13:00-14:00',
      poi_type: 'attraction',
    });
  });

  it('delete button calls DELETE then reload', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) } as Response); // DELETE
    apiMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ideas: [] }) } as Response); // reload

    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => screen.getByTestId('ideas-delete-1'));
    fireEvent.click(screen.getByTestId('ideas-delete-1'));

    await waitFor(() => {
      const lastCall = apiMock.mock.calls.find((c) => c[0] === '/trip-ideas/1');
      expect(lastCall?.[1]?.method).toBe('DELETE');
    });
  });

  it('promoted idea shows 「已排入 entry #N」 instead of action buttons', async () => {
    mockGet([PROMOTED_IDEA]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1]} />);
    await waitFor(() => screen.getByText(/已排入 entry #999/));
    // 不該有 promote button
    expect(screen.queryByTestId('ideas-promote-2-day-1')).toBeNull();
  });

  it('fetch error renders error banner', async () => {
    apiMock.mockRejectedValueOnce(new Error('Network down'));
    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => expect(screen.getByTestId('ideas-error')).toBeTruthy());
    expect(screen.getByText(/Network down/)).toBeTruthy();
  });

  it('idea without poiId shows 「需先綁 POI」 hint, no promote buttons', async () => {
    mockGet([{ ...SAMPLE_IDEA, poiId: null, title: '自由文字 idea' }]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => screen.getByText('自由文字 idea'));
    expect(screen.getByText(/需先綁 POI 才能 promote/)).toBeTruthy();
    expect(screen.queryByTestId('ideas-promote-1-day-1')).toBeNull();
  });
});

describe('IdeasTabContent — drag-to-promote contract', () => {
  it('uses pointer + keyboard sensors for draggable idea cards', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('useDragDrop');
    expect(USE_DRAG_DROP_SRC).toContain('PointerSensor');
    expect(USE_DRAG_DROP_SRC).toContain('KeyboardSensor');
    expect(USE_DRAG_DROP_SRC).toContain('TouchSensor');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('useDraggable');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('useDroppable');
  });

  it('only exposes day drop targets while a drag is active', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('activeDragId && dayNumbers.length > 0');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('data-testid="ideas-drop-row"');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('data-testid={`day-drop-${num}`}');
  });

  it('maps active idea id + over day id to the same promote API path', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('parseIdeaDragId(String(e.active.id))');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('parseDayDropId(String(e.over.id))');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('void handlePromote(idea, dayNum, slot?.explicitStartTime)');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries');
  });

  it('supports explicit Day time slot drop targets for drag-to-promote', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('daySlotDropId');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('parseDaySlotDropId(String(e.over.id))');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('explicitStartTime');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('getExplicitSlotPlacement(explicitStartTime');
  });

  it('opens ConflictModal when an explicit slot overlaps an existing entry', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('ConflictModal');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('findFirstTimeConflict(placement, entries)');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('setPendingConflict');
  });

  it('prevents dragging promoted ideas or ideas without a POI', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('disabled: busy || !!idea.promotedToEntryId || !idea.poiId');
  });

  it('DragOverlay ghost uses 0.95x scale + shadow + 2deg tilt (task 7.1)', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('tp-idea-card-overlay');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('scale(0.95) rotate(2deg)');
    expect(IDEAS_TAB_CONTENT_SRC).toContain('box-shadow: 0 12px 32px');
    // reduced-motion override 對齊 css/tokens.css 全域 reduced-motion 規範
    expect(IDEAS_TAB_CONTENT_SRC).toContain('prefers-reduced-motion: reduce');
  });
});

describe('IdeasTabContent — ConflictModal scenarios (tasks 2.4-2.5)', () => {
  it('2.4 換位置 → 重算 smart placement 把新 entry 擠到既有最後 entry 後', () => {
    // handleConflictMoveAfter 行為：丟掉原 explicit slot，改用 getSmartPlacement
    // 算「最後 entry + 1h」的時段，新 entry 不再撞既有的時段。
    expect(IDEAS_TAB_CONTENT_SRC).toContain('handleConflictMoveAfter');
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleConflictMoveAfter[\s\S]+?const placement = getSmartPlacement\(pending\.entries\)/);
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleConflictMoveAfter[\s\S]+?commitPromote\(pending\.idea, pending\.dayNum, placement\)/);
  });

  it('2.5 併排 → 保留 explicit slot placement，新 entry 與 conflict 同時段 commit', () => {
    // handleConflictParallel 行為：直接用 pending.placement (= explicit slot 算
    // 的 SmartPlacement, sortOrder = max+1)。新 entry 跟 conflict 同時段顯示，
    // ORDER BY sort_order 讓兩者並列 (sort_order 相鄰)。
    expect(IDEAS_TAB_CONTENT_SRC).toContain('handleConflictParallel');
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleConflictParallel[\s\S]+?commitPromote\(pending\.idea, pending\.dayNum, pending\.placement\)/);
  });
});

describe('IdeasTabContent — Undo toast (tasks 2.6-2.7)', () => {
  it('2.6 promote 成功 → 顯示 undo toast + handler wired to DELETE entry + PATCH idea null', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ timeline: [] }),
    } as Response); // GET day timeline
    apiMock.mockResolvedValueOnce({
      ok: true, status: 201, json: async () => ({ id: 777 }),
    } as Response); // POST entry
    apiMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    } as Response); // PATCH idea promote
    apiMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ ideas: [{ ...SAMPLE_IDEA, promotedToEntryId: 777 }] }),
    } as Response); // reload

    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1]} />);
    await waitFor(() => screen.getByTestId('ideas-promote-1-day-1'));
    fireEvent.click(screen.getByTestId('ideas-promote-1-day-1'));

    await waitFor(() => expect(screen.getByTestId('undo-toast')).toBeTruthy());
    expect(screen.getByTestId('undo-toast').textContent).toContain('Day 1');
  });

  it('2.6 contract: handler 呼叫 DELETE entry + PATCH idea promotedToEntryId=null', () => {
    expect(IDEAS_TAB_CONTENT_SRC).toContain('handleUndoPromote');
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleUndoPromote[\s\S]+?\/entries\/\$\{last\.entryId\}/);
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleUndoPromote[\s\S]+?method: 'DELETE'/);
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handleUndoPromote[\s\S]+?promotedToEntryId: null/);
    expect(IDEAS_TAB_CONTENT_SRC).toContain('handleUndoTimeout');
  });

  it('2.7 API 失敗 → 顯示 error banner，不顯示 undo toast', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ timeline: [] }),
    } as Response); // GET day
    apiMock.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({}),
    } as Response); // POST entry fail

    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1]} />);
    await waitFor(() => screen.getByTestId('ideas-promote-1-day-1'));
    fireEvent.click(screen.getByTestId('ideas-promote-1-day-1'));

    await waitFor(() => expect(screen.getByTestId('ideas-error')).toBeTruthy());
    expect(screen.queryByTestId('undo-toast')).toBeNull();
  });

  it('2.7 contract: error path 經 setError，不 set lastPromote (因 throw 在 setLastPromote 之前)', () => {
    // commitPromote 在 POST 失敗即 throw，setLastPromote 永不到達。
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/if \(!create\.ok\) throw new Error/);
    expect(IDEAS_TAB_CONTENT_SRC).toMatch(/handlePromote[\s\S]+?setError\(\(e as Error\)\.message\)/);
  });
});
