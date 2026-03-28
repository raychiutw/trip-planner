
import { json } from '../../_utils';
import type { Env } from '../../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };

  const { results } = await context.env.DB
    .prepare('SELECT id, day_num, date, day_of_week, label FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
    .bind(id)
    .all();

  return json(results);
};
