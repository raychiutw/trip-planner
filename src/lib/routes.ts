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
