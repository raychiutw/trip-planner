import type { PagesFunction } from '@cloudflare/workers-types';

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

  let query: string;
  let params: unknown[];

  if (showAll && auth?.isAdmin) {
    query = 'SELECT id, name, owner, title, selfDrive, countries, published FROM trips ORDER BY name ASC';
    params = [];
  } else {
    query = 'SELECT id, name, owner, title, selfDrive, countries, published FROM trips WHERE published = 1 ORDER BY name ASC';
    params = [];
  }

  const { results } = await context.env.DB.prepare(query).bind(...params).all();
  return json(results);
};
