/**
 * GET /api/health endpoint — v2.33.126 PR3
 *
 * 給外部 uptime monitor pin。Public，無 auth，回 healthy/degraded/unhealthy。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../functions/api/health.ts'), 'utf8');

describe('GET /api/health', () => {
  it('export onRequestGet (CF Pages function shape)', () => {
    expect(SRC).toMatch(/export const onRequestGet: PagesFunction<Env>/);
  });

  it('public — 不 import requireAuth / hasPermission', () => {
    expect(SRC).not.toMatch(/requireAuth|hasPermission/);
  });

  it('checkD1 跑 SELECT 1 + try/catch fail-safe', () => {
    expect(SRC).toMatch(/SELECT 1 AS ok/);
    expect(SRC).toMatch(/} catch \{\s+return 'fail';/);
  });

  it('checkGoogleMapsKey 驗 key 長度 > 10', () => {
    expect(SRC).toMatch(/key\.length > 10/);
  });

  it('D1 fail → status=unhealthy + HTTP 503', () => {
    expect(SRC).toMatch(/status = 'unhealthy';\s*httpStatus = 503;/);
  });

  it('Google Maps key missing → status=degraded + HTTP 200', () => {
    expect(SRC).toMatch(/status = 'degraded';\s*httpStatus = 200;/);
  });

  it('全 ok → status=healthy + HTTP 200', () => {
    expect(SRC).toMatch(/status = 'healthy';\s*httpStatus = 200;/);
  });

  it('response 含 checks + ts ISO timestamp', () => {
    expect(SRC).toMatch(/checks,/);
    expect(SRC).toMatch(/ts: new Date\(\)\.toISOString\(\)/);
  });

  it('不檢查 mac mini api-server / funnel（職責分離 — 那些走 funnel-guard）', () => {
    expect(SRC).toMatch(/不\*\*檢查的：mac mini api-server \/ funnel/);
  });
});

describe('docs/monitoring/uptime-monitor.md', () => {
  const DOC = readFileSync(
    join(__dirname, '../../docs/monitoring/uptime-monitor.md'),
    'utf8',
  );

  it('文件 endpoint URL + response shape', () => {
    expect(DOC).toMatch(/GET https:\/\/trip-planner-dby\.pages\.dev\/api\/health/);
    expect(DOC).toMatch(/"d1": "ok" \| "fail"/);
    expect(DOC).toMatch(/"googleMapsKey": "ok" \| "missing"/);
  });

  it('文件給 UptimeRobot + Pingdom + curl cron 三選一', () => {
    expect(DOC).toMatch(/UptimeRobot/);
    expect(DOC).toMatch(/Pingdom/);
    expect(DOC).toMatch(/curl cron/);
  });

  it('文件交代「為何不檢 mac mini」職責分離', () => {
    expect(DOC).toMatch(/為什麼不檢查 mac mini/);
  });
});
