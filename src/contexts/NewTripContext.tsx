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
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface NewTripContextValue {
  /** 開啟新增行程介面（v2 後 navigate 到 /trips/new page，不再 modal）。 */
  openModal: () => void;
}

// v2.33.64 round 15: default 改 dev-mode warn + prod silent no-op。之前
// pure silent no-op 讓 caller outside provider 點 button 完全沒反應，bug 難 trace。
// Warning 在 dev 立刻暴露，prod 保留 graceful (避免 single missing provider 整 app 崩)。
const NewTripContext = createContext<NewTripContextValue | null>(null);

export function useNewTrip(): NewTripContextValue {
  const ctx = useContext(NewTripContext);
  if (ctx == null) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        '[useNewTrip] called outside <NewTripProvider> — openModal() will no-op. ' +
          'Wrap with <NewTripProvider> in src/entries/main.tsx.',
      );
    }
    return { openModal: () => {} };
  }
  return ctx;
}

export function NewTripProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const openModal = useCallback(() => {
    navigate('/trips/new');
  }, [navigate]);

  const value = useMemo<NewTripContextValue>(() => ({ openModal }), [openModal]);

  return (
    <NewTripContext.Provider value={value}>
      {children}
    </NewTripContext.Provider>
  );
}
