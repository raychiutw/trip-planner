import { useState, useRef, useEffect } from 'react';

/**
 * Tracks online/offline transitions and surfaces two short-lived toast flags.
 *
 * - showOffline  – true for ~2 s after going offline
 * - showReconnect – true for ~2 s after coming back online
 */
export function useOfflineToast(isOnline: boolean): { showOffline: boolean; showReconnect: boolean } {
  const [showOffline, setShowOffline] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowOffline(true);
      const t = setTimeout(() => setShowOffline(false), 2000);
      return () => clearTimeout(t);
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setShowOffline(false);
      setShowReconnect(true);
      const t = setTimeout(() => setShowReconnect(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  return { showOffline, showReconnect };
}
