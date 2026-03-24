import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import type { TripListItem } from '../types/trip';
import type { Permission } from '../types/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import TriplineLogo from '../components/shared/TriplineLogo';
import Toast from '../components/shared/Toast';

/* ===== Raw fetch helper (need status-code inspection) ===== */
function apiFetchRaw(path: string, opts?: RequestInit): Promise<Response> {
  return fetch('/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
}

/* ===== Status message state ===== */
interface StatusMsg {
  text: string;
  type: 'success' | 'error';
}

/* ===== Tailwind class constants ===== */
const SELECT_BG_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5l5 5 5-5' stroke='%236B6B6B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export default function AdminPage() {
  useDarkMode();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsError, setTripsError] = useState('');
  const [currentTripId, setCurrentTripId] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');
  const [email, setEmail] = useState('');
  const [addingDisabled, setAddingDisabled] = useState(false);
  const [addStatus, setAddStatus] = useState<StatusMsg | null>(null);

  const { showOffline, showReconnect } = useOfflineToast(isOnline);

  /* ===== Load Permissions ===== */
  const loadPermissions = useCallback(async (tripId: string) => {
    if (!tripId) {
      setPermissions([]);
      setPermError('');
      setPermLoading(false);
      return;
    }

    setPermLoading(true);
    setPermError('');
    setPermissions([]);

    try {
      const r = await apiFetchRaw('/permissions?tripId=' + encodeURIComponent(tripId));
      if (r.status === 403) throw new Error('僅管理者可操作');
      if (!r.ok) throw new Error('載入失敗');
      const perms: Permission[] = await r.json();
      // Only update if this tripId is still the selected one
      if (currentTripId === tripId) {
        setPermissions(perms || []);
        setPermLoading(false);
      }
    } catch (err) {
      if (currentTripId === tripId) {
        setPermError((err as Error).message);
        setPermLoading(false);
      }
    }
  }, [currentTripId]);

  /* ===== Load Trip List ===== */
  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      try {
        const r = await fetch('/api/trips?all=1');
        const data: TripListItem[] = await r.json();
        if (cancelled) return;
        setTrips(data);

        // Restore last selected trip from localStorage
        const savedTrip = lsGet<string>(LS_KEY_TRIP_PREF);
        if (savedTrip && data.some((t) => t.tripId === savedTrip)) {
          setCurrentTripId(savedTrip);
          loadPermissions(savedTrip);
        }
      } catch {
        if (!cancelled) setTripsError('無法載入行程');
      }
    }

    loadTrips();
    return () => { cancelled = true; };
  }, [loadPermissions]);

  /* ===== Trip Select Change ===== */
  function handleTripChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tripId = e.target.value;
    setCurrentTripId(tripId);
    setAddStatus(null);
    if (tripId) lsSet(LS_KEY_TRIP_PREF, tripId);
    loadPermissions(tripId);
  }

  /* ===== Add Permission ===== */
  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !currentTripId) return;

    setAddingDisabled(true);
    setAddStatus(null);

    try {
      const r = await apiFetchRaw('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmed,
          tripId: currentTripId,
          role: 'member',
        }),
      });

      if (r.status === 201) {
        await r.json();
        setAddStatus({ text: '已新增 ' + trimmed, type: 'success' });
        setEmail('');
        loadPermissions(currentTripId);
        return;
      }
      if (r.status === 409) throw new Error('此 email 已有權限');
      if (r.status === 403) throw new Error('僅管理者可操作');
      const data = await r.json();
      throw new Error(data.error || '新增失敗');
    } catch (err) {
      setAddStatus({ text: (err as Error).message, type: 'error' });
    } finally {
      setAddingDisabled(false);
    }
  }

  /* ===== Remove Permission ===== */
  async function handleRemove(id: number, permEmail: string) {
    if (!window.confirm('確定移除 ' + permEmail + ' 的權限？')) return;

    try {
      const r = await apiFetchRaw('/permissions/' + id, { method: 'DELETE' });
      if (!r.ok) throw new Error('移除失敗');
      loadPermissions(currentTripId);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  /* ===== Email input key handler ===== */
  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  /* ===== Close button ===== */
  function handleClose() {
    const tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    navigate(tripId ? `/trip/${tripId}` : '/');
  }

  /* ===== Render Permission Content ===== */
  function renderPermissions() {
    if (!currentTripId) {
      return (
        <div className="text-[var(--color-muted)] text-[length:var(--font-size-callout)] text-center py-6 px-4">
          請先選擇行程
        </div>
      );
    }
    if (permLoading) {
      return (
        <div className="text-[var(--color-muted)] text-[length:var(--font-size-callout)] text-center py-6 px-4">
          載入中…
        </div>
      );
    }
    if (permError) {
      return (
        <div className="text-[var(--color-muted)] text-[length:var(--font-size-callout)] text-center py-6 px-4">
          {permError}
        </div>
      );
    }
    if (permissions.length === 0) {
      return (
        <div className="text-[var(--color-muted)] text-[length:var(--font-size-callout)] text-center py-6 px-4">
          尚未授權任何成員
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        {permissions.map((p, idx) => (
          <div
            className={clsx(
              'flex items-center justify-between py-3 pr-4 transition-colors duration-150',
              'hover:bg-[var(--color-tertiary)]',
              idx < permissions.length - 1
                ? 'border-b border-[var(--color-border)] ml-4 pl-0'
                : 'pl-4'
            )}
            key={p.id}
          >
            <span className="text-[length:var(--font-size-body)] text-[var(--color-foreground)] flex-1 min-w-0 overflow-hidden text-ellipsis">
              {p.email}
            </span>
            <span className="text-[length:var(--font-size-caption2)] text-[var(--color-muted)] py-0.5 px-2 bg-[var(--color-tertiary)] rounded-[var(--radius-full)] mx-3 shrink-0">
              {p.role}
            </span>
            <button
              className="appearance-none border-0 bg-transparent text-[var(--color-muted)] cursor-pointer p-1 rounded-[var(--radius-sm)] flex items-center justify-center min-w-[var(--tap-min)] min-h-[var(--tap-min)] shrink-0 transition-colors duration-150 hover:text-[var(--color-destructive)] hover:bg-[var(--color-hover)]"
              aria-label="移除"
              onClick={() => handleRemove(p.id, p.email)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    );
  }

  /* ===== Trip Select Options ===== */
  function renderTripOptions() {
    if (tripsError) {
      return <option value="">{tripsError}</option>;
    }
    if (trips.length === 0) {
      return <option value="">載入中...</option>;
    }

    return (
      <>
        <option value="">-- 選擇行程 --</option>
        {trips.map((t) => {
          const label = t.name || t.tripId;
          const prefix = t.published === 0 ? '(已下架) ' : '';
          return (
            <option key={t.tripId} value={t.tripId}>
              {prefix + label}
            </option>
          );
        })}
      </>
    );
  }

  /* ----- page-simple class for admin page layout ----- */
  useEffect(() => {
    document.documentElement.classList.add('page-simple');
    document.body.classList.add('page-simple');
    return () => {
      document.documentElement.classList.remove('page-simple');
      document.body.classList.remove('page-simple');
    };
  }, []);

  return (
    <div>
      <div className="sticky-nav" id="stickyNav">
          <TriplineLogo isOnline={isOnline} />
          <span className="nav-title">權限管理</span>
          <button className="nav-close-btn" id="navCloseBtn" aria-label="關閉" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        {/* Toast notifications — conditionally rendered to avoid hidden DOM nodes */}
        {showOffline && (
          <Toast
            message="已離線 — 無法管理權限"
            icon="offline"
            visible={showOffline}
          />
        )}
        {showReconnect && (
          <Toast
            message="已恢復連線"
            icon="online"
            visible={showReconnect}
          />
        )}

        <main className={clsx('admin-main', !isOnline && 'offline-disabled')} id="adminMain">
          {/* admin-page */}
          <div className="pt-[var(--page-pt)] px-[var(--padding-h)] mx-auto md:max-w-[var(--page-max-w)]">

            {/* Section: Trip Select */}
            <div className="mb-7">
              <div className="text-[length:var(--font-size-caption)] font-medium text-[var(--color-muted)] uppercase tracking-[0.05em] mb-2 pl-4">
                選擇行程
              </div>
              <div className="bg-[var(--color-secondary)] rounded-[var(--radius-lg)] overflow-hidden">
                <select
                  className="w-full appearance-none border-0 bg-transparent text-[var(--color-foreground)] font-[inherit] text-[length:var(--font-size-body)] py-3 pl-4 pr-11 cursor-pointer bg-no-repeat transition-colors duration-150 hover:bg-[var(--color-tertiary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)] focus-visible:rounded-[var(--radius-lg)]"
                  style={{
                    backgroundImage: SELECT_BG_SVG,
                    backgroundPosition: 'right 16px center',
                  }}
                  aria-label="選擇行程"
                  value={currentTripId}
                  onChange={handleTripChange}
                >
                  {renderTripOptions()}
                </select>
              </div>
            </div>

            {/* Section: Permission List */}
            <div className="mb-7">
              <div className="text-[length:var(--font-size-caption)] font-medium text-[var(--color-muted)] uppercase tracking-[0.05em] mb-2 pl-4">
                已授權成員
              </div>
              <div className="bg-[var(--color-secondary)] rounded-[var(--radius-lg)] overflow-hidden">
                {renderPermissions()}
              </div>
            </div>

            {/* Section: Add Member */}
            <div className="mb-7">
              <div className="text-[length:var(--font-size-caption)] font-medium text-[var(--color-muted)] uppercase tracking-[0.05em] mb-2 pl-4">
                新增成員
              </div>
              <div className="bg-[var(--color-secondary)] rounded-[var(--radius-lg)] overflow-hidden">
                <div className="flex gap-2 p-2">
                  <input
                    type="email"
                    className="flex-1 border-0 bg-[var(--color-background)] text-[var(--color-foreground)] font-[inherit] text-[length:var(--font-size-body)] py-3 px-4 rounded-[var(--radius-md)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)]"
                    placeholder="email@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                  />
                  <button
                    className="appearance-none border-0 bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-[inherit] text-[length:var(--font-size-body)] font-semibold py-3 px-5 rounded-[var(--radius-md)] cursor-pointer whitespace-nowrap transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={addingDisabled}
                    onClick={handleAdd}
                  >
                    新增
                  </button>
                </div>
                <div aria-live="polite">
                  {addStatus && (
                    <div
                      className={clsx(
                        'text-[length:var(--font-size-footnote)] mt-2 pl-2 pb-2',
                        addStatus.type === 'success'
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-destructive)]'
                      )}
                    >
                      {addStatus.text}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
    </div>
  );
}
