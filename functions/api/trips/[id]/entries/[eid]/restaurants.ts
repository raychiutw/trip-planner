import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { validateRestaurantBody } from '../../../../_validate';
import { json } from '../../../../_utils';
import type { Env } from '../../../../_types';

const ALLOWED_FIELDS = ['name', 'category', 'hours', 'price', 'reservation', 'reservation_url', 'description', 'note', 'rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid } = context.params as { id: string; eid: string };
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, Number(eid), id)) {
    return json({ error: 'Not found' }, 404);
  }

  let body: {
    name?: string;
    category?: string;
    hours?: string;
    price?: string;
    reservation?: string;
    reservation_url?: string;
    description?: string;
    note?: string;
    rating?: number;
    maps?: string;
    mapcode?: string;
    source?: string;
  };
  try {
    body = await context.request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const validation = validateRestaurantBody(body);
  if (!validation.ok) return json({ error: validation.error }, validation.status);

  const maxResult = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM restaurants WHERE entry_id = ?")
    .bind(Number(eid))
    .first() as { max_sort: number } | null;

  const sortOrder = (maxResult?.max_sort ?? -1) + 1;

  const row = await db
    .prepare(`INSERT INTO restaurants (entry_id, sort_order, name, category, hours, price, reservation, reservation_url, description, note, rating, maps, mapcode, source)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(
      Number(eid), sortOrder,
      body.name ?? null, body.category ?? null, body.hours ?? null,
      body.price ?? null, body.reservation ?? null, body.reservation_url ?? null,
      body.description ?? null, body.note ?? null, body.rating ?? null,
      body.maps ?? null, body.mapcode ?? null, body.source ?? null,
    )
    .first();

  const changedBy = auth?.email || 'anonymous';
  const newRow = row as Record<string, unknown>;
  await logAudit(db, {
    tripId: id,
    tableName: 'restaurants',
    recordId: newRow ? (newRow.id as number) : null,
    action: 'insert',
    changedBy,
    diffJson: JSON.stringify(body),
  });

  return json(row, 201);
};
