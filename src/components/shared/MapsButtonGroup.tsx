/**
 * MapsButtonGroup — three buttons (Google / Apple / Naver) for opening a POI
 * in the user's preferred map app.
 *
 * Replaces the single hardcoded `pois.maps` link button. The URL is built
 * client-side via src/lib/mapsUrl from name + lat/lng, so no DB column is
 * needed for the URL itself.
 *
 * Usage:
 *   <MapsButtonGroup poi={{ name, address, lat, lng }} />
 *
 * V2 Terracotta: chip-style buttons, hairline border, 32px min height (smaller
 * than tap-min 44 since these are inline secondary actions next to a primary
 * info card; user already engaged with the POI). Small SVG icon + text label.
 */
import type { CSSProperties } from 'react';
import { buildMapsUrl, type MapsUrlInput, type MapProvider } from '../../lib/mapsUrl';

interface MapsButtonGroupProps {
  poi: MapsUrlInput;
  /** Override which providers to show (default: all three). */
  providers?: MapProvider[];
  /** Compact mode = icon-only, no label. */
  compact?: boolean;
}

const DEFAULT_PROVIDERS: MapProvider[] = ['google', 'apple', 'naver'];

const PROVIDER_LABEL: Record<MapProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  naver: 'Naver',
};

const PROVIDER_COLOR: Record<MapProvider, string> = {
  google: 'var(--color-google-maps)',     // tokens.css → #4285F4
  apple: 'var(--color-foreground)',       // Apple has no brand-color in our palette; use ink
  naver: 'var(--color-naver-maps)',       // tokens.css → #03C75A
};

const SCOPED_STYLES = `
.tp-maps-btn-group {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.tp-maps-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  min-height: 32px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: var(--radius-full);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-foreground);
  text-decoration: none;
  cursor: pointer;
  transition: all 150ms var(--transition-timing-function-apple);
}
.tp-maps-btn:hover {
  border-color: var(--tp-maps-btn-color, var(--color-line-strong));
  color: var(--tp-maps-btn-color, var(--color-foreground));
  background: var(--color-hover);
}
.tp-maps-btn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tp-maps-btn-color, var(--color-line-strong));
}
.tp-maps-btn.is-compact { padding: 6px 8px; }
.tp-maps-btn.is-compact .tp-maps-btn-label { display: none; }
`;

export function MapsButtonGroup({
  poi,
  providers = DEFAULT_PROVIDERS,
  compact = false,
}: MapsButtonGroupProps) {
  return (
    <span className="tp-maps-btn-group" role="group" aria-label="開啟地圖">
      <style>{SCOPED_STYLES}</style>
      {providers.map((provider) => {
        const url = buildMapsUrl(poi, provider);
        const colorVar: CSSProperties = { ['--tp-maps-btn-color' as string]: PROVIDER_COLOR[provider] };
        return (
          <a
            key={provider}
            className={`tp-maps-btn${compact ? ' is-compact' : ''}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={colorVar}
            aria-label={`在 ${PROVIDER_LABEL[provider]} 地圖開啟 ${poi.name}`}
          >
            <span className="tp-maps-btn-dot" aria-hidden="true"></span>
            <span className="tp-maps-btn-label">{PROVIDER_LABEL[provider]}</span>
          </a>
        );
      })}
    </span>
  );
}
