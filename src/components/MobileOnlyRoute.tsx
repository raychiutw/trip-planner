/**
 * MobileOnlyRoute — render children only on viewport ≤ 1023px; redirect otherwise.
 *
 * v2.31.94 custom-stop-location-picker. Used by AddCustomStopPage's mobile-only
 * route; desktop traffic falls back to AddStopPage's 自訂 tab via inline picker.
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const MOBILE_QUERY = '(max-width: 1023px)';

function isMobile(): boolean {
  // SSR / no-matchMedia env → assume desktop (safer redirect, avoids
  // showing mobile UI to desktop users on first paint).
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export interface MobileOnlyRouteProps {
  fallbackPath: string;
  children: React.ReactNode;
}

export function MobileOnlyRoute({ fallbackPath, children }: MobileOnlyRouteProps) {
  const [mobile, setMobile] = useState(isMobile);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const handler = (ev: MediaQueryListEvent) => setMobile(ev.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (!mobile) return <Navigate to={fallbackPath} replace />;
  return <>{children}</>;
}
