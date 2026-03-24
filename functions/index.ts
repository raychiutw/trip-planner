/**
 * Pages Function: / — Root redirect handler
 *
 * 兩種情況：
 * 1. /?trip=xxx (舊格式) → 301 redirect to /trip/xxx (保留其他 query params)
 * 2. / (無 trip param) → 查 D1 取得 is_default=1 的行程，302 redirect to /trip/{defaultId}
 *    若無預設行程，fallback 到 /trip/okinawa-trip-2026-Ray
 */

import type { Env } from './api/_types';

const FALLBACK_TRIP_ID = 'okinawa-trip-2026-Ray';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const tripParam = url.searchParams.get('trip');

  // Case 1: /?trip=xxx → 301 redirect to /trip/xxx (preserve other params)
  if (tripParam) {
    const remaining = new URLSearchParams(url.searchParams);
    remaining.delete('trip');
    const qs = remaining.toString();
    const destination = `/trip/${tripParam}${qs ? `?${qs}` : ''}`;
    return Response.redirect(new URL(destination, url).toString(), 301);
  }

  // Case 2: / → query D1 for default trip
  let defaultId = FALLBACK_TRIP_ID;
  try {
    const row = await context.env.DB
      .prepare('SELECT id FROM trips WHERE is_default = 1 LIMIT 1')
      .first<{ id: string }>();
    if (row?.id) defaultId = row.id;
  } catch {
    // DB error → use fallback
  }

  return Response.redirect(new URL(`/trip/${defaultId}`, url).toString(), 302);
};
