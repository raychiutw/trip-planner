/**
 * Shared helpers for per-section trip notes endpoints.
 *
 * v2.34.x 行程筆記 PR2：5 個 section 都共用「auth check + SELECT * + ORDER BY」
 * pattern，抽出來避免 5 個 file 各寫一次。
 */
import { hasPermission, requireAuth } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json } from '../../../_utils';
import type { Env } from '../../../_types';

export type NotesTable =
  | 'trip_flights'
  | 'trip_lodgings'
  | 'trip_reservations'
  | 'trip_pretrip_notes'
  | 'trip_emergency_contacts';

export async function listNotesSection(
  context: EventContext<Env, string, Record<string, unknown>>,
  table: NotesTable,
): Promise<Response> {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasPermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // table 名是 hardcoded enum union 不是 user input，SQL injection safe
  const { results } = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE trip_id = ? ORDER BY sort_order ASC, id ASC`)
    .bind(tripId)
    .all();

  return json({ items: results ?? [] });
}
