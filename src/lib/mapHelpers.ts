/**
 * mapHelpers.ts — pure helpers for Google Maps marker / polyline construction.
 *
 * v2.33.57 round 11: extracted from `src/components/trip/TpMap.tsx`
 * as part of the 4-module split (see docs/code-review/round-11-tp-map-split.md).
 * No behaviour change — these are the exact same functions, just relocated.
 *
 * `lib/` 為 leaf layer — 不 import React / hooks / components。
 */

import { dayPolylineStyle } from './dayPalette';
import type { MapPin, Coord } from './mapTypes';

/* ===== Marker styling ===== */

const ACCENT_COLOR = '#A97A4A';
const ACCENT_FG = '#FFFFFF';
const IDLE_BG = '#FFFFFF';
const IDLE_BORDER = '#C1C1C1';
const IDLE_FG = '#6A6A6A';
const PAST_BORDER = '#E0E0E0';
const PAST_FG = '#C1C1C1';

type MarkerState = 'focused' | 'past' | 'idle';

const STATE_COLORS: Record<MarkerState, { fill: string; stroke: string; text: string }> = {
  focused: { fill: ACCENT_COLOR, stroke: ACCENT_FG, text: ACCENT_FG },
  past:    { fill: IDLE_BG,      stroke: PAST_BORDER, text: PAST_FG },
  idle:    { fill: IDLE_BG,      stroke: IDLE_BORDER, text: IDLE_FG },
};

export interface MarkerStyle {
  /** Background color (formerly Symbol fillColor). */
  fill: string;
  /** Border color (formerly Symbol strokeColor). */
  stroke: string;
  /** Label text color (formerly MarkerLabel color). */
  text: string;
  /** Diameter in px (formerly Symbol scale × 2). 18→36, 14→28. */
  size: number;
  /** Border width in px (formerly Symbol strokeWeight). */
  borderWidth: number;
  /** Label font size (formerly MarkerLabel fontSize). */
  fontSize: string;
  /** Label text (pin index as string). */
  label: string;
  /** Stacking order. focused → 1000，其他 undefined. */
  zIndex?: number;
}

/**
 * markerStyle — derive marker visual props (colors, sizes) per state.
 * Exported for unit tests; the pure-data shape lets us assert visual contract
 * without rendering into DOM.
 *
 * v2.31.75: AdvancedMarkerElement 遷移後 markerIcon (return Symbol+label) 拆成兩個
 * helper：`markerStyle` (pure data) + `markerContent` (build DOM)。
 */
export function markerStyle(
  pin: MapPin,
  isFocused: boolean,
  isPast: boolean,
  dayCol?: string,
): MarkerStyle {
  const state: MarkerState = isFocused ? 'focused' : isPast ? 'past' : 'idle';
  const base = STATE_COLORS[state];
  // dayCol overrides idle stroke + text only — focused/past keep their tokens.
  const stroke = state === 'idle' && dayCol ? dayCol : base.stroke;
  const text = state === 'idle' && dayCol ? dayCol : base.text;

  return {
    fill: base.fill,
    stroke,
    text,
    size: isFocused ? 36 : 28,
    borderWidth: isFocused ? 2 : 1.5,
    fontSize: isFocused ? '13px' : '12px',
    label: String(pin.index),
    zIndex: isFocused ? 1000 : undefined,
  };
}

/**
 * markerContent — build the HTMLDivElement consumed by
 * `AdvancedMarkerElement.content`. Pure DOM, no React.
 *
 * v2.31.84：v2.31.79 fix 1px halo + 1.5px ring 不夠強，user 反映 prod
 * 仍難讀（4 marker 重疊那覇都心 5/6/4/3）。三層加強：
 *   1. text-shadow halo 1px → 2px：marker overlap 時下方 marker bg 露出，
 *      halo 用自己 fill 蓋住，2px halo 比 1px 明顯
 *   2. box-shadow 加 `0 0 0 3px rgba(0,0,0,0.18)` drop shadow ring：
 *      所有 state 統一 elevation，marker 間有明顯陰影分離（不依賴 fill 同
 *      色，普適於 idle/focused/past）
 *   3. 保留 v2.31.79 inner 1.5px ${fill} ring（marker overlap 蓋層邏輯）
 */
export function markerContent(style: MarkerStyle): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'tp-marker';
  div.textContent = style.label;
  // v2.31.93：focused marker (zIndex ≥ 1000) 加 accent-subtle outer ring +
  // 加深 drop shadow，user 反映「被點的 stop 沒浮在最高 被壓住了」。
  // Google AdvancedMarkerElement.zIndex 已給 DOM stacking，但相鄰 marker
  // overlap 時視覺凸度不夠 — CSS box-shadow 補強。
  const isFocused = typeof style.zIndex === 'number' && style.zIndex >= 1000;
  const shadow = isFocused
    ? `0 0 0 1.5px ${style.fill}, 0 0 0 5px rgba(217, 120, 72, 0.35), 0 6px 16px rgba(42, 31, 24, 0.35)`
    : `0 0 0 1.5px ${style.fill}, 0 0 0 3px rgba(0, 0, 0, 0.18)`;
  div.style.cssText = `
    width: ${style.size}px;
    height: ${style.size}px;
    border-radius: 50%;
    background: ${style.fill};
    border: ${style.borderWidth}px solid ${style.stroke};
    box-shadow: ${shadow};
    color: ${style.text};
    font-size: ${style.fontSize};
    font-weight: 700;
    font-family: Inter, 'Noto Sans TC', sans-serif;
    text-shadow: -2px -2px 0 ${style.fill}, 2px -2px 0 ${style.fill}, -2px 2px 0 ${style.fill}, 2px 2px 0 ${style.fill}, 0 -2px 0 ${style.fill}, 0 2px 0 ${style.fill}, -2px 0 0 ${style.fill}, 2px 0 0 ${style.fill};
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    user-select: none;
    cursor: pointer;
    position: relative;
    ${isFocused ? 'z-index: 1000;' : ''}
  `;
  return div;
}

/* ===== Segment (polyline) styling ===== */

export interface PolylineStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  /** Set to dashed when approx fallback OR even-day (color-blind aid). */
  icons?: google.maps.IconSequence[];
}

/**
 * Build Google Polyline style options matching prior Leaflet style logic.
 * dashArray '6,6' → use IconSequence with line dash icon (Google's idiom).
 */
export function segmentStyle(isActive: boolean, approx: boolean, dayNum?: number): PolylineStyle {
  let color: string;
  let weight: number;
  let dashed: boolean;

  if (dayNum !== undefined) {
    const palette = dayPolylineStyle(dayNum);
    color = palette.color;
    weight = isActive ? 4 : palette.weight;
    dashed = approx || palette.dashArray !== undefined;
  } else {
    color = isActive ? ACCENT_COLOR : '#C8B89F';
    weight = isActive ? 4 : 3;
    dashed = approx;
  }

  const style: PolylineStyle = {
    strokeColor: color,
    strokeOpacity: dashed ? 0 : (isActive ? 0.85 : 0.6),
    strokeWeight: weight,
  };

  if (dashed) {
    style.icons = [
      {
        icon: {
          path: 'M 0,-1 0,1',
          strokeOpacity: isActive ? 0.85 : 0.6,
          scale: weight,
        },
        offset: '0',
        repeat: '12px',
      },
    ];
  }

  return style;
}

/* ===== Segment-pair builder ===== */

export interface SegmentPair {
  from: Coord;
  to: Coord;
  isActive: boolean;
  key: string;
  dayNum?: number;
}

export function buildSegments(params: {
  pins: MapPin[];
  pinsByDay?: Map<number, MapPin[]>;
  focusedIdx: number;
  pinIndexById: Map<number, number>;
  dayNum?: number;
}): SegmentPair[] {
  const { pins, pinsByDay, focusedIdx, pinIndexById, dayNum } = params;
  const pairs: SegmentPair[] = [];

  if (pinsByDay && pinsByDay.size > 0) {
    const sortedDays = [...pinsByDay.keys()].sort((a, b) => a - b);
    for (const d of sortedDays) {
      const dayPins = [...(pinsByDay.get(d) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < dayPins.length - 1; i++) {
        const a = dayPins[i]!;
        const b = dayPins[i + 1]!;
        const aIdx = pinIndexById.get(a.id) ?? -1;
        const bIdx = pinIndexById.get(b.id) ?? -1;
        pairs.push({
          from: { lat: a.lat, lng: a.lng },
          to: { lat: b.lat, lng: b.lng },
          isActive: focusedIdx === aIdx || focusedIdx === bIdx,
          key: `${a.id}->${b.id}`,
          dayNum: d,
        });
      }
    }
    return pairs;
  }

  if (pins.length < 2) return [];
  for (let i = 0; i < pins.length - 1; i++) {
    const a = pins[i]!;
    const b = pins[i + 1]!;
    pairs.push({
      from: { lat: a.lat, lng: a.lng },
      to: { lat: b.lat, lng: b.lng },
      isActive: focusedIdx === i || focusedIdx === i + 1,
      key: `${a.id}->${b.id}`,
      dayNum,
    });
  }
  return pairs;
}
