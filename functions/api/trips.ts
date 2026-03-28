import { json, getAuth } from './_utils';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const showAll = url.searchParams.get('all') === '1';
  const auth = getAuth(context);

  let sql: string;
  if (showAll && auth?.isAdmin) {
    sql = 'SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips ORDER BY name ASC';
  } else {
    sql = 'SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips WHERE published = 1 ORDER BY name ASC';
  }

  const { results } = await context.env.DB.prepare(sql).all();
  return json(results);
};
