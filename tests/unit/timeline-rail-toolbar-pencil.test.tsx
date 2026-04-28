/**
 * TimelineRail toolbar pencil + ConfirmModal — Section 4.5 (terracotta-mockup-parity-v2)
 *
 * 驗 expanded toolbar 含：
 *   - 放大檢視 button (lightbox open)
 *   - 編輯備註 pencil button (focus textarea data-testid `timeline-rail-edit-note-N`)
 *   - 刪除景點 button → 開 inline ConfirmModal (alertdialog)，不直接 fire DELETE
 *   - 收闔 button (x-mark icon)
 *   - icon 全為 SVG sprite (無 emoji)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

const ENTRY: TimelineEntryData = {
  id: 42,
  time: '11:30-14:00',
  title: '沖縄美ら海水族館',
  description: '世界第二大水族館。',
  note: '提前買票。',
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

  it('click row → 展開 toolbar 含 4 個 action button (放大/編輯/刪除/收闔)', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-lightbox-open-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-edit-note-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-delete-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-collapse-42')).toBeTruthy();
  });

  it('pencil button click → note 進 edit mode + textarea render', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-edit-note-42'));
    // pencil click 把 note 進 edit mode → textarea render
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
