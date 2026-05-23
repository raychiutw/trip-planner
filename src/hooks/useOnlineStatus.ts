import { useState, useEffect, useRef, useCallback } from 'react';
// v2.33.54 round 10: pub/sub registry 拆到 src/lib/networkBus 解 lib→hooks
// reverse import（apiClient.ts 以前從這檔 import reportFetchResult）。
// 仍 re-export 給既有 caller 用，未來 callers 改 import lib/networkBus。
import { registerNetworkCallbacks, reportFetchResult } from '../lib/networkBus';

export { registerNetworkCallbacks, reportFetchResult };

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
