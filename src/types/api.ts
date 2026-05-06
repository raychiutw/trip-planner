/**
 * API-related TypeScript interfaces.
 *
 * Covers: requests, permissions, audit_log tables and the AuthData shape
 * used by the middleware. Field names follow the frontend camelCase convention
 * produced by mapRow() (js/map-row.js) where applicable.
 */

// ---------------------------------------------------------------------------
// Error Codes（前後端共用）
// ---------------------------------------------------------------------------

export const ErrorCode = {
  // 網路（前端產生）
  NET_TIMEOUT: 'NET_TIMEOUT',
  NET_OFFLINE: 'NET_OFFLINE',
  // 認證
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  // 權限
  PERM_DENIED: 'PERM_DENIED',
  PERM_ADMIN_ONLY: 'PERM_ADMIN_ONLY',
  PERM_NOT_OWNER: 'PERM_NOT_OWNER',
  // 資料
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_VALIDATION: 'DATA_VALIDATION',
  DATA_CONFLICT: 'DATA_CONFLICT',
  DATA_ENCODING: 'DATA_ENCODING',
  DATA_SAVE_FAILED: 'DATA_SAVE_FAILED',
  // 系統
  SYS_INTERNAL: 'SYS_INTERNAL',
  SYS_DB_ERROR: 'SYS_DB_ERROR',
  SYS_RATE_LIMIT: 'SYS_RATE_LIMIT',
  // Companion path（poi-favorites-rename §4 / §6.3）
  // companion_request_actions UNIQUE 衝突 → 同 requestId 同 action 重複呼叫
  COMPANION_QUOTA_EXCEEDED: 'COMPANION_QUOTA_EXCEEDED',
  // Google Maps Platform (v2.23.0 google-maps-migration)
  MAPS_LOCKED: 'MAPS_LOCKED',
  MAPS_UPSTREAM_FAILED: 'MAPS_UPSTREAM_FAILED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export const ERROR_MESSAGES: Record<ErrorCodeType, string> = {
  NET_TIMEOUT: '連線逾時，請檢查網路',
  NET_OFFLINE: '目前離線，顯示快取資料',
  AUTH_REQUIRED: '請先登入',
  AUTH_EXPIRED: '登入已過期，請重新登入',
  AUTH_INVALID: '認證失敗，請重新登入',
  PERM_DENIED: '你沒有此操作的權限',
  PERM_ADMIN_ONLY: '僅管理員可操作',
  PERM_NOT_OWNER: '這不是你的行程',
  DATA_NOT_FOUND: '找不到這筆資料',
  DATA_VALIDATION: '資料格式不正確',
  DATA_CONFLICT: '這筆資料已經存在',
  DATA_ENCODING: '文字編碼有誤，請用 UTF-8',
  DATA_SAVE_FAILED: '儲存失敗，請再試一次',
  SYS_INTERNAL: '系統發生錯誤，已通知開發團隊',
  SYS_DB_ERROR: '資料庫忙碌中，請稍後再試',
  SYS_RATE_LIMIT: '操作太頻繁，請稍等',
  COMPANION_QUOTA_EXCEEDED: '此 request 已執行過此操作',
  MAPS_LOCKED: '本月 Google API 已達配額，月初恢復',
  MAPS_UPSTREAM_FAILED: 'Google Maps 服務暫時無法回應，請稍後再試',
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Authentication data attached to every request by _middleware.ts.
 * Stored on context.data.auth and passed through to API handlers.
 *
 * V2 cutover (migration 0046+0047): userId is the canonical identifier.
 * email is retained for audit_log changedBy + display + dual-read fallback
 * during the email→user_id transition. After phase 2 (DROP email columns),
 * email becomes derived (JOIN users.email by id) for those use cases.
 */
export interface AuthData {
  /** Email — kept for audit_log changedBy + display. May fall back when userId is null. */
  email: string;
  /** V2 user_id (TEXT uuid). null only for service-token / pre-V2 sessions. */
  userId: string | null;
  isAdmin: boolean;
  isServiceToken: boolean;
  /** OAuth scopes from V2 Bearer token (client_credentials grant). Only present for service token. */
  scopes?: string[];
  /** OAuth client_id from V2 Bearer token. Only present for service token. */
  clientId?: string;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** Valid request status values (four-state stepper) */
export type RequestStatus = 'open' | 'received' | 'processing' | 'completed';

/**
 * A trip-edit / trip-plan request submitted by a traveller.
 *
 * DB table: requests
 * Columns: id, trip_id, mode, message, submitted_by, reply, status, created_at
 *
 * mapRow renames:
 *   trip_id      -> tripId
 *   submitted_by -> submittedBy
 *   created_at   -> createdAt
 */
export interface Request {
  id: number;
  /** DB column `trip_id` */
  tripId: string;
  message: string;
  /** DB column `submitted_by` — email of the submitter */
  submittedBy?: string | null;
  reply?: string | null;
  /** Four-state status: open → received → processing → completed */
  status: RequestStatus;
  /** DB column `created_at` */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/**
 * A permission record granting an email access to a trip.
 *
 * DB table: permissions
 * Columns: id, email, trip_id, role
 *
 * mapRow renames:
 *   trip_id -> tripId
 *
 * Special value: trip_id = '*' means access to all trips.
 *
 * Roles(v2.18.0):
 *   - owner:  trip 創建者,單一,不可改/刪
 *   - admin:  系統管理員(across all trips)
 *   - member: 共編成員,可檢視+編輯
 *   - viewer: 檢視成員,只可檢視(read-only collaborator)
 */
export type CollabRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Permission {
  id: number;
  email: string;
  /** DB column `trip_id`; '*' means all trips */
  tripId: string;
  role: CollabRole;
}

// ---------------------------------------------------------------------------
// AuditLog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PoiFavorite — 使用者跨 trip 的 POI 收藏池（migration 0050 rename）
// ---------------------------------------------------------------------------

/**
 * A POI favorite — 使用者跨 trip 的收藏清單，由 /favorites 頁面維護。
 *
 * DB table: poi_favorites（migration 0050 rename from saved_pois）
 * Columns: id, user_id, poi_id, favorited_at, note
 *
 * GET response 會 JOIN `pois` 補 POI 詳情（poiName / poiAddress / poiLat / poiLng / poiType）。
 *
 * mapRow renames (via json() deep camelCase):
 *   user_id      -> userId
 *   poi_id       -> poiId
 *   favorited_at -> favoritedAt
 *   poi_name     -> poiName
 *   poi_address  -> poiAddress
 *   poi_lat      -> poiLat
 *   poi_lng      -> poiLng
 *   poi_type     -> poiType
 */
export interface PoiFavorite {
  id: number;
  /** owner user_id — V2 cutover canonical identifier */
  userId: string;
  /** DB column `poi_id` — FK to pois(id) */
  poiId: number;
  /** DB column `favorited_at` — ISO datetime */
  favoritedAt: string;
  note?: string | null;
  // JOIN pois 欄位（GET endpoint 會回）
  poiName?: string;
  poiAddress?: string | null;
  poiLat?: number | null;
  poiLng?: number | null;
  poiType?: string;
  /**
   * GET /api/poi-favorites 回傳每筆收藏目前出現在哪些 trip / day / entry。
   * 透過 poi_favorites.poi_id ← trip_pois.poi_id 反查（單一 LEFT JOIN + json_group_array）。
   * 空陣列 = 此收藏尚未排進任何行程；可在 favorite card 顯示「目前在 N 個 trip」徽章。
   */
  usages?: PoiFavoriteUsage[];
}

/** 一筆收藏在某 trip / day / entry 的出現紀錄（GET /api/poi-favorites 回傳）。 */
export interface PoiFavoriteUsage {
  tripId: string;
  tripName: string;
  dayNum: number | null;
  dayDate: string | null;
  entryId: number | null;
}

// ---------------------------------------------------------------------------
// TripIdea — RETIRED in migration 0046 (V2 owner cutover)
// ---------------------------------------------------------------------------
//
// 「備案」概念合一進「收藏」(poi_favorites) — 跨 trip universal pool。
// 既有 trip_ideas 資料 active rows 已 migrate 進 poi_favorites (trip owner's pool)。
// 「目前在哪些 trip」資訊改透過 PoiFavorite.usages JOIN trip_pois 反查。

/**
 * An audit log entry recording every insert / update / delete.
 *
 * DB table: audit_log
 * Columns: id, trip_id, table_name, record_id, action, changed_by,
 *          request_id, diff_json, snapshot, created_at
 *
 * mapRow renames:
 *   trip_id    -> tripId
 *   table_name -> tableName
 *   record_id  -> recordId
 *   changed_by -> changedBy
 *   request_id -> requestId
 *   diff_json  -> diffJson  (string, NOT in JSON_FIELDS — not auto-parsed)
 *   created_at -> createdAt
 */
export interface AuditLog {
  id: number;
  /** DB column `trip_id` */
  tripId: string;
  /** DB column `table_name` — which table was modified */
  tableName: string;
  /** DB column `record_id` — PK of the affected row (null for trip-level ops) */
  recordId?: number | null;
  action: 'insert' | 'update' | 'delete';
  /** DB column `changed_by` — email of the actor */
  changedBy?: string | null;
  /** DB column `request_id` — links to requests.id if triggered by a request */
  requestId?: number | null;
  /**
   * DB column `diff_json` — JSON string describing field-level changes.
   * Not auto-parsed by mapRow (not in JSON_FIELDS); consumers must parse manually.
   */
  diffJson?: string | null;
  /** Full-row JSON snapshot before the change (optional, not always populated) */
  snapshot?: string | null;
  /** DB column `created_at` */
  createdAt: string;
}

