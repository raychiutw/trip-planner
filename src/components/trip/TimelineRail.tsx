/**
 * TimelineRail — mobile-only compact timeline (設計稿 design_mobile.jsx 版本)
 *
 * Structure:
 *  - Left gutter: right-aligned time (40px, tabular-nums)
 *  - Vertical rail: 1px line connecting all dots
 *  - Dot: 10px hollow circle, accent border for sight/food
 *  - Row: small type icon + name + (type · duration)
 *  - Click row → expand jp + note
 */

import { memo, useState, useEffect } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import InfoBox from './InfoBox';
import { NavLinks } from './MapLinks';
import type { TimelineEntryData } from './TimelineEvent';

interface ParsedTime { start: string; end: string; duration: number; }

function parseTimeRange(timeStr?: string | null): ParsedTime {
  if (!timeStr) return { start: '', end: '', duration: 0 };
  const parts = timeStr.split('-');
  const start = (parts[0] ?? '').trim();
  const end = parts.length > 1 ? (parts[1] ?? '').trim() : '';
  let duration = 0;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    if (s.length === 2 && e.length === 2) {
      duration =
        (parseInt(e[0] ?? '0', 10) * 60 + parseInt(e[1] ?? '0', 10)) -
        (parseInt(s[0] ?? '0', 10) * 60 + parseInt(s[1] ?? '0', 10));
      if (duration < 0) duration += 24 * 60;
    }
  }
  return { start, end, duration };
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function deriveTypeMeta(entry: TimelineEntryData): { icon: string; label: string; accent: boolean } {
  const title = (entry.title ?? '').toLowerCase();
  const desc = (entry.description ?? '').toLowerCase();
  const travelType = (entry.travel && typeof entry.travel === 'object' ? entry.travel.type ?? '' : '').toLowerCase();
  const blob = `${title} ${desc} ${travelType}`;

  if (/機場|flight|機票/.test(blob)) return { icon: 'plane', label: '飛行', accent: false };
  if (/飯店|旅館|hotel|check[- ]?in|民宿/.test(blob)) return { icon: 'hotel', label: '住宿', accent: false };
  if (/餐|食|restaurant|lunch|dinner|breakfast|用餐/.test(blob)) return { icon: 'fork-knife', label: '用餐', accent: true };
  if (/咖啡|café|cafe|coffee/.test(blob)) return { icon: 'coffee', label: '咖啡', accent: true };
  if (/購物|shopping|mall|market/.test(blob)) return { icon: 'shopping', label: '購物', accent: false };
  if (/開車|drive|car|自駕|租車/.test(blob)) return { icon: 'car', label: '移動', accent: false };
  if (/步行|walk|散步/.test(blob)) return { icon: 'walk', label: '散步', accent: false };
  if (/休息|rest|spa|泡湯/.test(blob)) return { icon: 'coffee', label: '休息', accent: false };
  return { icon: 'location-pin', label: '景點', accent: true };
}

interface TimelineRailProps {
  events: TimelineEntryData[];
  /** Activate "now" indicator for this index */
  nowIndex?: number;
}

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1 }: TimelineRailProps) {
  // First stop expanded by default; collapse/switch when events change.
  const [expandedIdx, setExpandedIdx] = useState(0);
  useEffect(() => { setExpandedIdx(0); }, [events]);

  if (!events || events.length === 0) return null;

  const firstTime = parseTimeRange(events[0]?.time).start;
  const lastTime = parseTimeRange(events[events.length - 1]?.time).end ||
                   parseTimeRange(events[events.length - 1]?.time).start;

  return (
    <div className="ocean-rail">
      <div className="ocean-rail-header">
        <span className="ocean-rail-eyebrow">Itinerary</span>
        <span className="ocean-rail-meta">
          {events.length} stops{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      <div className="ocean-rail-body">
        <div className="ocean-rail-line" aria-hidden="true" />
        {events.map((entry, i) => {
          const parsed = parseTimeRange(entry.time);
          const meta = deriveTypeMeta(entry);
          const expanded = i === expandedIdx;
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === events.length - 1;
          const hasExpandBody =
            entry.note ||
            entry.description ||
            (entry.locations && entry.locations.length > 0) ||
            (entry.infoBoxes && entry.infoBoxes.length > 0);
          return (
            <div
              key={entry.id ?? i}
              className="ocean-rail-item"
              data-expanded={expanded || undefined}
              data-now={isNow || undefined}
              data-past={isPast || undefined}
              data-accent={meta.accent || undefined}
              data-last={isLast || undefined}
            >
              <span className="ocean-rail-time">{parsed.start}</span>
              <span className="ocean-rail-dot" aria-hidden="true">{i + 1}</span>
              <button
                type="button"
                className="ocean-rail-head"
                aria-expanded={expanded}
                onClick={() => setExpandedIdx(expanded ? -1 : i)}
              >
                <span className="ocean-rail-icon" aria-hidden="true">
                  <Icon name={meta.icon} />
                </span>
                <span className="ocean-rail-content">
                  <span className="ocean-rail-name">{entry.title ?? ''}</span>
                  <span className="ocean-rail-sub">
                    <span className="ocean-rail-type">{meta.label}</span>
                    {formatDuration(parsed.duration) && (
                      <>
                        <span className="ocean-rail-sep">·</span>
                        <span>{formatDuration(parsed.duration)}</span>
                      </>
                    )}
                    {typeof entry.googleRating === 'number' && (
                      <>
                        <span className="ocean-rail-sep">·</span>
                        <span>★ {entry.googleRating.toFixed(1)}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="ocean-rail-caret" aria-hidden="true">›</span>
              </button>
              {expanded && hasExpandBody && (
                <div className="ocean-rail-expand">
                  {entry.note && <MarkdownText text={entry.note} as="div" className="block" />}
                  {entry.description && <MarkdownText text={entry.description} as="div" className="block mt-1 text-muted" />}
                  {entry.locations && entry.locations.length > 0 && <NavLinks locations={entry.locations} />}
                  {entry.infoBoxes && entry.infoBoxes.length > 0 &&
                    entry.infoBoxes.map((box, bi) => <InfoBox key={bi} box={box} />)
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default TimelineRail;
