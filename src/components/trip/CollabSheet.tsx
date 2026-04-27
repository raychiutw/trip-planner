/**
 * CollabSheet — 共編設定 sheet（V2-P7 PR-O）。
 *
 * 取代「sidebar 管理 → /admin」 IA：每個行程在 OverflowMenu 內提供「共編」入口，
 * 開出此 sheet 管理該 trip 的 trip_permissions 列表。
 *
 * 權限：
 *   - 一般 user：只能管自己 owner = 自己 email 的行程
 *   - admin（lean.lean@gmail.com）：對所有行程都可
 *
 * API 由 functions/api/permissions.ts 的 ensureCanManageTripPerms() 統一驗。
 * 非 owner / 非 admin 打 GET/POST/DELETE 會收到 403 PERM_ADMIN_ONLY。
 */
import React, { useEffect, useRef, useState } from 'react';
import { apiFetchRaw } from '../../lib/apiClient';
import { usePermissions } from '../../hooks/usePermissions';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';

/* PR-GG 2026-04-26 重新設計
 * 對照 docs/design-sessions/terracotta-preview.html 的 .btn-primary /
 * .btn-destructive / .badge pattern + SessionsPage `.tp-list` row layout。
 *
 * 修正 user 截圖三個問題：
 *   1. 「移除」 button 文字直排亂 → 統一 .btn-destructive ghost：transparent
 *      bg + destructive border + nowrap，把 row 改為單行 flex 不再 column 包，
 *      避免 row body 撐高把按鈕擠窄。
 *   2. 「新增」 button 看似 disabled → .btn-primary：實心 accent 填色 + accent
 *      foreground 對比文字，disabled 只調 opacity 不換色，活躍狀態一眼可辨。
 *   3. role pill 跟 row 沒對齊 → pill 改放 email 同一行（inline）；avatar /
 *      email / pill / action 四欄 align-items: center 對齊在同一條基線。
 */
const SCOPED_STYLES = `
.tp-collab-sheet {
  display: flex; flex-direction: column; gap: 24px;
  padding: 8px 16px 24px;
  max-width: 560px; margin: 0 auto;
}

.tp-collab-hint {
  font-size: var(--font-size-subheadline);
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
  font-size: var(--font-size-subheadline);
  font-weight: 600;
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
  min-width: 0;
}

/* ===== Role badge — terracotta-preview .badge pattern ===== */
.tp-collab-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-caption);
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
  flex-shrink: 0;
  white-space: nowrap;
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

/* ===== Remove button — terracotta-preview .btn-destructive ghost ===== */
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

/* ===== Add member input + button — primary CTA fill ===== */
.tp-collab-add {
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
.tp-collab-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  /* 仍然保留實心 accent 色 — 一眼可辨是 primary CTA，只是 dimmer */
}
.tp-collab-add-btn .svg-icon { width: 14px; height: 14px; flex-shrink: 0; }

/* ===== Mobile tweaks ===== */
@media (max-width: 480px) {
  .tp-collab-row { padding: 12px 14px; gap: 10px; }
  .tp-collab-row-avatar { width: 32px; height: 32px; font-size: var(--font-size-footnote); }
}
`;

interface CollabSheetProps {
  /** Trip 主鍵；空字串表示尚未 resolve（例如 trip-select 未選），sheet 顯示 placeholder。 */
  tripId: string;
}

export default function CollabSheet({ tripId }: CollabSheetProps) {
  const tripIdRef = useRef(tripId);
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);

  const { permissions, pendingInvitations, permLoading, permError, loadPermissions } = usePermissions(
    tripIdRef as React.RefObject<string>,
  );
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) loadPermissions(tripId);
  }, [tripId, loadPermissions]);

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !tripId) return;
    setAdding(true);
    try {
      const r = await apiFetchRaw('/permissions', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, tripId, role: 'member' }),
      });
      if (r.status === 201) {
        const data = await r.json().catch(() => null) as { status?: string } | null;
        const successMsg = data?.status === 'invitation_sent'
          ? `邀請信已寄至 ${trimmed}`
          : `已新增 ${trimmed}`;
        showToast(successMsg, 'success');
        setEmail('');
        loadPermissions(tripId);
        return;
      }
      if (r.status === 409) {
        // 兩條分支都可能 409：trip_permissions UNIQUE 衝突 vs trip_invitations 重邀
        // server 回的 message 已區分，讀進來顯示比 hardcode 準確
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

  async function handleRemove(id: number, permEmail: string) {
    if (!window.confirm(`確定移除 ${permEmail} 的共編權限？`)) return;
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
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevokeInvite(invitedEmail: string) {
    if (!window.confirm(`確定撤銷對 ${invitedEmail} 的邀請？`)) return;
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
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRevokingEmail(null);
    }
  }

  if (!tripId) {
    return (
      <div className="tp-collab-sheet" data-testid="collab-sheet">
        <style>{SCOPED_STYLES}</style>
        <div className="tp-collab-empty">請先選擇行程</div>
      </div>
    );
  }

  return (
    <div className="tp-collab-sheet" data-testid="collab-sheet">
      <style>{SCOPED_STYLES}</style>

      <p className="tp-collab-hint">
        共編成員可<strong>檢視與編輯</strong>此行程。輸入對方的 email，他們下次登入時就會在自己的行程列表看到。
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
          <div className="tp-collab-empty">尚未授權任何成員，可在下方新增。</div>
        )}
        {!permLoading && !permError && permissions.length > 0 && (
          <div className="tp-collab-list" role="list">
            {permissions.map((p) => {
              const initial = p.email.charAt(0).toUpperCase() || '?';
              const isOwner = p.role === 'owner';
              const badgeClass = isOwner ? 'tp-collab-badge-owner' : 'tp-collab-badge-member';
              const badgeLabel = isOwner ? '擁有者' : '共編成員';
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
                    <span
                      className={`tp-collab-badge ${badgeClass}`}
                      data-testid={`collab-role-${p.id}`}
                    >
                      <span className="tp-collab-badge-dot" aria-hidden="true" />
                      {badgeLabel}
                    </span>
                  </div>
                  {/* Owner 不可被移除（含自己），不渲染按鈕，留空對齊。 */}
                  {!isOwner && (
                    <button
                      type="button"
                      className="tp-collab-remove"
                      aria-label={`移除 ${p.email}`}
                      disabled={removingId === p.id}
                      onClick={() => handleRemove(p.id, p.email)}
                      data-testid={`collab-remove-${p.id}`}
                    >
                      {removingId === p.id ? '移除中…' : '移除'}
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
                    onClick={() => void handleRevokeInvite(inv.invitedEmail)}
                    data-testid={`pending-revoke-${inv.invitedEmail}`}
                  >
                    {revokingEmail === inv.invitedEmail ? '撤銷中…' : '撤銷'}
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
      </section>
    </div>
  );
}
