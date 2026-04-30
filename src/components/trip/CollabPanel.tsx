/**
 * CollabPanel — 共編設定 panel body(v2.18.0 redesign)
 *
 * v2.17 之前是 CollabSheet 內嵌在 InfoSheet bottom-sheet 內,v2.18.0 升級成
 * 獨立 page(`/trip/:tripId/collab`),由 CollabPage wrap 進 AppShell。本 component
 * 只負責 panel body(hint / member list / pending list / add form),不含
 * TitleBar / sidebar / bottom-nav chrome。
 *
 * 變動 vs CollabSheet(v2.17):
 *   1. 新增 viewer role(3-tier:owner / member / viewer)
 *   2. Role chip 變成可點 dropdown(member ↔ viewer 切換,owner 不可改)
 *   3. 新增成員時可選 role(預設 member,可切 viewer)
 *   4. window.confirm → ConfirmModal styled dialog
 *   5. CSS class prefix 改 .tp-collab-panel(原 .tp-collab-sheet)
 */
import React, { useEffect, useRef, useState } from 'react';
import { apiFetchRaw } from '../../lib/apiClient';
import { usePermissions } from '../../hooks/usePermissions';
import type { CollabRole } from '../../types/api';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import ConfirmModal from '../shared/ConfirmModal';

type AddRole = 'member' | 'viewer';
type EditableRole = 'member' | 'viewer'; // 可由 owner 切換的 role

const SCOPED_STYLES = `
.tp-collab-panel {
  display: flex; flex-direction: column; gap: 24px;
  padding: 8px 16px 24px;
  max-width: 720px; margin: 0 auto;
}

.tp-collab-hint {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
  line-height: 1.55;
  margin: 0;
}
.tp-collab-hint strong { color: var(--color-foreground); font-weight: 600; }

.tp-collab-section {
  display: flex; flex-direction: column; gap: 12px;
}
.tp-collab-section-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
}
.tp-collab-section-title {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-collab-section-count {
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-muted);
}

.tp-collab-empty {
  padding: 28px 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  background: var(--color-secondary);
}

/* ===== Member list — single bordered group with dividers ===== */
.tp-collab-list {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-collab-row {
  display: flex; align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  min-height: 64px;
}
.tp-collab-row:last-child { border-bottom: none; }

.tp-collab-row-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  display: grid; place-items: center;
  font-size: var(--font-size-callout);
  font-weight: 700;
  flex-shrink: 0;
}

.tp-collab-row-main {
  flex: 1 1 auto; min-width: 0;
  display: flex; align-items: center; gap: 10px;
  flex-wrap: wrap;
}
.tp-collab-row-email {
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
  min-width: 0;
}

/* ===== Role badge / chip — 3 tiers ===== */
.tp-collab-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-caption);
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  white-space: nowrap;
  /* Static badge default; dropdown trigger overrides cursor below */
}
.tp-collab-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tp-collab-badge-owner {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.tp-collab-badge-owner .tp-collab-badge-dot {
  background: var(--color-success);
}
.tp-collab-badge-member {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-collab-badge-member .tp-collab-badge-dot {
  background: var(--color-accent);
}
.tp-collab-badge-viewer {
  background: var(--color-tertiary);
  color: var(--color-muted);
}
.tp-collab-badge-viewer .tp-collab-badge-dot {
  background: var(--color-muted);
}

/* Dropdown trigger button(member / viewer chip 點開可切角色) */
.tp-collab-badge-trigger {
  border: none;
  font: inherit;
  cursor: pointer;
  transition: filter 120ms;
}
.tp-collab-badge-trigger:hover { filter: brightness(0.96); }
.tp-collab-badge-trigger:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-collab-badge-trigger .tp-collab-badge-caret {
  font-size: 9px;
  opacity: 0.7;
  margin-left: -2px;
}

.tp-collab-role-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 4px;
  min-width: 200px;
  z-index: 30;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-collab-role-option {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  border-radius: var(--radius-sm);
  color: var(--color-foreground);
}
.tp-collab-role-option:hover { background: var(--color-hover); }
.tp-collab-role-option.is-selected { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
.tp-collab-role-option .svg-icon { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
.tp-collab-role-option-body { display: flex; flex-direction: column; gap: 2px; }
.tp-collab-role-option-title {
  font-size: var(--font-size-footnote); font-weight: 700;
}
.tp-collab-role-option-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  line-height: 1.4;
}

.tp-collab-role-wrap { position: relative; }

/* ===== Remove button — destructive ghost ===== */
.tp-collab-remove {
  appearance: none;
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
  font: inherit;
  font-size: var(--font-size-footnote);
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  cursor: pointer;
  min-height: 32px;
  min-width: 64px;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 120ms;
}
.tp-collab-remove:hover:not(:disabled) {
  background: var(--color-destructive-bg);
}
.tp-collab-remove:focus-visible {
  outline: 2px solid var(--color-destructive); outline-offset: 2px;
}
.tp-collab-remove:disabled { opacity: 0.5; cursor: not-allowed; }

/* ===== Add form — input + role pills + CTA ===== */
.tp-collab-add {
  display: flex; flex-direction: column; gap: 10px;
}
.tp-collab-add-row {
  display: flex; gap: 8px; align-items: stretch;
}
.tp-collab-add-input {
  flex: 1 1 auto; min-width: 0;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-callout);
  padding: 10px 14px;
  min-height: var(--spacing-tap-min);
  transition: border-color 120ms, box-shadow 120ms;
}
.tp-collab-add-input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-collab-add-input::placeholder { color: var(--color-muted); }

.tp-collab-add-btn {
  appearance: none;
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  cursor: pointer;
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  border-radius: var(--radius-md);
  padding: 0 20px;
  min-height: var(--spacing-tap-min);
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: background 120ms, border-color 120ms;
}
.tp-collab-add-btn:hover:not(:disabled) {
  background: var(--color-accent-deep);
  border-color: var(--color-accent-deep);
}
.tp-collab-add-btn:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-collab-add-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.tp-collab-add-btn .svg-icon { width: 14px; height: 14px; flex-shrink: 0; }

/* Role selector (新增 form 內) */
.tp-collab-add-role-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
.tp-collab-add-role-label {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  font-weight: 600;
}
.tp-collab-add-role-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-caption);
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.tp-collab-add-role-pill:hover { border-color: var(--color-accent); }
.tp-collab-add-role-pill.is-selected {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-collab-add-role-pill .tp-collab-badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-muted);
}
.tp-collab-add-role-pill.is-selected .tp-collab-badge-dot { background: var(--color-accent); }

/* ===== Mobile tweaks ===== */
@media (max-width: 480px) {
  .tp-collab-row { padding: 12px 14px; gap: 10px; }
  .tp-collab-row-avatar { width: 32px; height: 32px; font-size: var(--font-size-footnote); }
  .tp-collab-add-row { flex-direction: column; }
  .tp-collab-add-btn { width: 100%; }
}
`;

const ROLE_BADGE_INFO: Record<CollabRole, { label: string; class: string }> = {
  owner:  { label: '擁有者',   class: 'tp-collab-badge-owner' },
  admin:  { label: '管理員',   class: 'tp-collab-badge-owner' }, // 視為 owner 同等
  member: { label: '共編成員', class: 'tp-collab-badge-member' },
  viewer: { label: '檢視成員', class: 'tp-collab-badge-viewer' },
};

const ROLE_DESCRIPTIONS: Record<EditableRole, string> = {
  member: '可檢視 + 編輯所有內容',
  viewer: '只可檢視,不能編輯',
};

export interface CollabPanelProps {
  /** Trip 主鍵;空字串表示尚未 resolve(例如 trip-select 未選),panel 顯示 placeholder。 */
  tripId: string;
}

export default function CollabPanel({ tripId }: CollabPanelProps) {
  const tripIdRef = useRef(tripId);
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);

  const { permissions, pendingInvitations, permLoading, permError, loadPermissions } = usePermissions(
    tripIdRef as React.RefObject<string>,
  );
  const [email, setEmail] = useState('');
  const [addRole, setAddRole] = useState<AddRole>('member');
  const [adding, setAdding] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; email: string } | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) loadPermissions(tripId);
  }, [tripId, loadPermissions]);

  // Click outside role menu to close
  useEffect(() => {
    if (openMenuId === null) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.tp-collab-role-wrap')) setOpenMenuId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !tripId) return;
    setAdding(true);
    try {
      const r = await apiFetchRaw('/permissions', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, tripId, role: addRole }),
      });
      if (r.status === 201) {
        const data = await r.json().catch(() => null) as { status?: string } | null;
        const successMsg = data?.status === 'invitation_sent'
          ? `邀請信已寄至 ${trimmed}`
          : `已新增 ${trimmed}`;
        showToast(successMsg, 'success');
        setEmail('');
        setAddRole('member');
        loadPermissions(tripId);
        return;
      }
      if (r.status === 409) {
        const data = await r.json().catch(() => null);
        const msg = data?.error?.message ?? '此 email 已有權限或 pending 邀請';
        throw new Error(msg);
      }
      if (r.status === 403) throw new Error('僅行程擁有者或管理者可操作');
      const data = await r.json().catch(() => null);
      const errObj = data?.error;
      const errMsg = typeof errObj === 'string' ? errObj
        : errObj?.message ?? errObj?.detail ?? '新增失敗';
      throw new Error(errMsg);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRole(id: number, newRole: EditableRole) {
    setOpenMenuId(null);
    setChangingRoleId(id);
    try {
      const r = await apiFetchRaw(`/permissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        const errObj = data?.error;
        const errMsg = typeof errObj === 'string' ? errObj
          : errObj?.message ?? errObj?.detail ?? '修改角色失敗';
        throw new Error(errMsg);
      }
      const labelMap: Record<EditableRole, string> = { member: '共編成員', viewer: '檢視成員' };
      showToast(`已改為${labelMap[newRole]}`, 'success');
      loadPermissions(tripId);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setChangingRoleId(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const { id, email: permEmail } = removeTarget;
    setRemovingId(id);
    try {
      const r = await apiFetchRaw(`/permissions/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        const errObj = data?.error;
        const errMsg = typeof errObj === 'string' ? errObj
          : errObj?.message ?? errObj?.detail ?? '移除失敗';
        throw new Error(errMsg);
      }
      showToast(`已移除 ${permEmail}`, 'success');
      loadPermissions(tripId);
      setRemoveTarget(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  async function confirmRevokeInvite() {
    if (!revokeTarget) return;
    const invitedEmail = revokeTarget;
    setRevokingEmail(invitedEmail);
    try {
      const r = await apiFetchRaw('/invitations/revoke', {
        method: 'POST',
        body: JSON.stringify({ tripId, email: invitedEmail }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        const errMsg = data?.error?.message ?? '撤銷失敗';
        throw new Error(errMsg);
      }
      showToast(`已撤銷對 ${invitedEmail} 的邀請`, 'success');
      loadPermissions(tripId);
      setRevokeTarget(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRevokingEmail(null);
    }
  }

  if (!tripId) {
    return (
      <div className="tp-collab-panel" data-testid="collab-panel">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-collab-empty">請先選擇行程</div>
      </div>
    );
  }

  return (
    <div className="tp-collab-panel" data-testid="collab-panel">
      <style>{SCOPED_STYLES}</style>

      <p className="tp-collab-hint">
        共編成員可<strong>檢視與編輯</strong>此行程,檢視成員只可<strong>檢視</strong>。輸入對方的 email,他們下次登入會在自己的行程列表看到。
      </p>

      <section className="tp-collab-section">
        <div className="tp-collab-section-head">
          <span className="tp-collab-section-title">已授權成員</span>
          {!permLoading && !permError && permissions.length > 0 && (
            <span className="tp-collab-section-count">{permissions.length} 人</span>
          )}
        </div>
        {permLoading && <div className="tp-collab-empty">載入中…</div>}
        {!permLoading && permError && (
          <div className="tp-collab-empty" role="alert">{permError}</div>
        )}
        {!permLoading && !permError && permissions.length === 0 && (
          <div className="tp-collab-empty">尚未授權任何成員,可在下方新增。</div>
        )}
        {!permLoading && !permError && permissions.length > 0 && (
          <div className="tp-collab-list" role="list">
            {permissions.map((p) => {
              const initial = p.email.charAt(0).toUpperCase() || '?';
              const isOwnerLike = p.role === 'owner' || p.role === 'admin';
              const badgeInfo = ROLE_BADGE_INFO[p.role];
              const editable = !isOwnerLike;
              const menuOpen = openMenuId === p.id;
              const isChanging = changingRoleId === p.id;
              return (
                <div
                  className="tp-collab-row"
                  key={p.id}
                  role="listitem"
                  data-testid={`collab-row-${p.id}`}
                >
                  <div className="tp-collab-row-avatar" aria-hidden="true">{initial}</div>
                  <div className="tp-collab-row-main">
                    <span className="tp-collab-row-email">{p.email}</span>
                    {editable ? (
                      <span className="tp-collab-role-wrap">
                        <button
                          type="button"
                          className={`tp-collab-badge ${badgeInfo.class} tp-collab-badge-trigger`}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          onClick={() => setOpenMenuId(menuOpen ? null : p.id)}
                          disabled={isChanging}
                          data-testid={`collab-role-trigger-${p.id}`}
                        >
                          <span className="tp-collab-badge-dot" aria-hidden="true" />
                          {isChanging ? '修改中…' : badgeInfo.label}
                          <span className="tp-collab-badge-caret" aria-hidden="true">▾</span>
                        </button>
                        {menuOpen && (
                          <div className="tp-collab-role-menu" role="menu">
                            {(['member', 'viewer'] as const).map((role) => {
                              const selected = p.role === role;
                              const info = ROLE_BADGE_INFO[role];
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={selected}
                                  className={`tp-collab-role-option ${selected ? 'is-selected' : ''}`}
                                  onClick={() => handleChangeRole(p.id, role)}
                                  data-testid={`collab-role-option-${p.id}-${role}`}
                                >
                                  <Icon name={selected ? 'check-circle' : 'circle-dot'} />
                                  <span className="tp-collab-role-option-body">
                                    <span className="tp-collab-role-option-title">{info.label}</span>
                                    <span className="tp-collab-role-option-helper">{ROLE_DESCRIPTIONS[role]}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </span>
                    ) : (
                      <span
                        className={`tp-collab-badge ${badgeInfo.class}`}
                        data-testid={`collab-role-${p.id}`}
                      >
                        <span className="tp-collab-badge-dot" aria-hidden="true" />
                        {badgeInfo.label}
                      </span>
                    )}
                  </div>
                  {editable && (
                    <button
                      type="button"
                      className="tp-collab-remove"
                      aria-label={`移除 ${p.email}`}
                      disabled={removingId === p.id}
                      onClick={() => setRemoveTarget({ id: p.id, email: p.email })}
                      data-testid={`collab-remove-${p.id}`}
                    >
                      移除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!permLoading && !permError && pendingInvitations.length > 0 && (
        <section className="tp-collab-section" data-testid="collab-pending-section">
          <div className="tp-collab-section-head">
            <span className="tp-collab-section-title">待接受邀請</span>
            <span className="tp-collab-section-count">{pendingInvitations.length} 人</span>
          </div>
          <div className="tp-collab-list" role="list">
            {pendingInvitations.map((inv) => {
              const initial = inv.invitedEmail.charAt(0).toUpperCase() || '?';
              return (
                <div
                  className="tp-collab-row"
                  key={inv.id}
                  role="listitem"
                  data-testid={`pending-row-${inv.invitedEmail}`}
                >
                  <div className="tp-collab-row-avatar" aria-hidden="true">{initial}</div>
                  <div className="tp-collab-row-main">
                    <span className="tp-collab-row-email">{inv.invitedEmail}</span>
                    <span className="tp-collab-badge tp-collab-badge-member">
                      <span className="tp-collab-badge-dot" aria-hidden="true" />
                      {inv.isExpired
                        ? '已過期'
                        : inv.daysRemaining > 0
                          ? `剩 ${inv.daysRemaining} 天`
                          : '今日到期'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="tp-collab-remove"
                    aria-label={`撤銷對 ${inv.invitedEmail} 的邀請`}
                    disabled={revokingEmail === inv.invitedEmail}
                    onClick={() => setRevokeTarget(inv.invitedEmail)}
                    data-testid={`pending-revoke-${inv.invitedEmail}`}
                  >
                    撤銷
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="tp-collab-section">
        <div className="tp-collab-section-head">
          <span className="tp-collab-section-title">新增成員</span>
        </div>
        <div className="tp-collab-add">
          <div className="tp-collab-add-row">
            <input
              type="email"
              className="tp-collab-add-input"
              placeholder="email@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
              aria-label="新成員的 email"
              data-testid="collab-add-email"
            />
            <button
              type="button"
              className="tp-collab-add-btn"
              disabled={adding || !email.trim()}
              onClick={handleAdd}
              data-testid="collab-add-submit"
            >
              <Icon name="plus" />
              <span>{adding ? '新增中…' : '新增'}</span>
            </button>
          </div>
          <div className="tp-collab-add-role-row">
            <span className="tp-collab-add-role-label">角色:</span>
            {(['member', 'viewer'] as const).map((role) => (
              <button
                key={role}
                type="button"
                className={`tp-collab-add-role-pill ${addRole === role ? 'is-selected' : ''}`}
                onClick={() => setAddRole(role)}
                data-testid={`collab-add-role-${role}`}
              >
                <span className="tp-collab-badge-dot" aria-hidden="true" />
                {ROLE_BADGE_INFO[role].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ConfirmModal
        open={!!removeTarget}
        title="移除共編成員"
        message={removeTarget ? `${removeTarget.email} 將失去此行程的存取權。確定移除?` : ''}
        confirmLabel="移除"
        busy={removingId !== null}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
      <ConfirmModal
        open={!!revokeTarget}
        title="撤銷邀請"
        message={revokeTarget ? `對 ${revokeTarget} 的邀請將失效,對方收到的邀請信點下後會看到「邀請已撤銷」。` : ''}
        confirmLabel="撤銷"
        busy={revokingEmail !== null}
        onConfirm={() => void confirmRevokeInvite()}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
