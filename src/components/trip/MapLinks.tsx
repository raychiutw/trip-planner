/* ===== MapLinks Component ===== */
/* v2.30.14 redesign: 拔 Google 「G」 brand badge + Apple SVG，改 terracotta */
/* outline chip + location-pin icon + accent-deep text，與 timeline rail 其他 */
/* chip 視覺語言一致。                                                       */
/* v2.30.15 (migration 0066): mapcode 整段 rip out — Google/Apple Map link  */
/* 已涵蓋導航需求。                                                          */

import { memo } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { escUrl } from '../../lib/sanitize';

const SCOPED_STYLES = `
.tp-map-links {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.tp-map-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: var(--radius-full);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  color: var(--color-accent-deep);
  font-size: var(--font-size-footnote);
  font-weight: 600;
  text-decoration: none;
  transition: background 120ms;
  line-height: 1.2;
}
.tp-map-link:hover { background: var(--color-hover); }
.tp-map-link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-map-link .svg-icon { width: 14px; height: 14px; }
.tp-map-link-block {
  padding: 8px 14px;
  min-height: var(--spacing-tap-min);
}
.tp-map-link-block .svg-icon { width: 16px; height: 16px; }
@media (max-width: 760px) {
  .tp-map-link {
    padding: 5px 10px;
    font-size: var(--font-size-caption);
  }
  .tp-map-link .svg-icon { width: 12px; height: 12px; }
}
`;

// v2.33.37 round 2: MapLocation canonical 已移到 src/types/timeline.ts。
export type { MapLocation } from '../../types/timeline';
import type { MapLocation } from '../../types/timeline';

interface MapLinksProps {
  location: MapLocation;
  inline?: boolean;
}

/**
 * Resolves the Google Maps URL for a location.
 * Priority: googleQuery → url → fallback search by name.
 */
function resolveGoogleUrl(loc: MapLocation): string {
  let gq = escUrl(loc.googleQuery || loc.url || '');
  if (!gq || !/^https?:/i.test(gq)) {
    gq = 'https://maps.google.com/?q=' + encodeURIComponent(loc.name || '');
  }
  return gq;
}

/**
 * Resolves the Apple Maps URL for a location.
 * Priority: appleQuery → fallback search by name.
 */
function resolveAppleUrl(loc: MapLocation): string {
  let aq = escUrl(loc.appleQuery || '');
  if (!aq || !/^https?:/i.test(aq)) {
    aq = 'https://maps.apple.com/?q=' + encodeURIComponent(loc.name || '');
  }
  return aq;
}

export const MapLinks = memo(function MapLinks({ location: loc, inline = false }: MapLinksProps) {
  const chipCls = clsx('tp-map-link', !inline && 'tp-map-link-block');
  const googleUrl = resolveGoogleUrl(loc);
  const appleUrl = resolveAppleUrl(loc);
  const naverUrl = escUrl(loc.naverQuery || '');
  const showNaver = naverUrl && /^https?:/i.test(naverUrl);

  return (
    <span className="tp-map-links">
      <style>{SCOPED_STYLES}</style>
      <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={chipCls}>
        <Icon name="location-pin" />
        <span>Google 地圖</span>
      </a>
      <a href={appleUrl} target="_blank" rel="noopener noreferrer" className={chipCls}>
        <Icon name="location-pin" />
        <span>Apple 地圖</span>
      </a>
      {showNaver && (
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className={chipCls}>
          <Icon name="location-pin" />
          <span>Naver 地圖</span>
        </a>
      )}
    </span>
  );
});

export default MapLinks;

/* ===== NavLinks — renders labelled groups of map links ===== */

// v2.33.37 round 2: NavLocation canonical 已移到 src/types/timeline.ts。
import type { NavLocation } from '../../types/timeline';
export type { NavLocation };

interface NavLinksProps {
  locations: NavLocation[];
}

export const NavLinks = memo(function NavLinks({ locations }: NavLinksProps) {
  if (!locations || locations.length === 0) return null;
  return (
    <div className="my-1 flex flex-wrap items-center">
      {locations.map((loc, i) => (
        <span key={i}>
          {loc.label && <strong>{loc.label}：</strong>}
          <MapLinks location={loc} inline />
        </span>
      ))}
    </div>
  );
});
