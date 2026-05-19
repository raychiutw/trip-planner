/**
 * build-daily-check-msg.js — Google Maps section render (v2.31.96)
 *
 * 既有 Telegram message 缺 Google Maps MTD 花費。新 section render：
 *   - status === 'critical' → 🔴 + lock 提示
 *   - status === 'warning' (≥50% / <lock) → 🟡 + remaining
 *   - status === 'ok' (<50%) → 不放 issue，但仍在 metrics 區塊顯花費 (transparent)
 *   - error/skip (env missing) → 不阻斷其他 section
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BUILD_MSG = path.resolve(__dirname, '../../scripts/lib/build-daily-check-msg.js');

function runWithReport(report: Record<string, unknown>): string {
  const tmp = path.join(os.tmpdir(), `daily-check-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(report), 'utf8');
  try {
    const result = spawnSync('node', [BUILD_MSG, tmp], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`build-daily-check-msg failed: ${result.stderr}`);
    }
    return result.stdout;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

const BASE: Record<string, unknown> = {
  date: '2026-05-19',
  generatedAt: '2026-05-19T00:00:00Z',
  summary: { totalIssues: 0, critical: 0, warning: 0, ok: 7 },
  sentry: { status: 'ok', total: 0, issues: [] },
  apiErrors: { status: 'ok', total: 0, errors: [] },
  requestErrors: { status: 'ok', total: 0, statusCounts: { open: 0, processing: 0, failed: 0 }, stuckProcessing: 0, pending: [] },
  workers: { requests: 1000, errors: 0, p50: 12, p99: 80 },
  web: { visits: 50, pageViews: 200 },
  npmAudit: { status: 'ok', total: 0, error: null },
  schedulerErrors: { status: 'ok', total: 0, details: { 'api-server': { count: 0 } } },
  routeHealth: { status: 'ok', total: 0, checked: 8, routes: [] },
  dataHygiene: { status: 'ok', total: 0, leaks: [] },
};

describe('build-daily-check-msg.js — Google Maps section', () => {
  it('renders 🔴 critical issue when MTD ≥ lock threshold', () => {
    const report = {
      ...BASE,
      googleMapsQuota: {
        status: 'critical',
        dailyCost: 8,
        mtdCost: 184,
        budget: 200,
        mtdPct: 92,
        remainingUsd: 16,
        isLocked: true,
      },
    };
    const out = runWithReport(report);
    expect(out).toContain('🔴');
    expect(out).toContain('Google Maps');
    expect(out).toContain('184');
    expect(out).toContain('92'); // mtdPct (rounded)
  });

  it('renders 🟡 warning when 50% ≤ MTD < lock', () => {
    const report = {
      ...BASE,
      googleMapsQuota: {
        status: 'warning',
        dailyCost: 4,
        mtdCost: 120,
        budget: 200,
        mtdPct: 60,
        remainingUsd: 80,
        isLocked: false,
      },
    };
    const out = runWithReport(report);
    expect(out).toContain('🟡');
    expect(out).toContain('Google Maps');
    expect(out).toContain('120');
  });

  it('still shows ok-state cost line in metrics block (transparency)', () => {
    const report = {
      ...BASE,
      googleMapsQuota: {
        status: 'ok',
        dailyCost: 1,
        mtdCost: 19,
        budget: 200,
        mtdPct: 9.5,
        remainingUsd: 181,
        isLocked: false,
      },
    };
    const out = runWithReport(report);
    // ok status: no 🔴 / 🟡 issue line, but metric block still surfaces 花費
    expect(out).toMatch(/💰|Google Maps/);
    expect(out).toContain('19');
  });

  it('does not throw when googleMapsQuota error/skip (graceful)', () => {
    const report = {
      ...BASE,
      googleMapsQuota: {
        status: 'ok',
        error: 'TRIPLINE_API_URL/TOKEN missing (skip)',
      },
    };
    expect(() => runWithReport(report)).not.toThrow();
  });

  it('still renders fully green when googleMapsQuota absent (back-compat)', () => {
    const out = runWithReport(BASE);
    expect(out).toContain('全綠');
  });
});
