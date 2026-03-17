
interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };

  const { results } = await context.env.DB
    .prepare('SELECT id, day_num, date, dayOfWeek, label FROM days WHERE trip_id = ? ORDER BY day_num ASC')
    .bind(id)
    .all();

  return json(results);
};
