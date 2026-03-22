import { useState, useEffect, useRef, useCallback } from 'react';

/* ===== Module-level callbacks for apiFetch integration ===== */
let _notifyOffline: (() => void) | null = null;
let _notifyOnline: (() => void) | null = null;

/**
 * Called by useOnlineStatus to register its internal update functions.
 * apiFetch uses reportFetchResult() to drive the same state machine.
 */
export function registerNetworkCallbacks(onOffline: () => void, onOnline: () => void) {
  _notifyOffline = onOffline;
  _notifyOnline = onOnline;
}

/**
 * Called by apiFetch after each request.
 * success=true  → signal online immediately
 * success=false → signal offline (debounced inside the hook)
 *
 * @internal — only call from useApi.ts apiFetch
 */
export function reportFetchResult(success: boolean) {
  if (success) {
    _notifyOnline?.();
  } else {
    _notifyOffline?.();
  }
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
    // Register callbacks so apiFetch can drive status updates
    registerNetworkCallbacks(
      () => updateStatus(false),
      () => updateStatus(true),
    );

    const goOnline = () => updateStatus(true);
    const goOffline = () => updateStatus(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

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
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Clear module-level callbacks on unmount
      _notifyOffline = null;
      _notifyOnline = null;
    };
  }, [updateStatus]);

  return isOnline;
}
