/**
 * 分享連結 entry in the trip action menus (v2.39.0).
 *
 * - TripCardMenu (行程一覽卡片 ⋯): renders 分享連結 when onShare provided, not when
 *   omitted; click → onShare(tripId).
 * - TripActionsMenu (行程頁右上角 ⋯, src/components/trip/TripActionsMenu.tsx,
 *   v2.57.x 抽出供 TripStackLayout 共用) + the host wiring
 *   (onShare on both menus + ShareLinkModal mount) — source-grep (rendering the
 *   embedded menu in isolation needs the whole page).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import TripCardMenu from '../../src/components/trip/TripCardMenu';

beforeEach(() => cleanup());

const baseProps = {
  tripId: 'trip-1',
  onCollab: vi.fn(),
  onEdit: vi.fn(),
  onHealthCheck: vi.fn(),
  onDelete: vi.fn(),
};

describe('TripCardMenu — 分享連結 entry', () => {
  it('renders 分享連結 when onShare provided + click calls onShare(tripId)', () => {
    const onShare = vi.fn();
    render(<TripCardMenu {...baseProps} onShare={onShare} />);
    fireEvent.click(screen.getByTestId('trip-card-menu-trigger-trip-1'));
    expect(screen.getByTestId('trip-card-menu-share-trip-1')).toBeInTheDocument();
    expect(screen.getByText('分享連結')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('trip-card-menu-share-trip-1'));
    expect(onShare).toHaveBeenCalledWith('trip-1');
  });

  it('does NOT render 分享連結 when onShare omitted', () => {
    render(<TripCardMenu {...baseProps} />);
    fireEvent.click(screen.getByTestId('trip-card-menu-trigger-trip-1'));
    expect(screen.queryByTestId('trip-card-menu-share-trip-1')).toBeNull();
  });
});

describe('TripActionsMenu wiring (source contracts)', () => {
  // v2.57.x: EmbeddedActionMenu 抽到 TripActionsMenu.tsx（供 TripStackLayout 共用），
  // menu item 本身斷言改讀該檔；call-site wiring 仍讀 TripsListPage.tsx。
  const menuSrc = readFileSync(join(__dirname, '..', '..', 'src/components/trip/TripActionsMenu.tsx'), 'utf8');
  const src = readFileSync(join(__dirname, '..', '..', 'src/pages/TripsListPage.tsx'), 'utf8');

  it('TripActionsMenu has a 分享連結 item (trip-embedded-menu-share testid)', () => {
    expect(menuSrc).toMatch(/trip-embedded-menu-share-/);
    expect(menuSrc).toMatch(/分享連結/);
  });

  it('wires onShare → setShareTripId on BOTH the card menu and the embedded menu', () => {
    expect(src).toMatch(/onShare=\{\(id\) => setShareTripId\(id\)\}/); // TripCardMenu
    expect(src).toMatch(/onShare=\{\(\) => setShareTripId\(effectiveSelectedId\)\}/); // EmbeddedActionMenu
  });

  it('mounts ShareLinkModal gated on shareTripId', () => {
    expect(src).toMatch(/import ShareLinkModal from/);
    expect(src).toMatch(/shareTripId && \(\s*<ShareLinkModal tripId=\{shareTripId\} open onClose/);
  });
});
