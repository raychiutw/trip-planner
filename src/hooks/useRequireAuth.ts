/**
 * useRequireAuth — page-level auth guard for V2 self-served pages.
 *
 * Pre-V2 / pre-cutover: Cloudflare Access redirected unauthenticated users at
 * the edge before any SPA code ran. With CF Access removed, anonymous users can
 * land directly on /manage / /admin / settings pages — the SPA must redirect
 * them itself.
 *
 * Usage in a protected page:
 *
 *   export default function ManagePage() {
 *     useRequireAuth(); // redirects to /login?redirect_after=/manage if no session
 *     ...
 *   }
 *
 * The redirect preserves the intended destination via `?redirect_after=` so
 * `LoginPage` can navigate back after successful login.
 *
 * Returns the same shape as useCurrentUser for convenience — the protected
 * page can read `user` directly without a second hook call.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrentUser, type UseCurrentUserResult } from './useCurrentUser';

export function useRequireAuth(): UseCurrentUserResult {
  const result = useCurrentUser();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Wait for the userinfo probe to settle (undefined = still loading)
    if (result.user !== null) return;
    const redirectAfter = `${pathname}${search}`;
    navigate(`/login?redirect_after=${encodeURIComponent(redirectAfter)}`, { replace: true });
  }, [result.user, pathname, search, navigate]);

  return result;
}
