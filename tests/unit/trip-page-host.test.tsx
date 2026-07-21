/**
 * TripPageHost — owner 2026-07-21 回報 #2 修復核心：整個 app 只 render 一份
 * <TripPage>，掛在 <Routes> 之上，切換 /trips?selected=X ↔ /trip/:id/{edit|...}
 * 不應該讓它 unmount/remount（那就是 owner 講的「刷新第二欄」）。
 *
 * 用 mount-count 追蹤驗證：同一個 tripId 底下，路由在 /trips?selected=X 與
 * /trip/:id/edit 之間來回切換，<TripPage> 只該 mount 一次；換成不同 tripId
 * 才該重新 mount（這才是真的該重新抓資料的情況）。
 *
 * TripPageHost 內部用 lazyWithRetry 動態載入 TripPage（避免把 TripPage 的重
 * 依賴打進每一頁都會載的主 bundle，見 TripPageHost.tsx 註解），所以斷言要用
 * waitFor/findByTestId 等 Suspense resolve，不能假設同步出現。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import TripPageHost from '../../src/components/trip/TripPageHost';
import { TRIP_MAIN_PORTAL_ID } from '../../src/lib/tripStackRoutes';

let mockIsDesktop = true;
vi.mock('../../src/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockIsDesktop,
}));

const mountLog: string[] = [];
vi.mock('../../src/pages/TripPage', () => ({
  default: ({ tripId }: { tripId?: string }) => {
    useEffect(() => {
      mountLog.push(`mount:${tripId}`);
      return () => mountLog.push(`unmount:${tripId}`);
    }, [tripId]);
    return <div data-testid="mock-trip-page">{tripId}</div>;
  },
}));

function Nav({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button data-testid={`go-${to}`} onClick={() => navigate(to)}>{to}</button>;
}

function Host({ initialEntry }: { initialEntry: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <TripPageHost>
        <div id={TRIP_MAIN_PORTAL_ID} data-testid="portal-target" />
        <Nav to="/trips?selected=t1" />
        <Nav to="/trip/t1/edit" />
        <Nav to="/trip/t1/collab" />
        <Nav to="/trip/t2/edit" />
        <Nav to="/chat" />
        <Routes>
          <Route path="/trips" element={<div>trips list</div>} />
          <Route path="/trip/:tripId/edit" element={<div>edit</div>} />
          <Route path="/trip/:tripId/collab" element={<div>collab</div>} />
          <Route path="/chat" element={<div>chat</div>} />
        </Routes>
      </TripPageHost>
    </MemoryRouter>
  );
}

describe('TripPageHost — 桌機唯一 <TripPage> 實例，跨路由不 remount', () => {
  beforeEach(() => {
    mockIsDesktop = true;
    mountLog.length = 0;
  });

  it('桌機 /trips?selected=t1 → render <TripPage tripId="t1">', async () => {
    render(<Host initialEntry="/trips?selected=t1" />);
    expect((await screen.findByTestId('mock-trip-page')).textContent).toBe('t1');
    expect(mountLog).toEqual(['mount:t1']);
  });

  it('同一 tripId：/trips?selected=t1 → /trip/t1/edit → /trip/t1/collab 都不 remount', async () => {
    const { getByTestId } = render(<Host initialEntry="/trips?selected=t1" />);
    await screen.findByTestId('mock-trip-page');
    fireEvent.click(getByTestId('go-/trip/t1/edit'));
    fireEvent.click(getByTestId('go-/trip/t1/collab'));
    fireEvent.click(getByTestId('go-/trips?selected=t1'));
    await waitFor(() => expect(getByTestId('mock-trip-page')).toBeTruthy());
    expect(mountLog).toEqual(['mount:t1']); // 完全沒有 unmount/remount
  });

  it('切換到不同 tripId（t1 → t2）才會 remount（這是應該重新抓資料的情況）', async () => {
    const { getByTestId } = render(<Host initialEntry="/trip/t1/edit" />);
    await screen.findByTestId('mock-trip-page');
    fireEvent.click(getByTestId('go-/trip/t2/edit'));
    await waitFor(() => expect(mountLog).toEqual(['mount:t1', 'unmount:t1', 'mount:t2']));
  });

  it('離開 trip 相關頁（/chat）→ <TripPage> unmount，沒有殘留 render', async () => {
    const { getByTestId, queryByTestId } = render(<Host initialEntry="/trip/t1/edit" />);
    await screen.findByTestId('mock-trip-page');
    fireEvent.click(getByTestId('go-/chat'));
    await waitFor(() => expect(mountLog).toEqual(['mount:t1', 'unmount:t1']));
    expect(queryByTestId('mock-trip-page')).toBeNull();
  });

  it('手機（isDesktop=false）完全不 render <TripPage>（中欄概念只在桌機存在）', async () => {
    mockIsDesktop = false;
    const { queryByTestId } = render(<Host initialEntry="/trip/t1/edit" />);
    // 給 Suspense/lazy 一個 tick 的機會，確保「不出現」不是還沒 resolve 而是真的沒 render。
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mountLog).toEqual([]);
    expect(queryByTestId('mock-trip-page')).toBeNull();
  });

  it('非 trip 相關頁（/chat）一開始就不 render <TripPage>', async () => {
    const { queryByTestId } = render(<Host initialEntry="/chat" />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mountLog).toEqual([]);
    expect(queryByTestId('mock-trip-page')).toBeNull();
  });
});
