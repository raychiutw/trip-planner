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
 *
 * Returns `true` on success, `false` if storage was unavailable
 * (Safari private mode, QuotaExceededError). v2.33.36 code review round 1:
 * previous version threw inside `useEffect` and crashed the page.
 */
export function lsSet<T>(key: string, value: T): boolean {
  try {
    const entry: LsEntry<T> = { v: value, exp: Date.now() + LS_TTL };
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for the {v, exp} envelope. v2.33.38 round 3: defense in depth
 * — same-origin attacker writing malformed `tp-…` entry could trip the old
 * `d.exp > Date.now()` check (`d.exp` could be a string, NaN, etc.).
 */
function isLsEntry(d: unknown): d is { v: unknown; exp: number } {
  return (
    typeof d === 'object' &&
    d !== null &&
    'v' in d &&
    'exp' in d &&
    typeof (d as { exp: unknown }).exp === 'number' &&
    Number.isFinite((d as { exp: number }).exp)
  );
}

/**
 * Retrieves a value stored under `tp-{key}`.
 * Returns `null` if the key is missing, malformed, or expired.
 */
export function lsGet<T = unknown>(key: string): T | null {
  const fullKey = LS_PREFIX + key;
  const raw = (() => {
    try { return localStorage.getItem(fullKey); } catch { return null; }
  })();
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — remove the corrupt entry so the next call doesn't repay
    // the parse cost. localStorage.removeItem 也可能 throw (locked profile)，包 try。
    try { localStorage.removeItem(fullKey); } catch { /* noop */ }
    return null;
  }
  if (!isLsEntry(parsed)) {
    try { localStorage.removeItem(fullKey); } catch { /* noop */ }
    return null;
  }
  if (parsed.exp > Date.now()) return parsed.v as T;
  try { localStorage.removeItem(fullKey); } catch { /* noop */ }
  return null;
}

/**
 * Removes the entry stored under `tp-{key}`.
 */
export function lsRemove(key: string): void {
  try { localStorage.removeItem(LS_PREFIX + key); } catch { /* noop — locked profile / disabled storage */ }
}

/**
 * Renews the expiry timestamp on every existing `tp-*` entry to 6 months from now.
 */
export function lsRenewAll(): void {
  const newExp = Date.now() + LS_TTL;
  // v2.33.36: snapshot keys first — a parallel tab removing items mid-iteration
  // would shift `localStorage.key(i)` indices and skip entries.
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf(LS_PREFIX) === 0) keys.push(k);
  }
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const d = JSON.parse(raw) as unknown;
      if (!isLsEntry(d)) continue;
      d.exp = newExp;
      localStorage.setItem(k, JSON.stringify(d));
    } catch {
      // ignore malformed entries
    }
  }
}
