/**
 * AdminPage — V2 admin tooling (terracotta-preview parity).
 *
 * Route: /admin
 *
 * Wraps in AppShell + DesktopSidebarConnected + GlobalBottomNav so the
 * admin tooling sits inside the same V2 shell every other authed page uses.
 * Page-level styling follows tokens.css (terracotta), heading uses the
 * shared `.tp-page-heading` pattern from SessionsPage so both account-and-
 * admin pages feel like the same product.
 *
 * Admin gate: non-admin users redirect to /trips. Sidebar already hides the
 * 「管理」nav for non-admins; this is the second-line defense for direct
 * URL access.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/tokens.css';
import type { TripListItem } from '../types/trip';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { usePermissions } from '../hooks/usePermissions';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTripSelector } from '../hooks/useTripSelector';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { apiFetchRaw } from '../lib/apiClient';
import ToastContainer, { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';

/* V2 OAuth — useRequireAuth redirects to /login if no session. */

const SELECT_STYLE = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'%236F5A47\'%3E%3Cpath d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")',
  backgroundPosition: 'right 14px center',
} as const;

const SCOPED_STYLES = `
.tp-admin-shell {
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-admin-inner { max-width: 920px; margin: 0 auto; }

.tp-page-heading {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
}
.tp-page-heading-text { flex: 1 1 auto; }
.tp-page-heading-crumb {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin-bottom: 8px;
}
.tp-page-heading h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin: 0 0 6px;
}
.tp-page-heading p {
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0;
}

.tp-admin-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
  overflow: hidden;
}
.tp-admin-section-head {
  padding: 14px 20px 6px;
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-admin-section-body { padding: 0 20px 16px; }

.tp-admin-select {
  width: 100%;
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  background-repeat: no-repeat;
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-callout);
  padding: 10px 40px 10px 14px;
  min-height: var(--spacing-tap-min);
  cursor: pointer;
}
.tp-admin-select:hover { border-color: var(--color-accent); }
.tp-admin-select:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}

.tp-admin-perm-list {
  display: flex; flex-direction: column;
}
.tp-admin-perm-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--color-border);
}
.tp-admin-perm-row:last-child { border-bottom: none; }
.tp-admin-perm-row .email {
  flex: 1 1 auto; min-width: 0;
  font-size: var(--font-size-body);
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-admin-perm-row .role {
  display: inline-flex; padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption2); font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--color-accent-subtle); color: var(--color-accent);
  border: 1px solid var(--color-accent);
}
.tp-admin-perm-remove {
  appearance: none; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-destructive);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 6px 12px; border-radius: var(--radius-full);
  cursor: pointer; min-height: 32px;
}
.tp-admin-perm-remove:hover { background: var(--color-destructive-bg); border-color: var(--color-destructive); }
.tp-admin-perm-remove:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-admin-empty {
  padding: 16px 4px;
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  text-align: center;
}

.tp-admin-add {
  display: flex; gap: 8px; align-items: stretch;
  padding-top: 8px;
}
.tp-admin-add input {
  flex: 1 1 auto; min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-callout);
  padding: 10px 14px;
  min-height: var(--spacing-tap-min);
}
.tp-admin-add input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-admin-add input::placeholder { color: var(--color-muted); }
.tp-admin-add button {
  border: none; cursor: pointer;
  background: var(--color-accent); color: var(--color-accent-foreground);
  font: inherit; font-weight: 700; font-size: var(--font-size-callout);
  border-radius: var(--radius-full);
  padding: 0 22px;
  min-height: var(--spacing-tap-min);
  white-space: nowrap;
}
.tp-admin-add button:hover:not(:disabled) { filter: brightness(var(--hover-brightness)); }
.tp-admin-add button:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-admin-banner {
  display: flex; gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline); line-height: 1.5;
  margin-top: 12px;
  background: var(--color-accent-subtle); color: var(--color-accent);
}
`;

export default function AdminPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  // Admin gate (defense-in-depth — sidebar nav already hides the link for
  // non-admins, but typing /admin in the URL bar should also bounce).
  useEffect(() => {
    if (!user) return;
    if (user.email !== 'lean.lean@gmail.com') {
      navigate('/trips', { replace: true });
    }
  }, [user, navigate]);
  useDarkMode();
  const isOnline = useOnlineStatus();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsError, setTripsError] = useState('');
  const [currentTripId, setCurrentTripId] = useState('');
  const [email, setEmail] = useState('');
  const [addingDisabled, setAddingDisabled] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useOfflineToast(isOnline);

  const { currentTripIdRef } = useTripSelector(currentTripId);
  const { permissions, permLoading, permError, loadPermissions } = usePermissions(
    currentTripIdRef as React.RefObject<string>,
  );

  useEffect(() => {
    let cancelled = false;
    async function loadTrips() {
      try {
        const r = await apiFetchRaw('/trips?all=1');
        if (!r.ok) throw new Error('無法載入行程');
        const data: TripListItem[] = await r.json();
        if (cancelled) return;
        setTrips(data);
        const savedTrip = lsGet<string>(LS_KEY_TRIP_PREF);
        if (savedTrip && data.some((t) => t.tripId === savedTrip)) {
          setCurrentTripId(savedTrip);
        }
      } catch {
        if (!cancelled) setTripsError('無法載入行程');
      }
    }
    void loadTrips();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (currentTripId) loadPermissions(currentTripId);
  }, [currentTripId, loadPermissions]);

  function handleTripChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tripId = e.target.value;
    setCurrentTripId(tripId);
    if (tripId) lsSet(LS_KEY_TRIP_PREF, tripId);
  }

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    const tripId = currentTripIdRef.current;
    if (!trimmed || !tripId) return;
    setAddingDisabled(true);
    try {
      const r = await apiFetchRaw('/permissions', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, tripId, role: 'member' }),
      });
      if (r.status === 201) {
        const body = (await r.json()) as Record<string, unknown>;
        if (body._accessSyncFailed) {
          showToast(`已新增 ${trimmed}（Access policy 需手動加入）`, 'error', 5000);
        } else {
          showToast(`已新增 ${trimmed}`, 'success');
        }
        setEmail('');
        if (currentTripIdRef.current) loadPermissions(currentTripIdRef.current);
        return;
      }
      if (r.status === 409) throw new Error('此 email 已有權限');
      if (r.status === 403) throw new Error('僅管理者可操作');
      const data = await r.json().catch(() => null);
      const errObj = data?.error;
      const errMsg = typeof errObj === 'string' ? errObj
        : errObj?.message ?? errObj?.detail ?? '新增失敗';
      throw new Error(errMsg);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setAddingDisabled(false);
    }
  }

  async function handleRemove(id: number, permEmail: string) {
    if (!window.confirm(`確定移除 ${permEmail} 的權限？`)) return;
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
      if (currentTripIdRef.current) loadPermissions(currentTripIdRef.current);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleAdd();
  }

  const main = (
    <>
      <style>{SCOPED_STYLES}</style>
      <ToastContainer />
      <div className="tp-admin-shell" data-testid="admin-page">
        <div className="tp-admin-inner">
          <div className="tp-page-heading">
            <div className="tp-page-heading-text">
              <div className="tp-page-heading-crumb">管理</div>
              <h1>權限管理</h1>
              <p>選定行程，管理可瀏覽與編輯的成員。</p>
            </div>
          </div>

          {/* Section: Trip Select */}
          <section className="tp-admin-section" data-testid="admin-section-trip">
            <div className="tp-admin-section-head">選擇行程</div>
            <div className="tp-admin-section-body">
              <select
                className="tp-admin-select"
                style={SELECT_STYLE}
                aria-label="選擇行程"
                value={currentTripId}
                onChange={handleTripChange}
                data-testid="admin-trip-select"
              >
                {tripsError ? (
                  <option value="">{tripsError}</option>
                ) : trips.length === 0 ? (
                  <option value="">載入中...</option>
                ) : (
                  <>
                    <option value="">— 選擇行程 —</option>
                    {trips.map((t) => {
                      const label = t.name || t.tripId;
                      const prefix = t.published === 0 ? '(已下架) ' : '';
                      return (
                        <option key={t.tripId} value={t.tripId}>{prefix + label}</option>
                      );
                    })}
                  </>
                )}
              </select>
            </div>
          </section>

          {/* Section: Permissions list */}
          <section className="tp-admin-section" data-testid="admin-section-perms">
            <div className="tp-admin-section-head">已授權成員</div>
            <div className="tp-admin-section-body">
              {!currentTripId && <div className="tp-admin-empty">請先選擇行程</div>}
              {currentTripId && permLoading && <div className="tp-admin-empty">載入中…</div>}
              {currentTripId && !permLoading && permError && (
                <div className="tp-admin-empty" role="alert">{permError}</div>
              )}
              {currentTripId && !permLoading && !permError && permissions.length === 0 && (
                <div className="tp-admin-empty">尚未授權任何成員</div>
              )}
              {currentTripId && !permLoading && !permError && permissions.length > 0 && (
                <div className="tp-admin-perm-list">
                  {permissions.map((p) => (
                    <div className="tp-admin-perm-row" key={p.id}>
                      <span className="email">{p.email}</span>
                      <span className="role">{p.role}</span>
                      <button
                        type="button"
                        className="tp-admin-perm-remove"
                        aria-label={`移除 ${p.email}`}
                        disabled={removingId === p.id}
                        onClick={() => handleRemove(p.id, p.email)}
                        data-testid={`admin-perm-remove-${p.id}`}
                      >
                        {removingId === p.id ? '移除中…' : '移除'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section: Add member */}
          <section className="tp-admin-section" data-testid="admin-section-add">
            <div className="tp-admin-section-head">新增成員</div>
            <div className="tp-admin-section-body">
              <div className="tp-admin-add">
                <input
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  data-testid="admin-add-email"
                />
                <button
                  type="button"
                  disabled={addingDisabled || !currentTripId || !email.trim()}
                  onClick={handleAdd}
                  data-testid="admin-add-submit"
                >
                  {addingDisabled ? '新增中…' : '新增'}
                </button>
              </div>
              {!currentTripId && (
                <div className="tp-admin-banner">先在上方選擇行程，再加入成員 email。</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
