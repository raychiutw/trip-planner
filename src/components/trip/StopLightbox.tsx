/**
 * StopLightbox — V3 ⛶ 放大檢視 fullscreen detail view (PR3 v2.9)
 *
 * Pure UI scaffolding. Photo carousel area is placeholder until entries/pois
 * schema gains photo storage (待 backend：`entry_photos` table 或 `pois.photos`
 * JSON column). Read-only view of existing description / note / location /
 * timing — useful as expanded reading surface beyond the inline accordion.
 *
 * Triggered from TimelineRail's expanded-row action button (⛶).
 * ESC / ✕ / backdrop click → onClose.
 */
import { useEffect } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import { parseTimeRange, deriveTypeMeta } from '../../lib/timelineUtils';
import type { TimelineEntryData } from './TimelineEvent';

const SCOPED_STYLES = `
.tp-lightbox-backdrop {
  position: fixed; inset: 0;
  background: rgba(42, 31, 24, 0.85);
  z-index: 1100;
  display: grid; place-items: center;
  padding: 24px;
  animation: tp-lightbox-fade 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-lightbox-fade { from { opacity: 0; } to { opacity: 1; } }

.tp-lightbox {
  background: var(--color-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%; max-width: 960px;
  max-height: calc(100vh - 48px);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}

.tp-lightbox-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
}
.tp-lightbox-head .title { flex: 1; min-width: 0; }
.tp-lightbox-head h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  margin: 0; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tp-lightbox-head .sub {
  font-size: var(--font-size-footnote); color: var(--color-muted); margin-top: 2px;
}
.tp-lightbox-iconbtn {
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
  display: grid; place-items: center;
  background: var(--color-secondary); border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer; font-size: 18px; color: var(--color-muted);
}
.tp-lightbox-iconbtn:hover { background: var(--color-accent-subtle); color: var(--color-accent-deep); border-color: var(--color-accent-bg); }

.tp-lightbox-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
}
@media (min-width: 768px) {
  .tp-lightbox-body { grid-template-columns: 1.5fr 1fr; }
}

.tp-lightbox-photo {
  background: linear-gradient(135deg, var(--color-tertiary) 0%, var(--color-secondary) 100%);
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-lg);
  min-height: 320px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 24px;
  color: var(--color-muted);
  text-align: center;
}
.tp-lightbox-photo .icon { font-size: 36px; opacity: 0.6; }
.tp-lightbox-photo .label {
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
}
.tp-lightbox-photo .hint {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  max-width: 320px;
}

.tp-lightbox-info { display: flex; flex-direction: column; gap: 14px; }
.tp-lightbox-meta-row {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tp-lightbox-meta-pill {
  font-size: var(--font-size-footnote); font-weight: 600;
  background: var(--color-secondary); color: var(--color-foreground);
  padding: 6px 12px; border-radius: var(--radius-full);
  display: inline-flex; align-items: center; gap: 6px;
}
.tp-lightbox-section h4 {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-muted);
  margin: 0 0 6px;
}
.tp-lightbox-section p {
  font-size: var(--font-size-body); line-height: 1.55;
  margin: 0;
}
.tp-lightbox-section .desc-card {
  background: var(--color-secondary); padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body); line-height: 1.55;
}

.tp-lightbox-loc {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-foreground);
  min-height: var(--spacing-tap-min);
}
.tp-lightbox-loc:hover { background: var(--color-accent-subtle); }
.tp-lightbox-loc .ico { color: var(--color-accent); font-size: 16px; margin-top: 2px; }
.tp-lightbox-loc .text { flex: 1; min-width: 0; }
.tp-lightbox-loc .name { font-size: var(--font-size-callout); font-weight: 700; }
.tp-lightbox-loc .addr { font-size: var(--font-size-footnote); color: var(--color-muted); margin-top: 2px; }
`;

export interface StopLightboxProps {
  open: boolean;
  entry: TimelineEntryData;
  onClose: () => void;
}

export default function StopLightbox({ open, entry, onClose }: StopLightboxProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = parseTimeRange(entry.time);
  const meta = deriveTypeMeta(entry);
  const firstLoc = entry.locations?.[0];
  const hasNote = !!entry.note?.trim();
  const hasDescription = !!entry.description?.trim();

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="tp-lightbox-backdrop"
      onMouseDown={handleBackdrop}
      role="presentation"
      data-testid="stop-lightbox"
    >
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-lightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-lightbox-title"
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="stop-lightbox-content"
      >
        <div className="tp-lightbox-head">
          <div className="title">
            <h2 id="stop-lightbox-title">{entry.title || '景點詳情'}</h2>
            <div className="sub">
              {meta.label}
              {parsed.start && ` · ${parsed.start}${parsed.end ? `–${parsed.end}` : ''}`}
            </div>
          </div>
          <button
            type="button"
            className="tp-lightbox-iconbtn"
            onClick={onClose}
            aria-label="關閉放大檢視"
            data-testid="stop-lightbox-close"
          >
            ✕
          </button>
        </div>

        <div className="tp-lightbox-body">
          <div className="tp-lightbox-photo" data-testid="stop-lightbox-photo-placeholder">
            <span className="icon" aria-hidden="true">📷</span>
            <span className="label">照片功能即將推出</span>
            <span className="hint">未來可在這裡看景點照片、街景縮圖、user-uploaded gallery。目前只顯示文字內容。</span>
          </div>

          <div className="tp-lightbox-info">
            <div className="tp-lightbox-meta-row">
              {typeof entry.googleRating === 'number' && (
                <span className="tp-lightbox-meta-pill">★ {entry.googleRating.toFixed(1)}</span>
              )}
              {parsed.start && (
                <span className="tp-lightbox-meta-pill">
                  <Icon name="clock" /> {parsed.start}{parsed.end ? `–${parsed.end}` : ''}
                </span>
              )}
              {firstLoc?.label && (
                <span className="tp-lightbox-meta-pill">
                  <Icon name="map" /> {firstLoc.label}
                </span>
              )}
            </div>

            {hasDescription && entry.description && (
              <div className="tp-lightbox-section">
                <h4>說明</h4>
                <MarkdownText text={entry.description} as="div" className="desc-card" />
              </div>
            )}

            {hasNote && entry.note && (
              <div className="tp-lightbox-section">
                <h4>備註</h4>
                <MarkdownText text={entry.note} as="div" className="desc-card" />
              </div>
            )}

            {entry.locations && entry.locations.length > 0 && (
              <div className="tp-lightbox-section">
                <h4>地點</h4>
                {entry.locations.map((loc, i) => {
                  const display = loc.label || loc.name || loc.googleQuery || '地點';
                  const query = loc.googleQuery || loc.url || loc.label || loc.name || '';
                  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
                  return (
                    <a
                      key={`${display}-${i}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tp-lightbox-loc"
                    >
                      <span className="ico" aria-hidden="true"><Icon name="map" /></span>
                      <span className="text">
                        <div className="name">{loc.name || display}</div>
                        {loc.label && loc.label !== loc.name && <div className="addr">{loc.label}</div>}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
