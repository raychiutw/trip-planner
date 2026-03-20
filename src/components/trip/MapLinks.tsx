/* ===== MapLinks Component ===== */
/* Renders Google Map / Apple Map / Naver Map links + optional mapcode display */

import { memo } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { escUrl } from '../../lib/sanitize';

/** Apple logo SVG — embedded directly (sourced from app.js line 14). */
const APPLE_SVG =
  '<svg viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';

/** Location data shape used by map link generation. */
export interface MapLocation {
  name?: string;
  googleQuery?: string;
  appleQuery?: string;
  naverQuery?: string;
  /** Legacy field – falls back for google link */
  url?: string;
  mapcode?: string;
  label?: string;
}

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
  const cls = clsx('map-link', inline && 'map-link-inline');
  const googleUrl = resolveGoogleUrl(loc);
  const appleUrl = resolveAppleUrl(loc);
  const naverUrl = escUrl(loc.naverQuery || '');
  const showNaver = naverUrl && /^https?:/i.test(naverUrl);

  return (
    <>
      <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        <span className="g-icon">G</span> Map
      </a>
      <a href={appleUrl} target="_blank" rel="noopener noreferrer" className={clsx(cls, 'apple')}>
        <span
          className="apple-icon"
          dangerouslySetInnerHTML={{ __html: APPLE_SVG }}
        />
        {' '}Map
      </a>
      {showNaver && (
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className={clsx(cls, 'naver')}>
          <span className="n-icon">N</span> N Map
        </a>
      )}
      {loc.mapcode && (
        <span className={clsx(cls, 'mapcode')}>
          <Icon name="device" /> {loc.mapcode}
        </span>
      )}
    </>
  );
});

export default MapLinks;

/* ===== NavLinks — renders labelled groups of map links ===== */

export interface NavLocation extends MapLocation {
  label?: string;
}

interface NavLinksProps {
  locations: NavLocation[];
}

export const NavLinks = memo(function NavLinks({ locations }: NavLinksProps) {
  if (!locations || locations.length === 0) return null;
  return (
    <div className="nav-links">
      {locations.map((loc, i) => (
        <span key={i}>
          {loc.label && <strong>{loc.label}：</strong>}
          <MapLinks location={loc} inline />
        </span>
      ))}
    </div>
  );
});
