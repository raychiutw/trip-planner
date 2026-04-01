import { useState, useRef, useCallback } from 'react';
import { apiFetchRaw } from './useApi';
import type { Permission } from '../types/api';

interface UsePermissionsResult {
  permissions: Permission[];
  permLoading: boolean;
  permError: string;
  loadPermissions: (tripId: string) => Promise<void>;
}

/**
 * Manages permissions state for a given trip.
 * Uses currentTripIdRef to avoid stale-closure errors when aborting requests.
 */
export function usePermissions(currentTripIdRef: React.RefObject<string>): UsePermissionsResult {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const loadPermissions = useCallback(async (tripId: string) => {
    // 取消前一次未完成的請求
    abortRef.current?.abort();

    if (!tripId) {
      setPermissions([]);
      setPermError('');
      setPermLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setPermLoading(true);
    setPermError('');
    setPermissions([]);

    try {
      const r = await apiFetchRaw('/permissions?tripId=' + encodeURIComponent(tripId), {
        signal: controller.signal,
      });
      if (r.status === 401) throw new Error('未登入，請重新整理頁面');
      if (r.status === 403) throw new Error('僅管理者可操作');
      if (!r.ok) throw new Error('載入失敗');
      const perms: Permission[] = await r.json();
      // 用 ref 取最新值，避免 stale closure
      if (currentTripIdRef.current === tripId) {
        setPermissions(perms || []);
        setPermLoading(false);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (currentTripIdRef.current === tripId) {
        setPermError((err as Error).message);
        setPermLoading(false);
      }
    }
  }, [currentTripIdRef]);

  return { permissions, permLoading, permError, loadPermissions };
}
