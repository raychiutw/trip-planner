import React, { useState, useEffect } from 'react';
import '../../css/tokens.css';
import type { TripListItem } from '../types/trip';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { usePermissions } from '../hooks/usePermissions';
import { useTripSelector } from '../hooks/useTripSelector';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';
import { apiFetchRaw } from '../lib/apiClient';
import PageNav from '../components/shared/PageNav';
import ToastContainer, { showToast } from '../components/shared/Toast';

/* Cloudflare Access 在 infrastructure 層處理認證，不需要 JS redirect */

/* ===== Chevron SVG as background-image for the select ===== */
const SELECT_STYLE = { backgroundImage:
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'%23888\'%3E%3Cpath d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")',
  backgroundPosition: 'right 16px center' } as const;

export default function AdminPage() {
  useDarkMode();
  const isOnline = useOnlineStatus();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsError, setTripsError] = useState('');
  const [currentTripId, setCurrentTripId] = useState('');
  const [email, setEmail] = useState('');
  const [addingDisabled, setAddingDisabled] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useOfflineToast(isOnline);

  /* ----- Shared trip selector hook ----- */
  const { currentTripIdRef } = useTripSelector(currentTripId);

  /* ----- Permissions hook ----- */
  const { permissions, permLoading, permError, loadPermissions } = usePermissions(
    currentTripIdRef as React.RefObject<string>,
  );

  /* ===== Load Trip List（mount only） ===== */
  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      try {
        const r = await apiFetchRaw('/trips?all=1');
        if (!r.ok) throw new Error('無法載入行程');
        const data: TripListItem[] = await r.json();
        if (cancelled) return;
        setTrips(data);

        // Restore last selected trip from localStorage
        const savedTrip = lsGet<string>(LS_KEY_TRIP_PREF);
        if (savedTrip && data.some((t) => t.tripId === savedTrip)) {
          setCurrentTripId(savedTrip);
        }
      } catch {
        if (!cancelled) setTripsError('無法載入行程');
      }
    }

    loadTrips();
    return () => { cancelled = true; };
  }, []);

  /* ===== Load Permissions when trip changes ===== */
  useEffect(() => {
    if (currentTripId) loadPermissions(currentTripId);
  }, [currentTripId, loadPermissions]);

  /* ===== Trip Select Change ===== */
  function handleTripChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tripId = e.target.value;
    setCurrentTripId(tripId);
    if (tripId) lsSet(LS_KEY_TRIP_PREF, tripId);
    // permissions 會透過 useEffect[currentTripId] 自動載入
  }

  /* ===== Add Permission ===== */
  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    const tripId = currentTripIdRef.current;
    if (!trimmed || !tripId) return;

    setAddingDisabled(true);

    try {
      const r = await apiFetchRaw('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmed,
          tripId,
          role: 'member',
        }),
      });

      if (r.status === 201) {
        const body = await r.json() as Record<string, unknown>;
        if (body._accessSyncFailed) {
          showToast('已新增 ' + trimmed + '（Access policy 需手動加入）', 'error', 5000);
        } else {
          showToast('已新增 ' + trimmed, 'success');
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

  /* ===== Remove Permission ===== */
  async function handleRemove(id: number, permEmail: string) {
    if (!window.confirm('確定移除 ' + permEmail + ' 的權限？')) return;

    setRemovingId(id);
    try {
      const r = await apiFetchRaw('/permissions/' + id, { method: 'DELETE' });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        const errObj = data?.error;
        const errMsg = typeof errObj === 'string' ? errObj
          : errObj?.message ?? errObj?.detail ?? '移除失敗';
        throw new Error(errMsg);
      }
      showToast('已移除 ' + permEmail, 'success');
      if (currentTripIdRef.current) loadPermissions(currentTripIdRef.current);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  /* ===== Email input key handler ===== */
  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  /* ===== Render Permission Content ===== */
  function renderPermissions() {
    if (!currentTripId) {
      return (
        <div className="text-muted text-callout text-center py-6 px-4">
          請先選擇行程
        </div>
      );
    }
    if (permLoading) {
      return (
        <div className="text-muted text-callout text-center py-6 px-4">
          載入中…
        </div>
      );
    }
    if (permError) {
      return (
        <div className="text-muted text-callout text-center py-6 px-4">
          {permError}
        </div>
      );
    }
    if (permissions.length === 0) {
      return (
        <div className="text-muted text-callout text-center py-6 px-4">
          尚未授權任何成員
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        {permissions.map((p, index) => (
          <div
            className={[
              'flex items-center justify-between py-3 px-4 transition-colors duration-fast hover:bg-tertiary',
              index < permissions.length - 1
                ? 'border-b border-border ml-4 pl-0'
                : '',
            ].join(' ')}
            key={p.id}
          >
            <span className="text-body text-foreground flex-1 min-w-0 overflow-hidden text-ellipsis">
              {p.email}
            </span>
            <span className="text-caption2 text-muted py-1 px-2 bg-tertiary rounded-full mx-3 shrink-0">
              {p.role}
            </span>
            <button
              className="appearance-none border-none bg-transparent text-muted cursor-pointer p-1 rounded-sm flex items-center justify-center min-w-tap-min min-h-tap-min shrink-0 transition-colors duration-fast hover:text-destructive hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="移除"
              disabled={removingId === p.id}
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

  /* ===== Nav center: title ===== */
  const navCenter = (
    <span className="text-title3 font-bold text-foreground flex-1 min-w-0 text-center">
      權限管理
    </span>
  );

  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 max-w-full mx-auto">
        <PageNav isOnline={isOnline} center={navCenter} />

        <ToastContainer />

        <main
          className={[
            'py-page-pt px-padding-h mx-auto md:max-w-page-max-w',
            !isOnline ? 'opacity-50 pointer-events-none' : '',
          ].join(' ')}
          id="adminMain"
        >
          {/* Section: Trip Select */}
          <div className="mb-7">
            <div className="text-caption font-medium text-muted uppercase tracking-wide mb-2 pl-4">
              選擇行程
            </div>
            <div className="bg-secondary rounded-lg overflow-hidden">
              <select
                className="w-full appearance-none border-none bg-transparent text-foreground font-inherit text-body py-3 pl-4 pr-11 cursor-pointer bg-no-repeat transition-colors duration-fast hover:bg-tertiary focus-visible:outline-none focus-visible:rounded-lg"
                style={SELECT_STYLE}
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
            <div className="text-caption font-medium text-muted uppercase tracking-wide mb-2 pl-4">
              已授權成員
            </div>
            <div className="bg-secondary rounded-lg overflow-hidden">
              {renderPermissions()}
            </div>
          </div>

          {/* Section: Add Member */}
          <div className="mb-7">
            <div className="text-caption font-medium text-muted uppercase tracking-wide mb-2 pl-4">
              新增成員
            </div>
            <div className="bg-secondary rounded-lg overflow-hidden">
              <div className="flex gap-2 p-2">
                <input
                  type="email"
                  className="flex-1 border-none bg-background text-foreground font-inherit text-body py-3 px-4 rounded-md focus-visible:outline-none placeholder:text-muted"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                />
                <button
                  className="appearance-none border-none bg-accent text-accent-foreground font-inherit text-body font-semibold py-3 px-4 min-w-16 rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-all duration-fast hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={addingDisabled}
                  onClick={handleAdd}
                >
                  新增
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
