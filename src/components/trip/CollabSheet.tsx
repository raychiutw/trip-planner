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

const SCOPED_STYLES = `
.tp-collab-sheet {
  display: flex; flex-direction: column; gap: 16px;
  padding: 4px 16px 24px;
  max-width: 560px; margin: 0 auto;
}
.tp-collab-section {
  display: flex; flex-direction: column; gap: 8px;
}
.tp-collab-section-head {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-collab-empty {
  padding: 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
}
.tp-collab-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
}
.tp-collab-row .email {
  flex: 1 1 auto; min-width: 0;
  font-size: var(--font-size-body);
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-collab-row .role {
  display: inline-flex; padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2); font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--color-accent-subtle); color: var(--color-accent);
}
.tp-collab-remove {
  appearance: none; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-destructive);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 6px 12px; border-radius: var(--radius-full);
  cursor: pointer; min-height: 32px;
}
.tp-collab-remove:hover { background: var(--color-destructive-bg); border-color: var(--color-destructive); }
.tp-collab-remove:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-collab-add {
  display: flex; gap: 8px; align-items: stretch;
}
.tp-collab-add input {
  flex: 1 1 auto; min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-callout);
  padding: 10px 14px;
  min-height: var(--spacing-tap-min);
}
.tp-collab-add input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-collab-add input::placeholder { color: var(--color-muted); }
.tp-collab-add button {
  border: none; cursor: pointer;
  background: var(--color-accent); color: var(--color-accent-foreground);
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  border-radius: var(--radius-full);
  padding: 0 22px;
  min-height: var(--spacing-tap-min);
  white-space: nowrap;
  display: inline-flex; align-items: center; gap: 6px;
}
.tp-collab-add button:hover:not(:disabled) { filter: brightness(0.95); }
.tp-collab-add button:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-collab-hint {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  line-height: 1.5;
}
.tp-collab-hint strong { color: var(--color-foreground); }
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
        <div className="tp-collab-section-head">已授權成員</div>
        {permLoading && <div className="tp-collab-empty">載入中…</div>}
        {!permLoading && permError && (
          <div className="tp-collab-empty" role="alert">{permError}</div>
        )}
        {!permLoading && !permError && permissions.length === 0 && (
          <div className="tp-collab-empty">尚未授權任何成員</div>
        )}
        {!permLoading && !permError && permissions.length > 0 && (
          <div className="flex flex-col gap-2">
            {permissions.map((p) => (
              <div className="tp-collab-row" key={p.id} data-testid={`collab-row-${p.id}`}>
                <span className="email">{p.email}</span>
                <span className="role">{p.role}</span>
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
            ))}
          </div>
        )}
      </section>

      <section className="tp-collab-section">
        <div className="tp-collab-section-head">新增成員</div>
        <div className="tp-collab-add">
          <input
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            data-testid="collab-add-email"
          />
          <button
            type="button"
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
