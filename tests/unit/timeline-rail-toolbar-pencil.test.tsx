/**
 * TimelineRail toolbar pencil + ConfirmModal — Section 4.5 (terracotta-mockup-parity-v2)
 *
 * 驗 expanded toolbar 含：
 *   - 放大檢視 button (lightbox open)
 *   - v2.26.0：編輯景點 pencil button → navigate to `/trip/:id/stop/:eid/edit`
 *     （取代既有 inline note edit；備註 inline 編輯仍保留 via tp-rail-note-value click）
 *   - 刪除景點 button → 開 inline ConfirmModal (alertdialog)，不直接 fire DELETE
 *   - 收合 button (x-mark icon)
 *   - icon 全為 SVG sprite (無 emoji)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

// γ.1：useTripSegments 會打 GET /api/trips/:id/segments，這個 test 套件 stub 全域
// fetch 驗 toolbar fetch 行為 — mock hook 回 empty 避免 segments fetch 干擾 fetchSpy。
vi.mock('../../src/hooks/useTripSegments', () => ({
  useTripSegments: () => ({ segments: [], segmentMap: new Map(), loading: false }),
}));

// v2.26.0: 編輯按鈕 navigate，mock useNavigate 驗 navigate 路徑
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// v2.29.x per-POI note cutover：inline 快速編輯 repoint 到 master stopPoi
// （sortOrder=1）的 per-POI note，缺 master 時停用。實務上 timeline entry 必有
// master stopPoi（mapDay 由它取得 entry.note），fixture 補上以反映真實資料。
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

describe('TimelineRail toolbar — pencil + ConfirmModal', () => {
  it('預設不展開 toolbar (no detail panel)', () => {
    renderRail();
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
  });

  it('click row → 展開 toolbar 含 3 個 action button (放大/編輯/刪除) — v2.31.92 移除 collapse + change-poi', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-lightbox-open-42')).toBeTruthy();
    // v2.26.0: 「編」testid 改為 timeline-rail-edit-N（取代 timeline-rail-edit-note-N）
    expect(screen.getByTestId('timeline-rail-edit-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-delete-42')).toBeTruthy();
    // v2.31.92：「收合」button 拿掉（row click 已 toggle expand/collapse）
    expect(screen.queryByTestId('timeline-rail-collapse-42')).toBeNull();
    // v2.31.92：「置換景點」button 拿掉（編輯景點已含 path）
    expect(screen.queryByTestId('timeline-rail-change-poi-42')).toBeNull();
  });

  it('pencil button click → navigate to EditEntryPage', () => {
    navigateSpy.mockClear();
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-edit-42'));
    expect(navigateSpy).toHaveBeenCalledWith('/trip/okinawa-2026/stop/42/edit');
  });

  it('inline note 編輯仍保留 — 點 tp-rail-note-value 觸發 textarea', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.queryByTestId('timeline-rail-note-input-42');
    expect(textarea).toBeTruthy();
  });

  it('delete button → 開 ConfirmModal (alertdialog)，不直接觸發 fetch', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-delete-42'));
    // ConfirmModal open
    expect(screen.queryByTestId('timeline-rail-delete-modal-42')).toBeTruthy();
    // 還沒 confirm → fetch 不該被打
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ConfirmModal 取消 button → modal 關閉，fetch 不被打', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-delete-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-delete-cancel-42'));
    expect(screen.queryByTestId('timeline-rail-delete-modal-42')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('toolbar icon button 全為 SVG sprite (無 emoji unicode)', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    const text = detail.textContent ?? '';
    const banned = ['🗑', '🔍', '⛶', '⎘', '⇅', '❤', '🚗', '📋', '✕', '✓'];
    for (const ch of banned) {
      expect(text.includes(ch)).toBe(false);
    }
  });
});
