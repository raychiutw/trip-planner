/**
 * Pages Function: /trip/* — 動態 meta 注入
 *
 * 從 URL 路徑取得 tripId，查 D1 取得行程 meta，
 * 用 HTMLRewriter 注入 og meta，回傳修改後的 index.html。
 */

import type { Env } from '../api/_types';

interface TripMeta {
  id: string;
  name: string;
  title: string;
  countries: string | null;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>找不到行程 — Tripline</title></head>
<body><h1>404 找不到行程</h1><p>請確認行程網址是否正確。</p></body>
</html>`;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // pathname: /trip/okinawa-trip-2026-Ray or /trip/okinawa-trip-2026-Ray/...
  const pathParts = url.pathname.replace(/^\/trip\//, '').split('/');
  const tripId = pathParts[0];

  if (!tripId) {
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
  }

  const trip = await context.env.DB
    .prepare('SELECT id, name, title, countries FROM trips WHERE id = ?')
    .bind(tripId)
    .first<TripMeta>();

  if (!trip) {
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
  }

  const ogTitle = `${trip.title} — Tripline`;
  const ogDescription = trip.countries ? `${trip.countries} 行程` : '行程規劃';

  const assetResponse = await context.env.ASSETS.fetch(
    new Request('https://placeholder/index.html'),
  );

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(ogTitle);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', ogDescription);
      },
    })
    .on('meta[property="og:site_name"]', {
      element(el) {
        el.setAttribute('content', 'Tripline');
      },
    })
    .transform(assetResponse);
};
