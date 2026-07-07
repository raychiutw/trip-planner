/**
 * Route constants — single source of truth for in-app paths.
 *
 * Usage:
 *   import { routes } from '../lib/routes';
 *   navigate(routes.tripEdit(tripId));
 *   navigate(routes.tripsSelected(tripId));
 */

export const routes = {
  // Top-level
  trips: () => '/trips',
  tripsNew: () => '/trips/new',
  tripsSelected: (tripId: string) => `/trips?selected=${encodeURIComponent(tripId)}`,
  trip: (tripId: string) => `/trip/${encodeURIComponent(tripId)}`,
  tripEdit: (tripId: string) => `/trip/${encodeURIComponent(tripId)}/edit`,
  tripCollab: (tripId: string) => `/trip/${encodeURIComponent(tripId)}/collab`,
  tripMap: (tripId: string) => `/trip/${encodeURIComponent(tripId)}/map`,
  tripAddStop: (tripId: string, dayNum: number) =>
    `/trip/${encodeURIComponent(tripId)}/add-stop?day=${dayNum}`,
  tripStopAction: (tripId: string, entryId: number, action: 'copy' | 'move') =>
    `/trip/${encodeURIComponent(tripId)}/stop/${entryId}/${action}`,

  // Auth
  login: () => '/login',
  signup: () => '/signup',

  // Account / settings
  account: () => '/account',
  accountAppearance: () => '/account/appearance',
  accountNotifications: () => '/account/notifications',
  settingsConnectedApps: () => '/settings/connected-apps',
  settingsSessions: () => '/settings/sessions',

  // Developer
  developerApps: () => '/developer/apps',
  developerAppNew: () => '/developer/apps/new',

  // Other top-level
  chat: () => '/chat',
  map: () => '/map',
  explore: () => '/explore',
} as const;

/**
 * Validate an untrusted `?returnTo=` / `?next=` style redirect target.
 * v2.33.38 round 3: previously no shared helper, each callsite did ad-hoc
 * checks. Centralizing here prevents open-redirect bugs:
 *   - Reject empty / non-string input.
 *   - Reject protocol-relative `//evil.com`（會打到不同 host）。
 *   - Reject absolute URL `https://evil.com` (would leave the SPA).
 *   - Accept only same-origin path starting with `/path`.
 *
 * Returns the safe path, or `fallback` (default `/trips`).
 */
export function safeReturnTo(raw: unknown, fallback = '/trips'): string {
  if (typeof raw !== 'string' || !raw) return fallback;
  // 拒 protocol-relative `//host` 與 absolute URL `https://host`
  if (raw.startsWith('//')) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // backslash variants (Safari) - reject
  if (raw.includes('\\')) return fallback;
  return raw;
}
