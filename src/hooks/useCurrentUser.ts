/**
 * useCurrentUser — V2-P1 fetch logged-in user from /api/oauth/userinfo
 *
 * Component 用此 hook 拿 current user 給 DesktopSidebar / TopBar 顯示 user chip。
 * 沒 session 時 user = null（401 → null），方便 caller render「登入」CTA。
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
    let cancelled = false;
    fetch(USERINFO_ENDPOINT, { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          // 401 / 503 / etc. → 視為未登入
          setUser(null);
          return;
        }
        const data = (await res.json()) as CurrentUser;
        setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  return {
    user,
    reload: () => setReloadCount((n) => n + 1),
  };
}
