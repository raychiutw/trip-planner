/**
 * API-related TypeScript interfaces.
 *
 * Covers: requests, permissions, audit_log tables and the AuthData shape
 * used by the middleware. Field names follow the frontend camelCase convention
 * produced by mapRow() (js/map-row.js) where applicable.
 */

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
  /** 'trip-edit' | 'trip-plan' */
  mode: string;
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
  /** 'admin' | 'member' */
  role: string;
}

// ---------------------------------------------------------------------------
// AuditLog
// ---------------------------------------------------------------------------

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
  /** 'insert' | 'update' | 'delete' */
  action: string;
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

