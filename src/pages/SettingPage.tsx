import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../hooks/useApi';
import { useDarkMode, type ColorMode, type ColorTheme } from '../hooks/useDarkMode';
import { lsGet, lsSet } from '../lib/localStorage';
import type { TripListItem } from '../types/trip';

/* ===== Types ===== */

interface TripDisplay {
  tripId: string;
  name: string;
  owner: string;
  dates: string;
  published: number;
}

/* ===== Color Mode Definitions ===== */

const COLOR_MODES: { key: ColorMode; label: string; desc: string }[] = [
  { key: 'light', label: '淺色', desc: 'Light' },
  { key: 'auto', label: '自動', desc: 'Auto' },
  { key: 'dark', label: '深色', desc: 'Dark' },
];

const COLOR_THEMES: { key: ColorTheme; label: string; desc: string; swatch: string; swatchDark: string }[] = [
  { key: 'sun', label: '陽光', desc: 'Sunshine', swatch: '#F47B5E', swatchDark: '#F4A08A' },
  { key: 'sky', label: '晴空', desc: 'Clear Sky', swatch: '#2870A0', swatchDark: '#7EC0E8' },
  { key: 'zen', label: '和風', desc: 'Japanese Zen', swatch: '#9A6B50', swatchDark: '#D4A88E' },
];

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
          {section && (
            <button
              className="nav-back-btn"
              aria-label="返回"
              onClick={() => { window.location.href = 'setting.html'; }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
          )}
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
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      載入中...
                    </div>
                  )}
                  {loadError && (
                    <div style={{ color: 'var(--text-muted)', padding: '16px' }}>
                      無法載入行程清單
                    </div>
                  )}
                  {!loading &&
                    !loadError &&
                    trips.map((t) => (
                      <button
                        key={t.tripId}
                        className={`trip-btn${t.tripId === currentTripId ? ' active' : ''}`}
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
                  {COLOR_MODES.map((m) => (
                    <button
                      key={m.key}
                      className={`color-mode-card${m.key === colorMode ? ' active' : ''}`}
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
                      className={`color-theme-card${t.key === colorTheme ? ' active' : ''}`}
                      data-theme={t.key}
                      onClick={() => handleThemeClick(t.key)}
                    >
                      <div
                        className="color-theme-swatch"
                        style={{ background: isDark ? t.swatchDark : t.swatch }}
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
                      className={`color-theme-card${t.key === colorTheme ? ' active' : ''}`}
                      data-theme={t.key}
                      onClick={() => handleThemeClick(t.key)}
                    >
                      <div
                        className="color-theme-swatch"
                        style={{ background: isDark ? t.swatchDark : t.swatch }}
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
