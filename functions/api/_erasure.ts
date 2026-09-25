/**
 * 帳號刪除（erasure routine）
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑。
 *
 * Owner 決策（2026-07-20）：
 *   - 擁有的行程 → **一併刪除**（含共編者的）
 *   - `audit_log` → **匿名化保留列**（洗掉個資，保留行為紀錄供稽核）
 *
 * ⚠ 為什麼逐表顯式刪除、不靠 CASCADE：
 *   ① live schema 有 6 張表帶 `trip_id` 卻**無** trips 外鍵
 *      （audit_log / error_reports / permissions / requests / trip_requests / trip_permissions）
 *      → 刪 trip 會留孤兒列
 *   ② 有 14 張表存了使用者身分卻**無** users 外鍵 → 刪 user 完全不連動
 *      最嚴重的是 `session_devices`（刪帳號後 session 還在）與 `audit_log.changed_by`（明文 email 永久留存）
 *   ③ 不依賴 D1 的 FK 強制設定，順序自己控、可測
 *
 * ⚠ 刪除順序有意義：`trips.owner_user_id` 是 `ON DELETE RESTRICT`，
 *    不先把行程處理掉，最後的 `DELETE FROM users` 會失敗。
 */

/** 匿名化後 `audit_log.changed_by` 的前綴。刻意保留可辨識的形狀供稽核追溯同一主體。 */
export const ERASURE_ANON_PREFIX = 'deleted-user-';

export interface ErasureSummary {
  /** users.id 是 **TEXT** PK（非 autoincrement integer），型別不可寫成 number。 */
  userId: string;
  /** 實際刪掉的行程數（該使用者為 owner 的） */
  tripsDeleted: number;
  /** audit_log 被匿名化的列數 */
  auditRowsAnonymized: number;
  /** 每張表實際影響的列數，供 audit 與問題排查 */
  tablesCleared: Record<string, number>;
}

/**
 * 隨行程刪除的子表。live schema 上這些**有** trips 外鍵（CASCADE），
 * 但我們仍顯式刪 —— 見檔頭③。
 */
const TRIP_CHILD_TABLES = [
  'trip_days', 'trip_destinations', 'trip_emergency_contacts',
  'trip_flights', 'trip_health_reports', 'trip_invitations', 'trip_lodgings',
  'trip_note_ai_exclusions', 'trip_note_ai_jobs', 'trip_pois', 'trip_pretrip_notes', 'trip_reservations',
  'trip_segments', 'trip_shares',
] as const;

/**
 * 有 `trip_id` 但**無** trips 外鍵的表 —— 刪行程時不會連動，必須顯式清。
 * `audit_log` 不在此列：它走匿名化不走刪除（owner 決策）。
 */
const TRIP_ORPHAN_TABLES = [
  'error_reports', 'permissions', 'requests', 'trip_requests', 'trip_permissions',
] as const;

/**
 * 有 `user_id` 但**無** users 外鍵的表 —— 刪使用者時不會連動。
 * `auth_audit_log` 保留在此：它雖有 30 天保留期，但刪帳號時就該清掉可識別列。
 */
const USER_ORPHAN_TABLES = [
  'session_devices', 'auth_audit_log',
] as const;

/**
 * Build the whole erasure as one D1 batch. D1 rolls a failed batch back, so a
 * retry starts with an intact account rather than a partially deleted one.
 */
export async function eraseUserAccount(db: D1Database, userId: string): Promise<ErasureSummary> {
  const user = await db.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId).first<{ email: string }>();
  // The supported deployment snapshots do not all contain every historical
  // table; omit absent optional tables before constructing the atomic batch.
  const schema = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all<{ name: string }>();
  const present = new Set((schema.results ?? []).map(row => row.name));
  const statements: D1PreparedStatement[] = [];
  const labels: string[] = [];
  const add = (label: string, sql: string, ...binds: unknown[]) => {
    if (!present.has(label === 'audit_log(anonymized)' ? 'audit_log' : label)) return;
    labels.push(label);
    statements.push(db.prepare(sql).bind(...binds));
  };

  if (present.has('trip_days')) {
    add('trip_entries', `DELETE FROM trip_entries WHERE day_id IN
      (SELECT id FROM trip_days WHERE trip_id IN (SELECT id FROM trips WHERE owner_user_id = ?))`, userId);
  }
  for (const table of TRIP_CHILD_TABLES) {
    add(table, `DELETE FROM ${table} WHERE trip_id IN (SELECT id FROM trips WHERE owner_user_id = ?)`, userId);
  }
  for (const table of TRIP_ORPHAN_TABLES) {
    add(table, `DELETE FROM ${table} WHERE trip_id IN (SELECT id FROM trips WHERE owner_user_id = ?)`, userId);
  }
  add('trips', 'DELETE FROM trips WHERE owner_user_id = ?', userId);
  add('audit_log(anonymized)', `UPDATE audit_log
    SET changed_by = ?, changed_by_user_id = NULL, diff_json = NULL, snapshot = NULL
    WHERE changed_by_user_id = ?`, `${ERASURE_ANON_PREFIX}${userId}`, userId);
  for (const table of USER_ORPHAN_TABLES) add(table, `DELETE FROM ${table} WHERE user_id = ?`, userId);
  add('oauth_models', `DELETE FROM oauth_models WHERE json_extract(payload, '$.user_id') = ?
    OR json_extract(payload, '$.uid') = ?`, userId, userId);
  if (user?.email) {
    add('rate_limit_buckets', 'DELETE FROM rate_limit_buckets WHERE bucket_key LIKE ?', `%:${user.email}`);
    for (const table of ['requests', 'trip_requests']) {
      add(table, `DELETE FROM ${table} WHERE submitted_by = ?`, user.email);
    }
    add('trip_invitations', 'DELETE FROM trip_invitations WHERE invited_by = ?', userId);
  }
  add('users', 'DELETE FROM users WHERE id = ?', userId);

  const results = await db.batch(statements);
  const tablesCleared: Record<string, number> = {};
  results.forEach((result, index) => {
    const count = result.meta?.changes ?? 0;
    if (count > 0) tablesCleared[labels[index]!] = (tablesCleared[labels[index]!] ?? 0) + count;
  });
  return { userId, tripsDeleted: tablesCleared.trips ?? 0,
    auditRowsAnonymized: tablesCleared['audit_log(anonymized)'] ?? 0, tablesCleared };
}
