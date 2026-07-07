/**
 * TripCardMenu「行程筆記」menu item regression test — v2.34.x 行程筆記 PR19
 *
 * Covers PR14:
 *   - menu item renders when onNotes provided
 *   - menu item does NOT render when onNotes omitted
 *   - click → onNotes(tripId) called + menu closes
 *   - testid pattern trip-card-menu-notes-${tripId} exists
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TripCardMenu from '../../src/components/trip/TripCardMenu';

beforeEach(() => {
  cleanup();
});

function openMenu(tripId = 'trip-1') {
  // The trigger button uses testid pattern based on the dropdown id
  const trigger = screen.getAllByRole('button').find((btn) => {
    return btn.getAttribute('aria-label')?.includes('開啟') || btn.querySelector('svg');
  });
  if (trigger) fireEvent.click(trigger);
}

describe('TripCardMenu — onNotes prop (PR14)', () => {
  const baseProps = {
    tripId: 'trip-1',
    onCollab: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders 行程筆記 menu item when onNotes provided', () => {
    const onNotes = vi.fn();
    render(<TripCardMenu {...baseProps} onNotes={onNotes} />);
    openMenu();
    expect(screen.getByTestId('trip-card-menu-notes-trip-1')).toBeInTheDocument();
    expect(screen.getByText('行程筆記')).toBeInTheDocument();
  });

  it('does NOT render 行程筆記 menu item when onNotes omitted', () => {
    render(<TripCardMenu {...baseProps} />);
    openMenu();
    expect(screen.queryByTestId('trip-card-menu-notes-trip-1')).toBeNull();
    expect(screen.queryByText('行程筆記')).toBeNull();
  });

  it('click 行程筆記 → onNotes(tripId) called', () => {
    const onNotes = vi.fn();
    render(<TripCardMenu {...baseProps} onNotes={onNotes} />);
    openMenu();
    fireEvent.click(screen.getByTestId('trip-card-menu-notes-trip-1'));
    expect(onNotes).toHaveBeenCalledWith('trip-1');
  });

  it('menu items order: 編輯 / 共編 / 行程筆記 / 刪除', () => {
    const onNotes = vi.fn();
    render(<TripCardMenu {...baseProps} onNotes={onNotes} />);
    openMenu();
    const menuItems = screen.getAllByRole('menuitem');
    const labels = menuItems.map((el) => el.textContent ?? '');
    expect(labels.findIndex((l) => l.includes('編輯行程'))).toBeLessThan(labels.findIndex((l) => l.includes('共編設定')));
    expect(labels.findIndex((l) => l.includes('共編設定'))).toBeLessThan(labels.findIndex((l) => l.includes('行程筆記')));
    expect(labels.findIndex((l) => l.includes('行程筆記'))).toBeLessThan(labels.findIndex((l) => l.includes('刪除行程')));
  });
});
