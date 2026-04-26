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

/* PR-Z 2026-04-26 重新設計
 * 對照 docs/design-sessions/terracotta-preview.html 的 list / row / badge /
 * btn pattern + DESIGN.md tokens 統一收齊風格。
 *
 * 修正三個 user 看到的問題：
 *   1. 「移除」 button 文字直排亂 → white-space: nowrap + min-width 64
 *   2. 「+ 新增」 button 看似 disabled → primary CTA filled，disabled 也保留
 *      accent fill（只降 opacity），不再 transparent 假象
 *   3. role pill 樣式單薄 → terracotta-preview .badge pattern（dot + bg color）
 */
const SCOPED_STYLES = `
.tp-collab-sheet {
  display: flex; flex-direction: column; gap: 20px;
  padding: 8px 16px 24px;
  max-width: 560px; margin: 0 auto;
}
.tp-collab-section {
  display: flex; flex-direction: column; gap: 10px;
}
.tp-collab-section-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-collab-section-count {
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: 0;
  text-transform: none;
}

.tp-collab-empty {
  padding: 24px 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  background: var(--color-secondary);
}

/* List container — single bordered group with dividers (terracotta-preview
 * .tp-list pattern from SessionsPage). 比 separate row cards 更 compact + 視覺
 * 統一感更強。 */
.tp-collab-list {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-collab-row {
  display: flex; align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
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
.tp-collab-row-body {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.tp-collab-row-email {
  font-size: var(--font-size-subheadline);
  font-weight: 600;
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
}
/* Badge — 對照 terracotta-preview .badge / .badge-info：bg rgba + accent
 * color + 6px dot。 */
.tp-collab-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-caption2);
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(217, 120, 72, 0.12);
  color: var(--color-accent-deep);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  align-self: flex-start;
}
.tp-collab-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}

/* 移除 button — 對照 terracotta-preview .btn-destructive ghost pattern。
 * white-space nowrap + min-width 64 修文字直排 bug。 */
.tp-collab-remove {
  appearance: none; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-destructive);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 6px 14px; border-radius: var(--radius-full);
  cursor: pointer;
  min-height: 32px;
  min-width: 64px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 120ms, border-color 120ms;
}
.tp-collab-remove:hover:not(:disabled) {
  background: var(--color-destructive-bg);
  border-color: var(--color-destructive);
}
.tp-collab-remove:focus-visible {
  outline: 2px solid var(--color-destructive); outline-offset: 2px;
}
.tp-collab-remove:disabled { opacity: 0.5; cursor: not-allowed; }

/* Add member input + button — primary CTA fill，disabled 保留 fill 只降 opacity
 * （不再 transparent 假象 disabled）。 */
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
}
.tp-collab-add-input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-collab-add-input::placeholder { color: var(--color-muted); }

.tp-collab-add-btn {
  border: none; cursor: pointer;
  background: var(--color-accent); color: var(--color-accent-foreground);
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  border-radius: var(--radius-md);
  padding: 0 18px;
  min-height: var(--spacing-tap-min);
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 6px;
  transition: filter 120ms;
}
.tp-collab-add-btn:hover:not(:disabled) { filter: brightness(var(--hover-brightness, 0.92)); }
.tp-collab-add-btn:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-collab-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  /* 不改 background 顏色 — disabled 仍然看得出是 primary CTA，只是 dimmer */
}
.tp-collab-add-btn .svg-icon { width: 14px; height: 14px; flex-shrink: 0; }

.tp-collab-hint {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  line-height: 1.55;
  margin: 0;
}
.tp-collab-hint strong { color: var(--color-foreground); font-weight: 700; }
`;

interface CollabSheetProps {
  /** Trip 主鍵；空字串表示尚未 resolve（例如 trip-select 未選），sheet 顯示 placeholder。 */
  tripId: string;
}

export default function CollabSheet({ tripId }: CollabSheetProps) {
  const tripIdRef = useRef(tripId);
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);

  const { permissions, permLoading, permError, loadPermissions } = usePermissions(
    tripIdRef as React.RefObject<string>,
  );
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

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
        showToast(`已新增 ${trimmed}`, 'success');
        setEmail('');
        loadPermissions(tripId);
        return;
      }
      if (r.status === 409) throw new Error('此 email 已有權限');
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
          <span>已授權成員</span>
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
          <div className="tp-collab-list">
            {permissions.map((p) => {
              const initial = p.email.charAt(0).toUpperCase() || '?';
              return (
                <div className="tp-collab-row" key={p.id} data-testid={`collab-row-${p.id}`}>
                  <div className="tp-collab-row-avatar" aria-hidden="true">{initial}</div>
                  <div className="tp-collab-row-body">
                    <span className="tp-collab-row-email">{p.email}</span>
                    <span className="tp-collab-badge" data-testid={`collab-role-${p.id}`}>
                      <span className="tp-collab-badge-dot" aria-hidden="true" />
                      {p.role}
                    </span>
                  </div>
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="tp-collab-section">
        <div className="tp-collab-section-head">新增成員</div>
        <div className="tp-collab-add">
          <input
            type="email"
            className="tp-collab-add-input"
            placeholder="email@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
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
