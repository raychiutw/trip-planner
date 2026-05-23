/**
 * redirect.ts — centralized redirect-target validation.
 *
 * v2.33.39 round 4 security audit: previously `sanitizeRedirectAfter` lived in
 * `LoginPage.tsx` and only blocked `//evil.com`. Browsers normalize backslashes
 * and percent-encoded slashes before navigating, so `/\evil.com`, `/%2f%2fevil`,
 * and whitespace-prefixed payloads could escape to attacker origin after login.
 *
 * 集中後所有 redirect param 走同個 hardened path。對齊 `safeReturnTo` in
 * `routes.ts`（後者較寬容 — 接受 query / hash，本檔嚴格用於 OAuth flow）。
 */

const ENCODED_SLASH_PATTERN = /%2f/i;
const ENCODED_BACKSLASH_PATTERN = /%5c/i;

/**
 * Validate `?redirect_after=` / OAuth `continue` param. Returns the safe path
 * or `null` if rejected. Caller is responsible for fallback default.
 *
 * Accepted: `/path`, `/path?q=1`, `/path#hash`
 * Rejected:
 *   - empty / non-string
 *   - protocol-relative `//host` / encoded `/%2f%2fhost`
 *   - absolute URL `https://host`
 *   - backslash variant `/\\host` / encoded `/%5chost`
 *   - whitespace-prefixed (some browsers trim before navigate)
 *   - any value that doesn't start with `/` after trim
 */
export function sanitizeRedirectAfter(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Reject whitespace-prefixed payloads (browsers strip leading whitespace
  // before navigating, turning `  //evil` into `//evil`).
  if (value !== value.trimStart()) return null;
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  if (ENCODED_SLASH_PATTERN.test(value.slice(0, 6))) return null; // `/%2f...`
  if (ENCODED_BACKSLASH_PATTERN.test(value.slice(0, 6))) return null;
  return value;
}
