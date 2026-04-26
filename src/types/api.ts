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
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Authentication data attached to every request by _middleware.ts.
 * Stored on context.data.auth and passed through to API handlers.
 */
export interface AuthData {
  email: string;
  isAdmin: boolean;
  isServiceToken: boolean;
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
 * Columns: id, trip_id, mode, message, submitted_by, reply, status,
 *          created_at, processed_by
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
  mode: 'trip-edit' | 'trip-plan' | 'trip-info';
  /** Combined message (merged from legacy title + body) */
  message: string;
  /** @deprecated Use `message` instead. Kept for legacy compatibility. */
  title?: string;
  /** @deprecated Use `message` instead. Kept for legacy compatibility. */
  body?: string;
  /** DB column `submitted_by` — email of the submitter */
  submittedBy?: string | null;
  reply?: string | null;
  /** Four-state status: open → received → processing → completed */
  status: RequestStatus;
  /** DB column `created_at` */
  createdAt: string;
  /**
   * DB column `processed_by` (added in migration 0004).
   * @deprecated No longer set by new requests. Retained for historical data only.
   */
  processedBy?: string | null;
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
 */
export interface Permission {
  id: number;
  email: string;
  /** DB column `trip_id`; '*' means all trips */
  tripId: string;
  role: 'owner' | 'admin' | 'member';
}

// ---------------------------------------------------------------------------
// AuditLog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SavedPoi — 使用者跨 trip 的 POI 收藏（layout refactor Phase 1）
// ---------------------------------------------------------------------------

/**
 * A saved POI — 使用者跨 trip 的收藏清單，由 /explore 儲存池維護。
 *
 * DB table: saved_pois
 * Columns: id, email, poi_id, saved_at, note
 *
 * GET response 會 JOIN `pois` 補 POI 詳情（poiName / poiAddress / poiLat / poiLng / poiType）。
 *
 * mapRow renames (via json() deep camelCase):
 *   poi_id       -> poiId
 *   saved_at     -> savedAt
 *   poi_name     -> poiName
 *   poi_address  -> poiAddress
 *   poi_lat      -> poiLat
 *   poi_lng      -> poiLng
 *   poi_type     -> poiType
 */
export interface SavedPoi {
  id: number;
  /** owner email（V2 OAuth 之前暫用 email，不是 user_id FK） */
  email: string;
  /** DB column `poi_id` — FK to pois(id) */
  poiId: number;
  /** DB column `saved_at` — ISO datetime */
  savedAt: string;
  note?: string | null;
  // JOIN pois 欄位（GET endpoint 會回）
  poiName?: string;
  poiAddress?: string | null;
  poiLat?: number | null;
  poiLng?: number | null;
  poiType?: string;
}

// ---------------------------------------------------------------------------
// TripIdea — per-trip 的 maybe list（layout refactor Phase 1）
// ---------------------------------------------------------------------------

/**
 * A trip idea — per-trip 的 maybe list，與 trip_entries（排定時間軸）分離。
 *
 * DB table: trip_ideas
 * Columns: id, trip_id, poi_id, title, note, added_at, added_by,
 *          promoted_to_entry_id, archived_at
 *
 * GET response LEFT JOIN `pois` 補 POI 詳情（poiName / poiAddress / poiLat / poiLng / poiType）。
 *
 * mapRow renames (via json() deep camelCase):
 *   trip_id              -> tripId
 *   poi_id               -> poiId
 *   added_at             -> addedAt
 *   added_by             -> addedBy
 *   promoted_to_entry_id -> promotedToEntryId
 *   archived_at          -> archivedAt
 */
export interface TripIdea {
  id: number;
  /** DB column `trip_id` */
  tripId: string;
  /** DB column `poi_id` — nullable（自由文字 idea 無 POI 引用） */
  poiId?: number | null;
  title: string;
  note?: string | null;
  /** DB column `added_at` — ISO datetime */
  addedAt: string;
  /** DB column `added_by` — email of adder */
  addedBy?: string | null;
  /** DB column `promoted_to_entry_id` — 若 idea 被排入 itinerary，指向新 entry；null 表未 promote */
  promotedToEntryId?: number | null;
  /** DB column `archived_at` — soft archive marker；null 表 active */
  archivedAt?: string | null;
  // LEFT JOIN pois 欄位
  poiName?: string | null;
  poiAddress?: string | null;
  poiLat?: number | null;
  poiLng?: number | null;
  poiType?: string | null;
}

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

