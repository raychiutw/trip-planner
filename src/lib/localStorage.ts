/** Key prefix used for all trip-planner localStorage entries. */
export const LS_PREFIX = 'tp-';

/** Time-to-live in milliseconds: 6 months (180 days). */
export const LS_TTL = 180 * 86400000;

/** localStorage key for the user's last selected trip. */
export const LS_KEY_TRIP_PREF = 'trip-pref';

interface LsEntry<T> {
  v: T;
  exp: number;
}

/**
 * Persists a value under `tp-{key}` with a 6-month expiry timestamp.
 */
export function lsSet<T>(key: string, value: T): void {
  const entry: LsEntry<T> = { v: value, exp: Date.now() + LS_TTL };
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
}

/**
 * Retrieves a value stored under `tp-{key}`.
 * Returns `null` if the key is missing, malformed, or expired.
 */
export function lsGet<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as LsEntry<T>;
    if (d && d.exp > Date.now()) return d.v;
    localStorage.removeItem(LS_PREFIX + key);
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Removes the entry stored under `tp-{key}`.
 */
export function lsRemove(key: string): void {
  localStorage.removeItem(LS_PREFIX + key);
}

/**
 * Renews the expiry timestamp on every existing `tp-*` entry to 6 months from now.
 */
export function lsRenewAll(): void {
  const newExp = Date.now() + LS_TTL;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf(LS_PREFIX) === 0) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const d = JSON.parse(raw) as LsEntry<unknown>;
        if (d && d.exp) {
          d.exp = newExp;
          localStorage.setItem(k, JSON.stringify(d));
        }
      } catch (_e) {
        // ignore malformed entries
      }
    }
  }
}
