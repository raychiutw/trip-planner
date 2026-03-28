import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { validateRestaurantBody } from '../../../../_validate';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

const ALLOWED_FIELDS = ['name', 'category', 'hours', 'price', 'reservation', 'reservation_url', 'description', 'note', 'google_rating', 'maps', 'mapcode', 'source'] as const;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, eid: eidStr } = context.params as { id: string; eid: string };
  const eid = parseIntParam(eidStr);
  if (!eid) return json({ error: 'Invalid id' }, 400);
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  if (!await verifyEntryBelongsToTrip(db, eid, id)) {
    return json({ error: 'Not found' }, 404);
  }

  type RestaurantBody = {
    name?: string;
    category?: string;
    hours?: string;
    price?: string;
    reservation?: string;
    reservation_url?: string;
    description?: string;
    note?: string;
    google_rating?: number;
    maps?: string;
    mapcode?: string;
    source?: string;
  };
  const bodyOrError = await parseJsonBody<RestaurantBody>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const validation = validateRestaurantBody(body);
  if (!validation.ok) return json({ error: validation.error }, validation.status);

  const maxResult = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM restaurants WHERE entry_id = ?")
    .bind(eid)
    .first() as { max_sort: number } | null;

  const sortOrder = (maxResult?.max_sort ?? -1) + 1;

  const row = await db
    .prepare(`INSERT INTO restaurants (entry_id, sort_order, name, category, hours, price, reservation, reservation_url, description, note, google_rating, maps, mapcode, source)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(
      eid, sortOrder,
      body.name ?? null, body.category ?? null, body.hours ?? null,
      body.price ?? null, body.reservation ?? null, body.reservation_url ?? null,
      body.description ?? null, body.note ?? null, body.google_rating ?? null,
      body.maps ?? null, body.mapcode ?? null, body.source ?? null,
    )
    .first();

  const changedBy = auth.email;
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
