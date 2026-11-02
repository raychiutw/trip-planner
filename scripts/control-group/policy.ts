/**
 * 對照組的消毒政策：每一張表都必須明確表態「複製（含哪些欄位怎麼處理）」或「整張不複製」。
 * 憑證類（token、client secret、密碼雜湊、session、邀請與分享 token）整張不複製，而且來源端
 * 連 SELECT 都不會對它們下：只讀 COPY_TABLES。新增資料表沒有表態，tests/unit/control-group-sanitize 會紅。
 */
export type Row = Record<string, unknown>;

export type ColumnRule =
  | 'null' // 一律 NULL
  | 'mask' // 有值就換成 [masked]，原本是 NULL 就維持 NULL（用在可能是 NOT NULL 的個人識別欄位）
  | 'placeholder' // 換成 [truncated]（聊天內容）
  | 'email' // 是 email 就換成假位址（service:… 這類主體保留）
  | 'user-name' // User N（N 與該使用者的假 email 同號）
  | 'contact-name' // Contact N
  | 'redact-path'; // 只留前兩段路徑，去掉查詢字串

export type TablePolicy =
  | { mode: 'skip'; reason: string }
  | { mode: 'copy'; columns?: Record<string, ColumnRule>; keepNewest?: { by: string; count: number } };

const copy = (columns?: Record<string, ColumnRule>, keepNewest?: { by: string; count: number }): TablePolicy => ({
  mode: 'copy',
  ...(columns ? { columns } : {}),
  ...(keepNewest ? { keepNewest } : {}),
});
const skip = (reason: string): TablePolicy => ({ mode: 'skip', reason });

export const POLICY: Record<string, TablePolicy> = {
  // ── 憑證／個資／內部表：整張不複製 ──
  oauth_models: skip('access／refresh token、授權碼、session 的 payload'),
  client_apps: skip('client secret 雜湊（對照組的測試自行建立 client）'),
  auth_identities: skip('密碼雜湊與第三方帳號 id'),
  session_devices: skip('session id 與裝置資訊'),
  trip_invitations: skip('邀請 token 雜湊與被邀請者 email'),
  trip_shares: skip('分享 token 雜湊'),
  rate_limit_buckets: skip('以 IP／帳號為 key 的限流狀態'),
  pois_search_cache: skip('使用者搜尋字串的快取'),
  app_settings: skip('系統設定與 API 設定（預設值由 migration 種）'),
  error_reports: skip('自由文字錯誤與 user agent'),
  d1_migrations: skip('migration 紀錄由套用 migration 自己產生'),

  // ── 複製：身分 ──
  users: copy({ email: 'email', display_name: 'user-name', avatar_url: 'null' }),
  account_notification_preferences: copy(),

  // ── 複製：行程內容（自由文字一律再過一次 email／token 洗滌）──
  trips: copy(),
  trip_days: copy(),
  trip_entries: copy(),
  trip_entry_pois: copy(),
  trip_destinations: copy(),
  trip_segments: copy(),
  trip_pretrip_notes: copy(),
  trip_permissions: copy(),
  trip_flights: copy(),
  trip_lodgings: copy({ booking_no: 'mask', phone: 'mask' }),
  trip_reservations: copy({ reservation_no: 'mask', phone: 'mask' }),
  trip_emergency_contacts: copy({ name: 'contact-name', phone: 'mask', email: 'email' }),
  trip_health_reports: copy(),
  trip_note_ai_jobs: copy(),
  trip_note_ai_exclusions: copy(),
  poi_favorites: copy(),
  poi_relations: copy(),
  pois: copy({ email: 'email' }),
  companion_request_actions: copy(),

  // ── 複製但截斷：聊天與 log ──
  trip_requests: copy({ message: 'placeholder', reply: 'placeholder', submitted_by: 'email', processed_by: 'email' }, { by: 'id', count: 50 }),
  audit_log: copy({ diff_json: 'null', snapshot: 'null', changed_by: 'email' }, { by: 'id', count: 100 }),
  auth_audit_log: copy({ ip_hash: 'mask', user_agent: 'null', metadata: 'null' }, { by: 'id', count: 50 }),
  api_logs: copy({ path: 'redact-path', error: 'null' }, { by: 'id', count: 200 }),
};

/** 來源端只對這些表下 SELECT。 */
export const COPY_TABLES = Object.entries(POLICY)
  .filter(([, p]) => p.mode === 'copy')
  .map(([t]) => t);

export const ALLOWED_SOURCE_DB = 'trip-planner-db-staging';
const FORBIDDEN = ['trip-planner-db', 'd61c42d5-8083-4e18-9b6c-70e133e37322'];

/** 對照組的來源只能是 staging；正式資料庫的名稱與 id 一律拒絕。 */
export function assertAllowedSource(name: string): void {
  if (FORBIDDEN.includes(name) || name !== ALLOWED_SOURCE_DB) {
    throw new Error(`對照組的來源只能是 ${ALLOWED_SOURCE_DB}（staging）；拒絕 "${name}"`);
  }
}

/** 依外鍵（[子表, 父表]）排出插入順序：父表在前。無法排序（循環）時把剩下的照原順序放後面。 */
export function tableOrder(edges: [string, string][], tables: string[]): string[] {
  const set = new Set(tables);
  const parents = new Map<string, Set<string>>(tables.map((t) => [t, new Set<string>()]));
  for (const [child, parent] of edges) {
    if (child !== parent && set.has(child) && set.has(parent)) parents.get(child)!.add(parent);
  }
  const out: string[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (out.length < tables.length && progressed) {
    progressed = false;
    for (const t of tables) {
      if (done.has(t)) continue;
      if ([...parents.get(t)!].every((p) => done.has(p))) {
        out.push(t);
        done.add(t);
        progressed = true;
      }
    }
  }
  for (const t of tables) if (!done.has(t)) out.push(t);
  return out;
}
