import { logAudit, computeDiff } from '../_audit';
import { hasPermission } from '../_auth';
import { AppError } from '../_errors';
import { json, getAuth, parseJsonBody, buildUpdateClause } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_FIELDS = ['name', 'owner', 'title', 'description', 'og_description', 'self_drive', 'countries', 'published', 'food_prefs', 'auto_scroll', 'footer'] as const;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };

  const row = await context.env.DB.prepare('SELECT *, id AS tripId FROM trips WHERE id = ?').bind(id).first();
  if (!row) throw new AppError('DATA_NOT_FOUND');

  if (row.footer && typeof row.footer === 'string') {
    try {
      (row as any).footer = JSON.parse(row.footer as string);
    } catch {
      // leave as-is if parse fails
    }
  }

  return json(row);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id } = context.params as { id: string };

  if (!await hasPermission(context.env.DB, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const existing = await context.env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first() as Record<string, unknown> | null;
  if (!existing) throw new AppError('DATA_NOT_FOUND');

  const bodyOrError = await parseJsonBody<Record<string, unknown>>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) throw new AppError('DATA_VALIDATION', 'No valid fields to update');

  const changedBy = auth.email;
  const newFields = Object.fromEntries(update.fields.map(f => [f, body[f]]));

  await context.env.DB.prepare(`UPDATE trips SET ${update.setClauses} WHERE id = ?`).bind(...update.values, id).run();

  await logAudit(context.env.DB, {
    tripId: id,
    tableName: 'trips',
    recordId: null,
    action: 'update',
    changedBy,
    diffJson: computeDiff(existing, newFields),
  });

  return json({ ok: true });
};
