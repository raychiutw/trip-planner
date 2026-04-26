/**
 * InlineAddPoi — V3 inline + 加景點 affordance (PR3 v2.9)
 *
 * Replaces DaySection's `<Link to="/chat?...">+ 在 Day N 加景點</Link>` 的
 * 老 button 為 inline expandable card。Search input + result list 都是
 * placeholder（待 backend POI search endpoint 或 Nominatim proxy）。
 *
 * 為了不變死路，「AI 幫我找」+「自訂」chip 仍 route 到既有 /chat 流程，
 * 使用者隨時可以走老路完成新增景點。
 *
 * 待 backend ready 後接的 endpoint：
 *   - GET /api/pois/search?q=&near=:lat,:lng
 *   - 或整合 Nominatim proxy
 *   - POST /api/trips/:id/entries 新增 inline-form 結果到該 day
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';

const SCOPED_STYLES = `
.tp-inline-add-row { padding: 12px 16px; }

.tp-inline-add-trigger {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 2px dashed var(--color-border);
  background: transparent;
  color: var(--color-muted);
  font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  cursor: pointer;
  min-height: var(--spacing-tap-min);
  transition: border-color 120ms, color 120ms, background 120ms;
}
.tp-inline-add-trigger:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-inline-add-trigger .svg-icon { width: 16px; height: 16px; }

.tp-inline-add-form {
  background: var(--color-accent-subtle);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-lg);
  padding: 16px;
  animation: tp-inline-add-in 160ms var(--transition-timing-function-apple, ease-out);
}
@keyframes tp-inline-add-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-inline-add-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.tp-inline-add-head .badge {
  width: 32px; height: 32px;
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-radius: var(--radius-full);
  display: grid; place-items: center; font-weight: 800;
}
.tp-inline-add-head .when {
  font-size: var(--font-size-footnote); font-weight: 700;
  color: var(--color-accent-deep);
  text-transform: uppercase; letter-spacing: 0.06em;
  flex: 1;
}
.tp-inline-add-close {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-background); border: 1px solid var(--color-border);
  cursor: pointer; font-size: 16px;
  display: grid; place-items: center;
  color: var(--color-muted);
}
.tp-inline-add-close:hover { background: var(--color-secondary); color: var(--color-foreground); }

.tp-inline-add-search {
  display: flex; gap: 8px;
  background: var(--color-background); border: 1.5px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px 4px 4px 16px;
  align-items: center;
  margin-bottom: 12px;
  opacity: 0.7;
}
.tp-inline-add-search .ico { color: var(--color-muted); }
.tp-inline-add-search input {
  flex: 1; font: inherit; font-size: var(--font-size-callout);
  border: 0; padding: 10px 4px; background: transparent;
  min-height: 36px;
  color: var(--color-foreground);
}
.tp-inline-add-search input:focus { outline: none; }
.tp-inline-add-search input::placeholder { color: var(--color-muted); font-style: italic; }

.tp-inline-add-chips {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
}
.tp-inline-add-chip {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  background: var(--color-background); color: var(--color-foreground);
  padding: 8px 14px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border); cursor: pointer;
  text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 36px;
}
.tp-inline-add-chip:hover { background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent); }
.tp-inline-add-chip.is-primary {
  background: var(--color-accent); color: var(--color-accent-foreground);
  border-color: var(--color-accent);
}
.tp-inline-add-chip.is-primary:hover { filter: brightness(0.95); }
.tp-inline-add-chip.is-disabled { opacity: 0.5; cursor: not-allowed; }
.tp-inline-add-chip.is-disabled:hover { background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border); }

.tp-inline-add-results {
  background: var(--color-background); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  opacity: 0.7;
}
.tp-inline-add-result {
  display: flex; gap: 12px; padding: 12px;
  border-bottom: 1px solid var(--color-border);
  align-items: center;
}
.tp-inline-add-result:last-child { border-bottom: 0; }
.tp-inline-add-result .img {
  width: 48px; height: 48px; flex-shrink: 0; border-radius: var(--radius-md);
  background: var(--color-tertiary);
  display: grid; place-items: center; font-size: 22px;
}
.tp-inline-add-result .info { flex: 1; min-width: 0; }
.tp-inline-add-result .name { font-size: var(--font-size-callout); font-weight: 700; margin: 0; line-height: 1.3; }
.tp-inline-add-result .meta { font-size: var(--font-size-caption); color: var(--color-muted); margin-top: 2px; }
.tp-inline-add-result .add-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 0; padding: 8px 14px; border-radius: var(--radius-full);
  cursor: pointer; min-height: 36px;
}
.tp-inline-add-result .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tp-inline-add-pending {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--color-warning);
  line-height: 1.5;
}
.tp-inline-add-pending b { font-weight: 700; }
`;

interface PlaceholderResult {
  icon: string;
  name: string;
  meta: string;
}

const PLACEHOLDER_RESULTS: PlaceholderResult[] = [
  { icon: '🍜', name: '搜尋結果即將上線', meta: '輸入景點名 → 結果會列在這裡' },
  { icon: '🏨', name: '住宿、餐廳、景點都會 surface', meta: '附近 / 開放中 / 評分排序' },
  { icon: '✏️', name: '點「自訂」 chip 走老 chat 流程', meta: '完整功能會在 v2.10 接上' },
];

export interface InlineAddPoiProps {
  tripId: string;
  dayNum: number;
}

export default function InlineAddPoi({ tripId, dayNum }: InlineAddPoiProps) {
  const [expanded, setExpanded] = useState(false);

  const aiHref = `/chat?tripId=${encodeURIComponent(tripId)}&prefill=${encodeURIComponent(`幫我找 Day ${dayNum} 適合加的景點：`)}`;
  const customHref = `/chat?tripId=${encodeURIComponent(tripId)}&prefill=${encodeURIComponent(`幫我加 Day ${dayNum} 的景點（自訂）：`)}`;

  if (!expanded) {
    return (
      <div className="tp-inline-add-row">
        <style>{SCOPED_STYLES}</style>
        <button
          type="button"
          className="tp-inline-add-trigger"
          onClick={() => setExpanded(true)}
          aria-label={`在 Day ${dayNum} 加景點`}
          data-testid="inline-add-poi-trigger"
        >
          <Icon name="plus" />
          <span>在 Day {dayNum} 加景點</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tp-inline-add-row">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-inline-add-form" data-testid="inline-add-poi-form">
        <div className="tp-inline-add-head">
          <div className="badge">+</div>
          <div className="when">在 Day {dayNum} 加景點</div>
          <button
            type="button"
            className="tp-inline-add-close"
            onClick={() => setExpanded(false)}
            aria-label="收闔加景點"
            data-testid="inline-add-poi-close"
          >
            ✕
          </button>
        </div>

        <div className="tp-inline-add-search">
          <span className="ico" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="搜尋功能即將推出 — 改用 AI 助理或自訂"
            disabled
            data-testid="inline-add-poi-search"
          />
        </div>

        <div className="tp-inline-add-chips">
          <Link
            to={aiHref}
            className="tp-inline-add-chip is-primary"
            data-testid="inline-add-poi-chip-ai"
          >
            🤖 AI 幫我找
          </Link>
          <Link
            to={customHref}
            className="tp-inline-add-chip"
            data-testid="inline-add-poi-chip-custom"
          >
            ✏️ 自訂景點
          </Link>
          <button
            type="button"
            className="tp-inline-add-chip is-disabled"
            disabled
            title="此功能即將推出"
          >
            📍 附近
          </button>
          <button
            type="button"
            className="tp-inline-add-chip is-disabled"
            disabled
            title="此功能即將推出"
          >
            ⭐ AI 推薦的
          </button>
        </div>

        <div className="tp-inline-add-results">
          {PLACEHOLDER_RESULTS.map((r, i) => (
            <div className="tp-inline-add-result" key={r.name}>
              <div className="img" aria-hidden="true">{r.icon}</div>
              <div className="info">
                <div className="name">{r.name}</div>
                <div className="meta">{r.meta}</div>
              </div>
              <button
                type="button"
                className="add-btn"
                disabled
                title="搜尋結果即將推出"
                data-testid={`inline-add-poi-result-add-${i}`}
              >
                + 加入
              </button>
            </div>
          ))}
        </div>

        <p className="tp-inline-add-pending">
          ⚠️ <b>搜尋功能即將推出</b> — 待 POI search endpoint 或 Nominatim proxy 上線。目前可用上方「AI 幫我找」走 chat 流程。
        </p>
      </div>
    </div>
  );
}
