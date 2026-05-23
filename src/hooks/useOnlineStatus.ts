import { useState, useEffect, useRef, useCallback } from 'react';

/* ===== Module-level subscriber registry =====
 * v2.33.39 round 4: 改 Set 取代 single-slot — 之前 single ref last-mount-wins
 * clobber，StrictMode dev double-mount 或多 instance（admin overlay / devtools
 * panel）下，第一個 hook 的 state machine 會被第二個 unmount 清空。 */
const offlineSubscribers = new Set<() => void>();
const onlineSubscribers = new Set<() => void>();

/**
 * Called by useOnlineStatus to register its internal update functions.
 * apiFetch uses reportFetchResult() to drive the same state machine.
 * Returns an unsubscribe function for cleanup.
 */
export function registerNetworkCallbacks(
  onOffline: () => void,
  onOnline: () => void,
): () => void {
  offlineSubscribers.add(onOffline);
  onlineSubscribers.add(onOnline);
  return () => {
    offlineSubscribers.delete(onOffline);
    onlineSubscribers.delete(onOnline);
  };
}

/**
 * Called by apiFetch after each request.
 * success=true  → signal online immediately
 * success=false → signal offline (debounced inside the hook)
 *
 * @internal — only call from useApi.ts apiFetch
 */
export function reportFetchResult(success: boolean) {
  const subscribers = success ? onlineSubscribers : offlineSubscribers;
  for (const cb of subscribers) cb();
}

/* ===== Hook ===== */

/**
 * Returns the current online status, combining three signals:
 *   1. navigator.onLine events  — instant but imprecise
 *   2. SW postMessage           — precise but may lag
 *   3. apiFetch result          — precise, driven by reportFetchResult()
 *
 * Going offline is debounced 3 s to prevent flicker on transient errors.
 * Going online is applied immediately.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateStatus = useCallback((online: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (online) {
      // Reconnected: apply immediately
      setIsOnline(true);
    } else {
      // Lost connection: wait 3 s before showing offline banner
      debounceRef.current = setTimeout(() => setIsOnline(false), 3000);
    }
  }, []);

  useEffect(() => {
    const onOffline = () => updateStatus(false);
    const onOnline = () => updateStatus(true);
    // Register callbacks so apiFetch can drive status updates。
    // registerNetworkCallbacks 回傳 unsubscribe 函式（Set-based registry）。
    const unsubscribe = registerNetworkCallbacks(onOffline, onOnline);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Listen for SW postMessage NETWORK_STATUS notifications
    const handleMessage = (event: MessageEvent) => {
      // Validate message source: must be a ServiceWorker, not a page/iframe/window
      if (event.source && !(event.source instanceof ServiceWorker)) return;
      if (event.data?.type === 'NETWORK_STATUS') {
        updateStatus(event.data.online as boolean);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubscribe();
    };
  }, [updateStatus]);

  return isOnline;
}
