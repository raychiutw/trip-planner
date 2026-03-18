import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../hooks/useApi';
import { lsGet, lsSet, lsRemove } from '../lib/localStorage';
import { useTrip } from '../hooks/useTrip';
import DayNav from '../components/trip/DayNav';
import Timeline from '../components/trip/Timeline';
import Hotel from '../components/trip/Hotel';
import Footer from '../components/trip/Footer';
import SpeedDial from '../components/trip/SpeedDial';
import InfoSheet from '../components/trip/InfoSheet';
import Countdown from '../components/trip/Countdown';
import { TripDrivingStatsCard } from '../components/trip/DrivingStats';
import Flights from '../components/trip/Flights';
import Checklist from '../components/trip/Checklist';
import Backup from '../components/trip/Backup';
import Emergency from '../components/trip/Emergency';
import Suggestions from '../components/trip/Suggestions';
import HourlyWeather from '../components/trip/HourlyWeather';
import { toTimelineEntry, toHotelData } from '../lib/mapDay';
import type { WeatherDay } from '../lib/weather';
import { useDarkMode } from '../hooks/useDarkMode';
import { calcTripDrivingStats } from '../lib/drivingStats';
import type { TripListItem, Day } from '../types/trip';

import '../../css/shared.css';
import '../../css/style.css';

/* ===== URL helpers ===== */

function getUrlTrip(): string | null {
  return new URLSearchParams(window.location.search).get('trip');
}

function setUrlTrip(tripId: string): void {
  const url = new URL(window.location.href);
  if (tripId) url.searchParams.set('trip', tripId);
  else url.searchParams.delete('trip');
  history.replaceState(null, '', url.toString());
}

/* ===== Sheet content config ===== */

const SHEET_TITLES: Record<string, string> = {
  flights: '航班資訊',
  checklist: '出發前確認',
  backup: '備案',
  emergency: '緊急聯絡',
  suggestions: 'AI 行程建議',
  driving: '交通統計',
};

/* ===== Resolve state machine ===== */

type ResolveState =
  | { status: 'loading' }
  | { status: 'no-trip' }
  | { status: 'unpublished' }
  | { status: 'resolved'; tripId: string };

/* ===== Component ===== */

export default function TripPage() {
  const [resolveState, setResolveState] = useState<ResolveState>({ status: 'loading' });
  const [printMode, setPrintMode] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  /* --- Dark mode --- */
  useDarkMode();

  /* --- Resolve trip ID from URL / localStorage --- */
  useEffect(() => {
    let tripId = getUrlTrip();
    if (!tripId || !/^[\w-]+$/.test(tripId)) {
      tripId = lsGet<string>('trip-pref');
    }

    if (!tripId) {
      setResolveState({ status: 'no-trip' });
      return;
    }

    // Check published status
    apiFetch<TripListItem[]>('/trips')
      .then((trips) => {
        const match = trips.find((t) => t.tripId === tripId);
        if (match && match.published === 0) {
          lsRemove('trip-pref');
          setResolveState({ status: 'unpublished' });
          // Redirect after 2s
          setTimeout(() => {
            window.location.href = 'setting.html';
          }, 2000);
          return;
        }
        // Persist choice
        setUrlTrip(tripId!);
        lsSet('trip-pref', tripId!);
        setResolveState({ status: 'resolved', tripId: tripId! });
      })
      .catch(() => {
        // If the check fails, still try to load the trip
        setUrlTrip(tripId!);
        lsSet('trip-pref', tripId!);
        setResolveState({ status: 'resolved', tripId: tripId! });
      });
  }, []);

  /* --- Derive active tripId for the hook --- */
  const activeTripId = resolveState.status === 'resolved' ? resolveState.tripId : null;

  const { trip, days, currentDay, currentDayNum, switchDay, allDays, docs, loading, error } =
    useTrip(activeTripId);

  /* --- Update document title when trip meta loads --- */
  useEffect(() => {
    if (trip?.title) {
      document.title = trip.title;
    }
    if (trip?.description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', trip.description);
    }
    if (trip?.title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', trip.title);
    }
    if (trip?.ogDescription) {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', trip.ogDescription);
    }
  }, [trip]);

  /* --- Sorted day nums for skeleton rendering --- */
  const dayNums = useMemo(
    () => days.map((d) => d.day_num ?? d.id).sort((a, b) => a - b),
    [days],
  );

  /* --- Print mode toggle --- */
  const togglePrint = useCallback(() => {
    setPrintMode((prev) => {
      const next = !prev;
      document.body.classList.toggle('print-mode', next);
      return next;
    });
  }, []);

  /* --- Speed Dial → InfoSheet --- */
  const handleSpeedDialItem = useCallback((key: string) => {
    setActiveSheet(key);
  }, []);

  const handleSheetClose = useCallback(() => {
    setActiveSheet(null);
  }, []);

  /* --- Derive docs for InfoPanel / InfoSheet --- */
  const flightsData = docs.flights as Record<string, unknown> | undefined;
  const checklistData = docs.checklist as Record<string, unknown> | undefined;
  const backupData = docs.backup as Record<string, unknown> | undefined;
  const emergencyData = docs.emergency as Record<string, unknown> | undefined;
  const suggestionsData = docs.suggestions as Record<string, unknown> | undefined;

  /* --- All loaded days as Day[] for InfoPanel --- */
  const loadedDays = useMemo(
    () => Object.values(allDays) as unknown as Day[],
    [allDays],
  );

  /* --- Auto-scroll dates for Countdown --- */
  const autoScrollDates = useMemo(
    () =>
      days
        .map((d) => d.date)
        .filter((d): d is string => !!d)
        .sort(),
    [days],
  );

  /* --- Trip driving stats --- */
  const tripDrivingStats = useMemo(() => {
    if (loadedDays.length === 0) return null;
    try {
      return calcTripDrivingStats(loadedDays);
    } catch {
      return null;
    }
  }, [loadedDays]);

  /* --- Footer data from trip.footer --- */
  const footerData = useMemo(() => {
    if (!trip) return null;
    const raw = trip.footer;
    if (!raw || typeof raw !== 'object') return null;
    return raw as { title?: string; dates?: string; budget?: string; exchangeNote?: string; tagline?: string };
  }, [trip]);

  /* --- Sheet content renderer --- */
  const sheetContent = useMemo(() => {
    if (!activeSheet) return null;
    switch (activeSheet) {
      case 'flights':
        return flightsData ? <Flights data={flightsData as never} /> : <p>無航班資料</p>;
      case 'checklist':
        return checklistData ? <Checklist data={checklistData as never} /> : <p>無確認清單</p>;
      case 'backup':
        return backupData ? <Backup data={backupData as never} /> : <p>無備案資料</p>;
      case 'emergency':
        return emergencyData ? <Emergency data={emergencyData as never} /> : <p>無緊急聯絡資料</p>;
      case 'suggestions':
        return suggestionsData ? <Suggestions data={suggestionsData as never} /> : <p>無行程建議</p>;
      case 'driving':
        return <p>交通統計（桌面版側邊欄可見）</p>;
      default:
        return null;
    }
  }, [activeSheet, flightsData, checklistData, backupData, emergencyData, suggestionsData]);

  /* --- No trip selected --- */
  if (resolveState.status === 'no-trip') {
    return (
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            <div className="trip-error">
              <p>請選擇行程</p>
              <a className="trip-error-link" href="setting.html">
                前往設定頁
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --- Unpublished trip --- */
  if (resolveState.status === 'unpublished') {
    return (
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            <div className="trip-error">
              <p>此行程已下架</p>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                2 秒後跳轉至設定頁…
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --- Loading initial resolve --- */
  if (resolveState.status === 'loading') {
    return (
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              載入行程資料中...
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --- Trip load error --- */
  if (error && !trip) {
    return (
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            <div className="trip-error">
              <p>行程不存在：{activeTripId}</p>
              <a className="trip-error-link" href="setting.html">
                選擇其他行程
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sticky Nav */}
      <div className="sticky-nav" id="stickyNav">
        <span className="nav-brand">Trip Planner</span>
        <DayNav days={days} currentDayNum={currentDayNum} onSwitchDay={switchDay} />
        <div className="nav-actions">
          <button
            className="nav-action-btn"
            data-action="toggle-print"
            aria-label="列印模式"
            onClick={togglePrint}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
            </svg>
            <span className="nav-action-label">列印模式</span>
          </button>
          <a className="nav-action-btn" href="setting.html" aria-label="設定">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z" />
            </svg>
            <span className="nav-action-label">設定</span>
          </a>
        </div>
      </div>

      {/* Page Layout: main content + desktop sidebar */}
      <div className="page-layout">
        <div className="container">
          <div id="tripContent">
            {loading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                載入行程資料中...
              </div>
            )}

            {!loading &&
              dayNums.map((dayNum) => {
                const rawDay = allDays[dayNum] as unknown as Record<string, unknown> | undefined;
                const daySummary = days.find((d) => (d.day_num ?? d.id) === dayNum);
                const hotel = rawDay?.hotel as Record<string, unknown> | null | undefined;
                const timeline = (rawDay?.timeline ?? []) as Record<string, unknown>[];
                const weatherRaw = rawDay?.weather_json as Record<string, unknown> | undefined;
                const weatherDay = weatherRaw?.locations ? (weatherRaw as unknown as WeatherDay) : null;
                const dayDate = (rawDay?.date ?? daySummary?.date) as string | undefined;
                const dayId = rawDay?.id as number | undefined;

                return (
                  <section key={dayNum} className="day-section" data-day={dayNum}>
                    <div className="day-header info-header" id={`day${dayNum}`}>
                      <h2>Day {dayNum}</h2>
                      {daySummary?.label && (
                        <span className="day-label">{daySummary.label}</span>
                      )}
                      {daySummary?.date && (
                        <span className="dh-date">
                          {daySummary.date}
                          {daySummary.day_of_week && `（${daySummary.day_of_week}）`}
                        </span>
                      )}
                    </div>
                    <div className="day-content" id={`day-slot-${dayNum}`}>
                      {!rawDay ? (
                        <div className="slot-loading">載入中...</div>
                      ) : (
                        <>
                          {weatherDay && dayDate && dayId && (
                            <HourlyWeather
                              dayId={dayId}
                              dayDate={dayDate}
                              weatherDay={weatherDay}
                              tripStart={autoScrollDates[0] ?? null}
                              tripEnd={autoScrollDates[autoScrollDates.length - 1] ?? null}
                            />
                          )}
                          {hotel && <Hotel hotel={toHotelData(hotel)} />}
                          {timeline.length > 0 && (
                            <Timeline events={timeline.map(toTimelineEntry)} />
                          )}
                        </>
                      )}
                    </div>
                  </section>
                );
              })}

            {/* Footer */}
            {!loading && trip && footerData && (
              <Footer footer={footerData} />
            )}
          </div>
        </div>

        {/* Desktop info panel (sidebar) — 倒數天數 + 交通統計 */}
        {!loading && trip && (
          <aside className="info-panel" id="infoPanel">
            <Countdown autoScrollDates={autoScrollDates} />
            {tripDrivingStats && (
              <div className="info-card">
                <TripDrivingStatsCard tripStats={tripDrivingStats} />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* SpeedDial */}
      {!loading && trip && (
        <SpeedDial onItemClick={handleSpeedDialItem} />
      )}

      {/* Edit FAB */}
      {!loading && trip && (
        <a className="edit-fab" id="editFab" href="manage/" aria-label="AI 修改行程">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </a>
      )}

      {/* InfoSheet (mobile bottom sheet) */}
      <InfoSheet
        open={!!activeSheet}
        title={activeSheet ? (SHEET_TITLES[activeSheet] || '') : ''}
        onClose={handleSheetClose}
      >
        {sheetContent}
      </InfoSheet>

      {/* Print exit button */}
      {printMode && (
        <button className="print-exit-btn" id="printExitBtn" onClick={togglePrint}>
          退出列印模式
        </button>
      )}
    </>
  );
}
