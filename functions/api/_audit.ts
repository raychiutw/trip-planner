import { detectGarbledText } from './_validate';

export async function logAudit(db: D1Database, opts: {
  tripId: string;
  tableName: string;
  recordId: number | null;
  action: 'insert' | 'update' | 'delete';
  changedBy: string;
  requestId?: number | null;
  diffJson?: string;
  snapshot?: string;
}) {
  let finalDiffJson = opts.diffJson ?? null;
  if (finalDiffJson && detectGarbledText(finalDiffJson)) {
    try {
      const parsed = JSON.parse(finalDiffJson);
      parsed._encoding_warning = true;
      finalDiffJson = JSON.stringify(parsed);
    } catch { /* keep original */ }
  }

  await db.prepare(
    'INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, request_id, diff_json, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    opts.tripId,
    opts.tableName,
    opts.recordId,
    opts.action,
    opts.changedBy,
    opts.requestId ?? null,
    finalDiffJson,
    opts.snapshot ?? null,
  ).run();
}

export function computeDiff(oldRow: Record<string, any>, newFields: Record<string, any>): string {
  const diff: Record<string, { old: any; new: any }> = {};
  for (const key of Object.keys(newFields)) {
    if (oldRow[key] !== newFields[key]) {
      diff[key] = { old: oldRow[key], new: newFields[key] };
    }
  }
  return JSON.stringify(diff);
}
