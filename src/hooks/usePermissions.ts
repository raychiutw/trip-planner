import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { normalizeEmail } from '../server/email-utils';
import type { Permission } from '../types/api';

export interface PendingInvitation {
  id: string;
  invitedEmail: string;
  createdAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

type PermissionChange =
  | { kind: 'add'; email: string; role: 'member' | 'viewer' }
  | { kind: 'role'; id: number; role: 'member' | 'viewer' }
  | { kind: 'remove'; id: number; email: string }
  | { kind: 'revoke'; email: string };

/** Owns the trip's permission reads and acknowledged writes. A refresh failure
 * never turns a completed write into a failed command to be submitted again. */
export function usePermissions(tripId: string) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [permLoading, setPermLoading] = useState(Boolean(tripId));
  const [permError, setPermError] = useState('');
  const [invitationError, setInvitationError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const visitRef = useRef({ active: true, writing: false });

  const loadPermissions = useCallback(async () => {
    abortRef.current?.abort();
    if (!tripId) {
      setPermLoading(false); setPermError(''); setInvitationError('');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPermLoading(true);
    setPermError('');
    setInvitationError('');
    // Independent results: failure to read invitations is not an empty list.
    const [members, invitations] = await Promise.allSettled([
      (async () => {
        const response = await apiFetchRaw(`/permissions?tripId=${encodeURIComponent(tripId)}`, { signal: controller.signal });
        if (!response.ok) throw await ApiError.fromResponse(response);
        const data = await response.json();
        if (!Array.isArray(data) || data.some(p => !p || !Number.isInteger(p.id) || typeof p.email !== 'string' || p.tripId !== tripId || (p.displayName != null && typeof p.displayName !== 'string') || !['owner', 'member', 'viewer'].includes(p.role))) throw new Error('成員資料格式錯誤');
        return data as Permission[];
      })(),
      (async () => {
        const response = await apiFetchRaw(`/invitations?tripId=${encodeURIComponent(tripId)}`, { signal: controller.signal });
        if (!response.ok) throw await ApiError.fromResponse(response);
        const data = await response.json();
        if (!Array.isArray(data?.items) || data.items.some((p: PendingInvitation) => !p || typeof p.id !== 'string' || typeof p.invitedEmail !== 'string' || typeof p.daysRemaining !== 'number' || typeof p.isExpired !== 'boolean')) throw new Error('邀請資料格式錯誤');
        return data.items as PendingInvitation[];
      })(),
    ]);
    if (controller.signal.aborted) return;
    const denied = [members, invitations].some(r => r.status === 'rejected' && r.reason instanceof ApiError && [401, 403, 404].includes(r.reason.status));
    if (denied) {
      setAuthorized(false);
      setPermissions([]);
      setPendingInvitations([]);
      setPermError('目前無法管理此行程。只有行程擁有者可以管理旅伴；請確認登入帳號與行程。');
    } else {
      if (members.status === 'fulfilled') { setPermissions(members.value); setAuthorized(true); }
      else setPermError('無法更新成員清單，請重試；已顯示的清單可能不是最新資料。');
      if (invitations.status === 'fulfilled') setPendingInvitations(invitations.value);
      else setInvitationError('無法更新待接受邀請，請重試；已顯示的清單可能不是最新資料。');
    }
    setPermLoading(false);
  }, [tripId]);

  useEffect(() => {
    const visit = { active: true, writing: false };
    visitRef.current = visit;
    setPermissions([]); setPendingInvitations([]); setAuthorized(false);
    setBusy(false); setActionError(''); setNotice('');
    void loadPermissions();
    return () => { visit.active = false; abortRef.current?.abort(); };
  }, [loadPermissions]);

  const canManage = authorized && !permLoading && !permError && !invitationError;
  async function changePermission(change: PermissionChange): Promise<boolean> {
    const visit = visitRef.current;
    if (!tripId || !canManage || visit.writing || !visit.active) return false;
    visit.writing = true; setBusy(true); setActionError(''); setNotice('');
    let path: string;
    let method: string;
    let body: object | undefined;
    let success: string;
    switch (change.kind) {
      case 'add':
        path = '/permissions'; method = 'POST';
        body = { tripId, email: normalizeEmail(change.email), role: change.role };
        success = `已建立 ${normalizeEmail(change.email)} 的加入邀請／權限。請確認對方能開啟行程或收到邀請信。`;
        break;
      case 'role':
        path = `/permissions/${change.id}`; method = 'PATCH'; body = { role: change.role };
        success = `已改為${change.role === 'member' ? '共編成員' : '檢視成員'}`;
        break;
      case 'remove':
        path = `/permissions/${change.id}`; method = 'DELETE'; success = `已移除 ${change.email}`;
        break;
      case 'revoke':
        path = '/invitations/revoke'; method = 'POST'; body = { tripId, email: change.email };
        success = `已撤銷對 ${change.email} 的邀請`;
        break;
    }
    try {
      const response = await apiFetchRaw(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw await ApiError.fromResponse(response);
      const result = await response.json().catch(() => null);
      if (result?.ok !== true || (change.kind === 'add' && (response.status !== 201 || result.status !== 'invitation_sent'))
        || (change.kind === 'role' && result.role !== change.role && result.unchanged !== true)
        || (change.kind === 'revoke' && !(result.revoked > 0))) {
        throw new Error('未能確認操作結果，請先重新讀取清單確認，再決定是否重試。');
      }
      if (!visit.active) return false;
      setNotice(success);
      // Apply only facts acknowledged by the server; add's anti-enumeration
      // response does not say which list now owns the address, so refresh it.
      if (change.kind === 'remove') setPermissions(rows => rows.filter(p => p.id !== change.id));
      if (change.kind === 'role') setPermissions(rows => rows.map(p => p.id === change.id ? { ...p, role: change.role } : p));
      if (change.kind === 'revoke') setPendingInvitations(rows => rows.filter(p => p.invitedEmail !== change.email));
      void loadPermissions();
      return true;
    } catch (error) {
      if (!visit.active) return false;
      setActionError(error instanceof Error ? error.message : '操作失敗，請重試');
      if (error instanceof ApiError && [401, 403].includes(error.status)) setAuthorized(false);
      return false;
    } finally {
      if (visit.active) { visit.writing = false; setBusy(false); }
    }
  }

  return { permissions, pendingInvitations, permLoading, permError, invitationError, authorized, canManage, loadPermissions, busy, actionError, notice, changePermission };
}
