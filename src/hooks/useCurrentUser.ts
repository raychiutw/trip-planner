/**
 * useCurrentUser — V2-P1 fetch logged-in user from /api/oauth/userinfo
 *
 * Component 用此 hook 拿 current user 給 DesktopSidebar / TopBar 顯示 user chip。
 * 沒 session 時 user = null（401 → null）。Caller 必須保留 undefined loading
 * state，不要先當成未登入，避免 auth-dependent chrome flicker。
 *
 * 不快取 across navigation — useEffect fetch on mount。Future V2-P5 加 SWR-style
 * cache + revalidate（避免每頁 mount 都打 API）。
 *
 * 不依賴 React Query / SWR — keep dependency surface small。Vanilla useState/useEffect。
 */
import { useEffect, useState } from 'react';

export interface CurrentUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface UseCurrentUserResult {
  /** undefined = loading, null = unauthenticated, CurrentUser = logged in */
  user: CurrentUser | null | undefined;
  /** Re-fetch（after login / logout 用） */
  reload: () => void;
}

const USERINFO_ENDPOINT = '/api/oauth/userinfo';

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // v2.33.39 round 4: AbortController 取代 cancelled flag — 快速連 reload()
    // 時舊 in-flight 會被取消，slower-arrived response 不再覆蓋。
    const controller = new AbortController();
    fetch(USERINFO_ENDPOINT, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (!res.ok) {
          // 401 / 503 / etc. → 視為未登入
          setUser(null);
          return;
        }
        const data = (await res.json()) as CurrentUser;
        setUser(data);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setUser(null);
      });
    return () => {
      controller.abort();
    };
  }, [reloadCount]);

  return {
    user,
    reload: () => setReloadCount((n) => n + 1),
  };
}
