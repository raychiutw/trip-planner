/**
 * NewTripContext — global "+ 新增行程" entry, single source of truth.
 *
 * Why context (not per-page state): the entry shows up in DesktopSidebar
 * (every authed page), TripsListPage's trailing dashed card, and its empty
 * hero CTA. Wiring per page is fragile (most pages forgot to pass
 * onNewTrip and the button silently no-op'd). Context centralises the
 * navigation: any descendant calls useNewTrip().openModal() and gets
 * navigate('/trips/new').
 *
 * 2026-05-03 modal-to-fullpage migration: NewTripModal 已被
 * `src/pages/NewTripPage.tsx` 取代（route `/trips/new`）。Context 不再 mount
 * modal，只提供 navigation hook。API 名稱 `openModal` 為相容性保留
 * （many callers 已用 `openModal`），實際語意是「開啟新增行程介面」。
 */
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface NewTripContextValue {
  /** 開啟新增行程介面（v2 後 navigate 到 /trips/new page，不再 modal）。 */
  openModal: () => void;
}

const NewTripContext = createContext<NewTripContextValue>({ openModal: () => {} });

export function useNewTrip(): NewTripContextValue {
  return useContext(NewTripContext);
}

export function NewTripProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const openModal = useCallback(() => {
    navigate('/trips/new');
  }, [navigate]);

  return (
    <NewTripContext.Provider value={{ openModal }}>
      {children}
    </NewTripContext.Provider>
  );
}
