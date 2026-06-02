/**
 * PATCH /api/trips/:id/entries/:eid/pois/:poiId — 編輯該 entry 下某個 POI 的 per-POI 備註。
 *
 * v2.x（migration 0078）：取代 entry-level trip_entries.note。一個停留點可有 1 正選
 * （master，sort_order=1）+ N 備選（alternate，sort_order>1），每個候選 POI 各自一條備註。
 * 此端點對「正選或備選任一」的 trip_entry_pois.note 做 UPDATE。
 *
 * Body: { note: string | null }
 *   - note trim 後為空字串 → 寫入 NULL（清除備註）。
 *   - 長度上限 1000（trim 後計）；超過 → 400 DATA_VALIDATION。
 *   - 亂碼（非 UTF-8）→ 400 DATA_ENCODING。
 *   - 缺 note 欄位 / note 非 string|null → 400 DATA_VALIDATION。
 *
 * 權限：requireAuth + hasWritePermission + verifyEntryBelongsToTrip
 *      + 驗證 (entry_id, poi_id) 確實是該 entry 的 trip_entry_pois row（正選或備選皆可），
 *        否則 404 DATA_NOT_FOUND。
 *
 * 並發：LWW（last-write-wins）。**刻意不** bump trip_entries.entry_pois_version —— 該 counter
 *      只屬結構操作（setMaster / addAlternate / removeAlternate / reorderAlternates）；note
 *      編輯 bump 它會誤殺尚未提交的 swap token（見 _entry_pois.ts OCC 註解 + entry-pois
 *      integration cross-mutation 回歸測試）。與既有 PATCH /entries note autosave 行為一致。
 *
 * 回傳：{ entryId, poiId, note }（更新後的值）。
 */
import { logAudit, computeDiff } from '../../../../../_audit';
import { hasWritePermission, verifyEntryBelongsToTrip, requireAuth } from '../../../../../_auth';
import { AppError } from '../../../../../_errors';
import { detectGarbledText } from '../../../../../_validate';
import { json, parseJsonBody, parseIntParam } from '../../../../../_utils';
import type { Env } from '../../../../../_types';

/** per-POI 備註長度上限（trim 後計），對齊既有文字欄位慣例。 */
const NOTE_MAX_LEN = 1000;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const { id, eid: eidStr, poiId: poiIdStr } = context.params as {
    id: string;
    eid: string;
    poiId: string;
  };
  const eid = parseIntParam(eidStr);
  const poiId = parseIntParam(poiIdStr);
  if (!eid) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  if (!poiId) throw new AppError('DATA_VALIDATION', 'poi ID 格式錯誤');
  const db = context.env.DB;

  const [canWrite, belongsToTrip] = await Promise.all([
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id),
  ]);
  if (!canWrite) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('DATA_NOT_FOUND');

  const body = await parseJsonBody<{ note?: unknown }>(context.request);
  if (!('note' in body)) throw new AppError('DATA_VALIDATION', '缺少 note 欄位');
  if (body.note !== null && typeof body.note !== 'string') {
    throw new AppError('DATA_VALIDATION', 'note 必須是字串或 null');
  }

  // trim → 空字串視為清除（寫 null）
  let note: string | null = body.note === null ? null : (body.note as string).trim();
  if (note === '') note = null;
  if (note !== null) {
    if (note.length > NOTE_MAX_LEN) {
      throw new AppError('DATA_VALIDATION', `note 不得超過 ${NOTE_MAX_LEN} 字`);
    }
    if (detectGarbledText(note)) {
      throw new AppError('DATA_ENCODING', 'note 包含疑似亂碼，請確認 encoding 為 UTF-8');
    }
  }

  // 驗證 (entry_id, poi_id) 確實是該 entry 的 trip_entry_pois row（正選或備選皆可）。
  const existing = await db
    .prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
    .bind(eid, poiId)
    .first<{ note: string | null }>();
  if (!existing) throw new AppError('DATA_NOT_FOUND', `POI ${poiId} 不在 entry ${eid}`);

  // LWW UPDATE — 明確不 bump trip_entries.entry_pois_version（結構操作專用 OCC counter）。
  // updated_at 用 application-layer ISO ms（對齊 _entry_pois.ts nowMs() 慣例，避免 SQLite
  // datetime('now') 只有秒解析度）。
  await db
    .prepare('UPDATE trip_entry_pois SET note = ?, updated_at = ? WHERE entry_id = ? AND poi_id = ?')
    .bind(note, new Date().toISOString(), eid, poiId)
    .run();

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_entry_pois',
    recordId: eid,
    action: 'update',
    changedBy: auth.email,
    diffJson: computeDiff({ note: existing.note }, { note }),
  });

  return json({ entryId: eid, poiId, note });
};
