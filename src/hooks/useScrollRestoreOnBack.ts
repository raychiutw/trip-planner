/**
 * useScrollRestoreOnBack — restore scroll to a specific anchor when returning
 * via browser back button.
 *
 * When Page A navigates to Page B, it pushes history state with
 * `{ scrollAnchor: 'some-id' }`. When user hits back, Page A mounts with
 * location.state.scrollAnchor set; this hook scrolls the matching
 * [data-scroll-anchor="<id>"] element into view using useLayoutEffect +
 * requestAnimationFrame to avoid jank (double-paint).
 *
 *  Page A mount ──► check location.state.scrollAnchor
 *                       │
 *                       ├── match element with [data-scroll-anchor=X]
 *                       │       │
 *                       │       ├── rAF → scrollIntoView({ block: 'center' })
 *                       │       └── clear state so next remount doesn't re-scroll
 *                       │
 *                       └── no anchor → noop (default browser behavior)
 */

import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface ScrollAnchorState {
  scrollAnchor?: string;
}

export function useScrollRestoreOnBack(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const state = location.state as ScrollAnchorState | null;
    const anchor = state?.scrollAnchor;
    if (!anchor) return;

    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-scroll-anchor="${CSS.escape(anchor)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      // Clear state so refresh / forward nav doesn't re-scroll.
      // replace:true to avoid a new history entry.
      const { scrollAnchor: _unused, ...rest } = state ?? {};
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(rest).length ? rest : null });
    });

    return () => cancelAnimationFrame(raf);
    // Only run on mount / location.key change, not on every location mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}
