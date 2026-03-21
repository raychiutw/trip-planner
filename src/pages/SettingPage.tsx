import React, { useState, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { apiFetch } from '../hooks/useApi';
import { useDarkMode, type ColorMode, type ColorTheme } from '../hooks/useDarkMode';
import { lsGet, lsSet } from '../lib/localStorage';
import { COLOR_MODE_OPTIONS, THEME_ACCENTS, COLOR_THEMES } from '../lib/appearance';
import type { TripListItem } from '../types/trip';

/* ===== Types ===== */

interface TripDisplay {
  tripId: string;
  name: string;
  owner: string;
  dates: string;
  published: number;
}

/* ===== Color Mode/Theme — imported from ../lib/appearance ===== */

/* ===== Component ===== */

export default function SettingPage() {
  const { colorMode, setColorMode, isDark, colorTheme, setTheme } = useDarkMode();
  const [trips, setTrips] = useState<TripDisplay[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string>('');
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  /* --- URL section filter --- */
  const section = useMemo(
    () => new URLSearchParams(window.location.search).get('section'),
    [],
  );

  /* --- page-setting class on html + body --- */
  useEffect(() => {
    document.documentElement.classList.add('page-setting');
    document.body.classList.add('page-setting');
    return () => {
      document.documentElement.classList.remove('page-setting');
      document.body.classList.remove('page-setting');
    };
  }, []);

  /* --- fetch trips --- */
  useEffect(() => {
    let cancelled = false;
    apiFetch<TripListItem[]>('/trips')
      .then((data) => {
        if (cancelled) return;
        const mapped: TripDisplay[] = data.map((t) => {
          let footer = t.footer_json as string | Record<string, unknown> | null;
          if (typeof footer === 'string') {
            try {
              footer = JSON.parse(footer) as Record<string, unknown>;
            } catch {
              footer = null;
            }
          }
          const dates =
            footer && typeof footer === 'object' && 'dates' in footer
              ? String((footer as Record<string, unknown>).dates)
              : t.title || '';
          return {
            tripId: t.tripId,
            name: t.name,
            owner: t.owner,
            dates: dates,
            published: t.published,
          };
        });
        const published = mapped.filter((t) => t.published !== 0);
        let savedTrip = lsGet<string>('trip-pref') || '';
        if (!savedTrip && published.length > 0) {
          savedTrip = published[0].tripId;
        }
        setTrips(published);
        setCurrentTripId(savedTrip);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- handlers --- */
  const handleTripClick = useCallback((tripId: string) => {
    lsSet('trip-pref', tripId);
    window.location.href = 'index.html';
  }, []);

  const handleColorModeClick = useCallback((mode: ColorMode) => {
    setColorMode(mode);
  }, [setColorMode]);

  const handleThemeClick = useCallback((theme: ColorTheme) => {
    setTheme(theme);
  }, [setTheme]);

  const handleClose = useCallback(() => {
    window.location.href = 'index.html';
  }, []);

  /* --- render --- */
  return (
    <div className="page-layout">
      <div className="container">
        {/* Sticky Nav */}
        <div className="sticky-nav" id="stickyNav">
          <span className="nav-title">
            {section === 'trip' ? '切換行程' : section === 'appearance' ? '外觀與主題' : '設定'}
          </span>
          <button
            className="nav-close-btn"
            id="navCloseBtn"
            aria-label="關閉"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <main className="setting-main" id="settingMain">
          <div className="setting-page">
            {/* Trip List Section */}
            {(!section || section === 'trip') && (
              <div className="setting-section">
                <div className="setting-section-title">選擇行程</div>
                <div className="setting-trip-list" id="tripList">
                  {loading && (
                    <div className="text-center p-10 text-[var(--color-muted)]">
                      載入中...
                    </div>
                  )}
                  {loadError && (
                    <div className="text-[var(--color-muted)] p-4">
                      無法載入行程清單
                    </div>
                  )}
                  {!loading &&
                    !loadError &&
                    trips.map((t) => (
                      <button
                        key={t.tripId}
                        className={clsx('trip-btn', t.tripId === currentTripId && 'active')}
                        data-trip-id={t.tripId}
                        onClick={() => handleTripClick(t.tripId)}
                      >
                        <strong>{t.name}</strong>
                        <span className="trip-sub">
                          {t.dates} · {t.owner}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Appearance + Color Theme Section (merged) */}
            {(!section || section === 'appearance') && (
              <div className="setting-section">
                <div className="setting-section-title">外觀與主題</div>
                <div className="color-mode-grid" id="colorModeGrid">
                  {COLOR_MODE_OPTIONS.map((m) => (
                    <button
                      key={m.key}
                      className={clsx('color-mode-card', m.key === colorMode && 'active')}
                      data-mode={m.key}
                      onClick={() => handleColorModeClick(m.key)}
                    >
                      <div className={`color-mode-preview color-mode-${m.key}`}>
                        <div className="cmp-top"></div>
                        <div className="cmp-bottom">
                          <div className="cmp-input"></div>
                          <div className="cmp-dot"></div>
                        </div>
                      </div>
                      <div className="color-mode-label">{m.label}</div>
                      <div className="color-mode-desc">{m.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="setting-subsection-title">色彩主題</div>
                <div className="color-theme-grid" id="colorThemeGrid">
                  {COLOR_THEMES.map((t) => (
                    <button
                      key={t.key}
                      className={clsx('color-theme-card', t.key === colorTheme && 'active')}
                      data-theme={t.key}
                      onClick={() => handleThemeClick(t.key)}
                    >
                      <div
                        className="color-theme-swatch"
                        style={{ background: isDark ? THEME_ACCENTS[t.key].dark : THEME_ACCENTS[t.key].light }}
                      />
                      <div className="color-theme-label">{t.label}</div>
                      <div className="color-theme-desc">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Theme Section (standalone — only when section === 'theme') */}
            {section === 'theme' && (
              <div className="setting-section">
                <div className="setting-section-title">色彩主題</div>
                <div className="color-theme-grid" id="colorThemeGrid">
                  {COLOR_THEMES.map((t) => (
                    <button
                      key={t.key}
                      className={clsx('color-theme-card', t.key === colorTheme && 'active')}
                      data-theme={t.key}
                      onClick={() => handleThemeClick(t.key)}
                    >
                      <div
                        className="color-theme-swatch"
                        style={{ background: isDark ? THEME_ACCENTS[t.key].dark : THEME_ACCENTS[t.key].light }}
                      />
                      <div className="color-theme-label">{t.label}</div>
                      <div className="color-theme-desc">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
