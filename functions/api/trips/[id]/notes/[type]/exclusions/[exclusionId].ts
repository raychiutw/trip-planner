import { hasWritePermission, requireAuth } from '../../../../../_auth';
import { logAudit } from '../../../../../_audit';
import { AppError } from '../../../../../_errors';
import { isNoteAiDocType } from '../../../../../_noteAi';
import { json, parseIntParam } from '../../../../../_utils';
import type { Env } from '../../../../../_types';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const tripId = context.params.id as string;
  const docType = context.params.type as string;
  const exclusionId = parseIntParam(context.params.exclusionId as string);
  if (!isNoteAiDocType(docType) || !exclusionId) throw new AppError('DATA_VALIDATION');
  if (!(await hasWritePermission(context.env.DB, auth, tripId))) {
    throw new AppError('PERM_DENIED');
  }

  const exclusion = await context.env.DB.prepare(
    `DELETE FROM trip_note_ai_exclusions
     WHERE id = ? AND trip_id = ? AND doc_type = ?
     RETURNING *`,
  ).bind(exclusionId, tripId, docType).first<Record<string, unknown>>();
  if (!exclusion) throw new AppError('DATA_NOT_FOUND');

  await logAudit(context.env.DB, {
    tripId,
    tableName: 'trip_note_ai_exclusions',
    recordId: exclusionId,
    action: 'delete',
    changedBy: auth.email,
    diffJson: JSON.stringify(exclusion),
  });
  return json({ ok: true });
};
