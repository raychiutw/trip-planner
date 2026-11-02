import { useState, useRef, useCallback } from 'react';
import { apiFetchRaw } from '../lib/apiClient';
import type { Permission } from '../types/api';

export interface PendingInvitation {
  /** token_hash from server — stable identifier for revoke; not the raw token */
  id: string;
  invitedEmail: string;
  createdAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

interface UsePermissionsResult {
  permissions: Permission[];
  pendingInvitations: PendingInvitation[];
  permLoading: boolean;
  permError: string;
  loadPermissions: (tripId: string) => Promise<void>;
}

/**
 * Manages permissions + pending invitations state for a given trip.
 * Uses currentTripIdRef to avoid stale-closure errors when aborting requests.
 *
 * V2 共編：同時 fetch /api/permissions (members) 與 /api/invitations?tripId (pending)
 * — 兩者一起 render 在 CollabSheet。Pending invitation 失敗不擋 members render。
 */
export function usePermissions(currentTripIdRef: React.RefObject<string>): UsePermissionsResult {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const loadPermissions = useCallback(async (tripId: string) => {
    abortRef.current?.abort();

    if (!tripId) {
      setPermissions([]);
      setPendingInvitations([]);
      setPermError('');
      setPermLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setPermLoading(true);
    setPermError('');
    setPermissions([]);
    setPendingInvitations([]);

    try {
      const [permsRes, invitesRes] = await Promise.all([
        apiFetchRaw('/permissions?tripId=' + encodeURIComponent(tripId), {
          signal: controller.signal,
        }),
        apiFetchRaw('/invitations?tripId=' + encodeURIComponent(tripId), {
          signal: controller.signal,
        }).catch(() => null), // pending fetch fail 不擋 members
      ]);

      if (permsRes.status === 401) throw new Error('未登入，請重新整理頁面');
      if (permsRes.status === 403) throw new Error('僅管理者可操作');
      if (!permsRes.ok) throw new Error('載入失敗');
      const perms: Permission[] = await permsRes.json();

      let invites: PendingInvitation[] = [];
      if (invitesRes && invitesRes.ok) {
        const data = await invitesRes.json() as { items: PendingInvitation[] };
        invites = data.items ?? [];
      }

      if (currentTripIdRef.current === tripId) {
        setPermissions(perms || []);
        setPendingInvitations(invites);
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

  return { permissions, pendingInvitations, permLoading, permError, loadPermissions };
}
