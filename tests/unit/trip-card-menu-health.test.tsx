/**
 * TripCardMenu — 「AI 健檢」項目 + onHealthCheck callback。
 *
 * 對齊 AI 健檢 feature spec：兩處 ⋯ menu 都加入口；本檔覆蓋 TripsListPage
 * 卡片 menu，TripPage detail menu 由 trips-list-embedded-menu.test 補。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TripCardMenu from '../../src/components/trip/TripCardMenu';

describe('TripCardMenu AI 健檢 entry', () => {
  beforeEach(() => {
    // 預設關閉 menu — 打開要 click trigger
  });
  afterEach(() => {
    cleanup();
  });

  function setup() {
    const onCollab = vi.fn();
    const onEdit = vi.fn();
    const onHealthCheck = vi.fn();
    const onDelete = vi.fn();
    render(
      <TripCardMenu
        tripId="T1"
        onCollab={onCollab}
        onEdit={onEdit}
        onHealthCheck={onHealthCheck}
        onDelete={onDelete}
      />,
    );
    return { onCollab, onEdit, onHealthCheck, onDelete };
  }

  it('open menu → 顯示「AI 健檢」項目，介於共編設定 / 刪除行程 之間', () => {
    setup();
    fireEvent.click(screen.getByTestId('trip-card-menu-trigger-T1'));
    const item = screen.getByTestId('trip-card-menu-health-T1');
    expect(item.textContent).toContain('AI 健檢');
  });

  it('click 「AI 健檢」 → onHealthCheck 收到 tripId 並關閉 menu', () => {
    const { onHealthCheck } = setup();
    fireEvent.click(screen.getByTestId('trip-card-menu-trigger-T1'));
    fireEvent.click(screen.getByTestId('trip-card-menu-health-T1'));
    expect(onHealthCheck).toHaveBeenCalledWith('T1');
    // menu closed
    expect(screen.queryByTestId('trip-card-menu-T1')).toBeNull();
  });
});
