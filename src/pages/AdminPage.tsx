import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { TripListItem } from '../types/trip';
import type { Permission } from '../types/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { lsGet, lsSet } from '../lib/localStorage';

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

export default function AdminPage() {
  useDarkMode();

  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsError, setTripsError] = useState('');
  const [currentTripId, setCurrentTripId] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState('');
  const [email, setEmail] = useState('');
  const [addingDisabled, setAddingDisabled] = useState(false);
  const [addStatus, setAddStatus] = useState<StatusMsg | null>(null);

  const currentTripIdRef = useRef(currentTripId);
  currentTripIdRef.current = currentTripId;

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
      if (currentTripIdRef.current === tripId) {
        setPermissions(perms || []);
        setPermLoading(false);
      }
    } catch (err) {
      if (currentTripIdRef.current === tripId) {
        setPermError((err as Error).message);
        setPermLoading(false);
      }
    }
  }, []);

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
        const savedTrip = lsGet<string>('trip-pref');
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
    if (tripId) lsSet('trip-pref', tripId);
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
    window.location.href = '../index.html';
  }

  /* ===== Render Permission Content ===== */
  function renderPermissions() {
    if (!currentTripId) {
      return <div className="admin-empty">請先選擇行程</div>;
    }
    if (permLoading) {
      return <div className="admin-empty">載入中…</div>;
    }
    if (permError) {
      return <div className="admin-empty">{permError}</div>;
    }
    if (permissions.length === 0) {
      return <div className="admin-empty">尚未授權任何成員</div>;
    }

    return (
      <div className="admin-permission-list">
        {permissions.map((p) => (
          <div className="admin-permission-item" key={p.id}>
            <span className="admin-permission-email">{p.email}</span>
            <span className="admin-permission-role">{p.role}</span>
            <button
              className="admin-remove-btn"
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

  return (
    <div className="page-layout">
      <div className="container">
        <div className="sticky-nav" id="stickyNav">
          <span className="nav-title">權限管理</span>
          <button className="nav-close-btn" id="navCloseBtn" aria-label="關閉" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <main className="admin-main" id="adminMain">
          <div className="admin-page">
            {/* Section: Trip Select */}
            <div className="admin-section">
              <div className="admin-section-title">選擇行程</div>
              <div className="admin-section-card">
                <select
                  className="admin-trip-select"
                  aria-label="選擇行程"
                  value={currentTripId}
                  onChange={handleTripChange}
                >
                  {renderTripOptions()}
                </select>
              </div>
            </div>

            {/* Section: Permission List */}
            <div className="admin-section">
              <div className="admin-section-title">已授權成員</div>
              <div className="admin-section-card">
                {renderPermissions()}
              </div>
            </div>

            {/* Section: Add Member */}
            <div className="admin-section">
              <div className="admin-section-title">新增成員</div>
              <div className="admin-section-card">
                <div className="admin-add-form">
                  <input
                    type="email"
                    className="admin-email-input"
                    placeholder="email@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                  />
                  <button
                    className="admin-add-btn"
                    disabled={addingDisabled}
                    onClick={handleAdd}
                  >
                    新增
                  </button>
                </div>
                {addStatus && (
                  <div className={`admin-status ${addStatus.type}`}>
                    {addStatus.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
