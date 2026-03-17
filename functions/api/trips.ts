interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const showAll = url.searchParams.get('all') === '1';
  const auth = (context.data as any)?.auth;

  let sql: string;
  if (showAll && auth?.isAdmin) {
    sql = 'SELECT id, name, owner, title, self_drive, countries, published, auto_scroll, footer_json FROM trips ORDER BY name ASC';
  } else {
    sql = 'SELECT id, name, owner, title, self_drive, countries, published, auto_scroll, footer_json FROM trips WHERE published = 1 ORDER BY name ASC';
  }

  const { results } = await context.env.DB.prepare(sql).all();
  return json(results);
};
