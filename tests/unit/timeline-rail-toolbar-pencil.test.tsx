/**
 * TimelineRail ⋯ context menu + ConfirmModal — rev2 Section 02（2026-07-17 mockup）
 *
 * rev2 把停留卡的動作從「展開明細底部一排 icon 工具列」收進 row 上的單顆 ⋯ context menu
 * （Apple 列表語彙：動作進 ⋯，不在列上排 icon）。本測試驗：
 *   - 展開明細不再有 action 工具列（.tp-rail-actions 已移除）
 *   - ⋯ menu（RailRowMenu，原生 Popover）含：編輯備註 / 換景點 / 編輯景點 / 重新排序 / 刪除景點
 *     menu items 恆在 DOM（popover div 常駐，只切換可見性）→ RTL 直接可查
 *   - 編輯景點 menu item → navigate `/trip/:id/stop/:eid/edit`（testid 沿用 timeline-rail-edit-N）
 *   - 刪除景點 menu item → 開 ConfirmModal（alertdialog），不直接 fire DELETE（testid 沿用 timeline-rail-delete-N）
 *   - inline note 快速編輯仍保留（點展開明細的 tp-rail-note-value → textarea）
 *   - menu icon 全為 SVG sprite（無 emoji）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

// γ.1：useTripSegments 會打 GET /api/trips/:id/segments，這個 test 套件 stub 全域
// fetch 驗行為 — mock hook 回 empty 避免 segments fetch 干擾 fetchSpy。
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: new Map(), loading: false }),
}));

// 編輯 / 換景點 menu item navigate，mock useNavigate 驗 navigate 路徑
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// v2.29.x per-POI note cutover：inline 快速編輯 repoint 到 master stopPoi
// （sortOrder=1）的 per-POI note。fixture 補 master 反映真實資料（timeline entry 必有 master）。
const ENTRY: TimelineEntryData = {
  id: 42,
  time: '11:30-14:00',
  title: '沖縄美ら海水族館',
  description: '世界第二大水族館。',
  note: '提前買票。',
  stopPois: [
    { poiId: 9001, sortOrder: 1, name: '沖縄美ら海水族館', note: '提前買票。' },
  ],
};

function renderRail() {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="okinawa-2026">
        <TimelineRail events={[ENTRY]} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TimelineRail ⋯ context menu — rev2 Section 02', () => {
  it('預設不展開明細 (no detail panel)', () => {
    renderRail();
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
  });

  it('row 上有 ⋯ menu trigger', () => {
    renderRail();
    expect(screen.getByTestId('timeline-rail-menu-42')).toBeTruthy();
  });

  it('⋯ menu 含動作 items（編輯備註/換景點/編輯景點/重新排序/刪除景點）— 恆在 DOM', () => {
    renderRail();
    // popover menu items 常駐 DOM（只切換可見性）→ 不需開 popover 即可查
    expect(screen.getByTestId('timeline-rail-menu-note-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-menu-change-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-edit-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-menu-sort-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-delete-42')).toBeTruthy();
  });

  it('展開明細不再有 action 工具列（.tp-rail-actions 已移除，動作在 ⋯ menu）', () => {
    const { container } = renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    expect(container.querySelector('.tp-rail-actions')).toBeNull();
  });

  it('編輯景點 menu item → navigate to EditEntryPage', () => {
    navigateSpy.mockClear();
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-edit-42'));
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/edit');
  });

  it('換景點 menu item → navigate to ChangePoiPage', () => {
    navigateSpy.mockClear();
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-menu-change-42'));
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/change-poi');
  });

  it('inline note 編輯仍保留 — 點 tp-rail-note-value 觸發 textarea', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.queryByTestId('timeline-rail-note-input-42');
    expect(textarea).toBeTruthy();
  });

  it('刪除景點 menu item → 開 ConfirmModal (alertdialog)，不直接觸發 fetch', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-delete-42'));
    expect(screen.queryByTestId('confirm-modal')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ConfirmModal 取消 button → modal 關閉，fetch 不被打', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-delete-42'));
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('⋯ menu item 全為 SVG sprite (無 emoji unicode)', () => {
    const { container } = renderRail();
    const menu = container.querySelector('.tp-rail-menu');
    const text = menu?.textContent ?? '';
    const banned = ['🗑', '🔍', '⛶', '⎘', '⇅', '❤', '🚗', '📋', '✕', '✓'];
    for (const ch of banned) {
      expect(text.includes(ch)).toBe(false);
    }
  });
});
