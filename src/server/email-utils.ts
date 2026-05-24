/**
 * email-utils.ts — Unicode-correct email normalisation
 *
 * v2.33.59 round 13: 取代散落 `email.toLowerCase()` 比對。
 *
 * 為何不只 toLowerCase:
 *   - Turkish I/i locale-sensitive: `'İ'.toLowerCase()` 在 standard JS 返
 *     `'i̇'` (U+0069 + U+0307 combining dot)，不是 `'i'`。同 user 不同
 *     輸入路徑 (signup vs invite) 拿到不同字串 → 比對失敗。
 *   - Homograph: `payṗal.com` vs `paypal.com` 看似相同實際不同 codepoint。
 *   - 半形 / 全形 ＠ U+FF20 vs @ U+0040 — 若 input source 不一致也失敗。
 *
 * NFKC normalize 把 visually equivalent codepoint 統一 (combining chars
 * compose, full-width 變 ASCII)，再 toLowerCase casefold。
 *
 * Apply at:
 *   - 寫入端 (users.email INSERT, trip_invitations.invited_email INSERT)
 *   - 比對端 (invitation accept email check, permissions lookup)
 */

/**
 * 標準化 email — NFKC + lowercase。Idempotent (normalize 已 normalize 過的
 * email 結果相同)。用於寫入 + 比對兩端。
 */
export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').toLowerCase();
}
