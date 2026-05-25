/**
 * networkBus.ts — leaf-layer pub/sub for network online/offline status.
 *
 * v2.33.54 round 10: extracted from `src/hooks/useOnlineStatus.ts` to break
 * the `lib → hooks` reverse import (apiClient.ts previously imported
 * `reportFetchResult` from a hook file).
 *
 * `lib/` is the architectural leaf — no React, no JSX, no hook imports.
 * Hooks subscribe to this bus; apiClient drives it.
 */

/**
 * v2.33.39 round 4: Set-based registry replaces single-slot — single-ref
 * last-mount-wins clobbers under StrictMode dev double-mount or when
 * multiple useOnlineStatus instances mount (admin overlay / devtools panel).
 */
const OFFLINE_SUBSCRIBERS = new Set<() => void>();
const ONLINE_SUBSCRIBERS = new Set<() => void>();

/**
 * Subscribe to network status changes (typically called by useOnlineStatus).
 * apiFetch drives the same state machine via reportFetchResult().
 *
 * Returns an unsubscribe function for cleanup.
 */
export function registerNetworkCallbacks(
  onOffline: () => void,
  onOnline: () => void,
): () => void {
  OFFLINE_SUBSCRIBERS.add(onOffline);
  ONLINE_SUBSCRIBERS.add(onOnline);
  return () => {
    OFFLINE_SUBSCRIBERS.delete(onOffline);
    ONLINE_SUBSCRIBERS.delete(onOnline);
  };
}

/**
 * Called by apiFetch after each request.
 * success=true  → signal online immediately
 * success=false → signal offline (debounced inside the hook)
 *
 * @internal — only call from apiClient.ts apiFetch / sse driver
 */
export function reportFetchResult(success: boolean): void {
  const subscribers = success ? ONLINE_SUBSCRIBERS : OFFLINE_SUBSCRIBERS;
  for (const cb of subscribers) cb();
}
