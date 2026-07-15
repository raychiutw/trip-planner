/**
 * GET /api/health — server-level health check endpoint (v2.33.126)
 *
 * 給外部 uptime monitor（UptimeRobot / Pingdom / curl cron）pin 用。
 * Public endpoint，無 auth，回 200 healthy 或 503 unhealthy + JSON 細節。
 *
 * 檢查項：
 *   1. D1 binding 可 SELECT 1（catch DB outage / migration broken state）
 *   2. GOOGLE_MAPS_API_KEY env 有設（catch deploy env 遺漏）
 *   3. Worker 自身執行 OK（reach this line = true）
 *
 * Response shape：
 *   { status: 'healthy' | 'degraded' | 'unhealthy',
 *     checks: { d1: 'ok'|'fail', googleMapsKey: 'ok'|'missing' },
 *     ts: ISO timestamp }
 *
 * Status code：healthy=200, degraded=200 (non-critical fail), unhealthy=503
 *
 * **不**檢查的：mac mini api-server / funnel — 那些走 funnel-guard launchd
 * + scripts/daily-check.js ping。/api/health 只代表 CF Pages 邊緣健康。
 */

import { json } from './_utils';
import type { Env } from './_types';

interface HealthChecks {
  d1: 'ok' | 'fail';
  googleMapsKey: 'ok' | 'missing';
}

async function checkD1(env: Env): Promise<'ok' | 'fail'> {
  try {
    const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return row?.ok === 1 ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

function checkGoogleMapsKey(env: Env): 'ok' | 'missing' {
  const key = env.GOOGLE_MAPS_API_KEY ?? '';
  return key.length > 10 ? 'ok' : 'missing';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const checks: HealthChecks = {
    d1: await checkD1(context.env),
    googleMapsKey: checkGoogleMapsKey(context.env),
  };

  // critical fail = D1 down → 503；missing key = degraded（API 仍可 serve 非 Maps 流量）
  let status: 'healthy' | 'degraded' | 'unhealthy';
  let httpStatus: number;
  if (checks.d1 === 'fail') {
    status = 'unhealthy';
    httpStatus = 503;
  } else if (checks.googleMapsKey === 'missing') {
    status = 'degraded';
    httpStatus = 200;
  } else {
    status = 'healthy';
    httpStatus = 200;
  }

  return json(
    {
      status,
      checks,
      ts: new Date().toISOString(),
    },
    httpStatus,
  );
};
