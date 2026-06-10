import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Wrap a dynamic import with retry + reload fallback.
 *
 * After a deployment with new chunk hashes, users still running the old build
 * get a "Failed to fetch dynamically imported module" error because the old
 * chunk hash no longer exists on the CDN. This retries the import once, then
 * reloads the page to fetch fresh HTML with the new chunk references.
 *
 * The `lazyWithRetry_reloaded` sessionStorage key prevents infinite reload
 * loops — main.tsx clears it on every fresh load so each tab session gets a
 * fresh retry budget.
 *
 * Use this for EVERY `lazy(() => import(...))` call (route-level pages AND
 * component-level lazies like TripSheet / TpMap / TripMapRail), otherwise a
 * stale chunk surfaces as an uncaught error in Sentry instead of self-healing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<P = any>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
) {
  return lazy(() =>
    importFn().catch(
      () =>
        new Promise<{ default: ComponentType<P> }>((resolve, reject) => {
          // Retry once after a short delay
          setTimeout(() => {
            importFn()
              .then(resolve)
              .catch(() => {
                const key = 'lazyWithRetry_reloaded';
                if (!sessionStorage.getItem(key)) {
                  sessionStorage.setItem(key, '1');
                  window.location.reload();
                  // Return a never-resolving promise while reload happens
                  return;
                }
                // Already reloaded once — clear flag and surface the error
                sessionStorage.removeItem(key);
                reject(new Error('Failed to load module after retry and reload'));
              });
          }, 1500);
        }),
    ),
  );
}
