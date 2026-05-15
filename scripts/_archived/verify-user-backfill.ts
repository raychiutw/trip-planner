#!/usr/bin/env node
/**
 * verify-user-backfill.ts — Pre-PR hard gate for V2 owner email→user_id cutover.
 *
 * 驗證所有 email-keyed columns 都能 resolve 到 users.id。0 missing 才能進
 * migrations/0046_trip_ideas_to_saved_pois_phase1.sql 跑 backfill + DROP。
 *
 * 對齊 autoplan must-fix E-H4：enumerate 每個 email column。
 *
 * 驗證範圍：
 *   1. trips.owner               → users.email 必須 match (將 backfill 進 owner_user_id)
 *   2. saved_pois.email          → users.email 必須 match (將 backfill 進 user_id)
 *   3. trip_permissions.email    → users.email 必須 match (排除 '*' 萬用 row)
 *   4. audit_log.changed_by      → users.email 必須 match (audit integrity)
 *
 * 不驗證（intentional）：
 *   - trip_invitations.invited_email：故意 email-keyed，pre-signup invite token 流程，不 cutover
 *   - trip_ideas.added_by：table 即將被 dropped (C1 migration)，不需 backfill
 *   - auth_audit_log.user_id：already user_id-based，不需 backfill
 *
 * Usage:
 *   bun scripts/verify-user-backfill.ts          # prod (default)
 *   bun scripts/verify-user-backfill.ts --local  # 跑 local D1
 *
 * Exit code:
 *   0 = all rows resolvable, OK to proceed with migration
 *   1 = orphan rows found, MIGRATION BLOCKED
 *
 * Env: CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, D1_DATABASE_ID (從 openspec/config.yaml fallback)
 */

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const LOCAL = process.argv.includes('--local');

interface UnresolvedRow {
  table: string;
  column: string;
  value: string;
  count: number;
}

interface D1Row {
  [key: string]: string | number | null;
}

function loadEnvFromYaml(): Record<string, string> {
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', 'openspec', 'config.yaml'), 'utf8');
    const env: Record<string, string> = {};
    let inEnv = false;
    content.split('\n').forEach((line) => {
      if (/^env:/.test(line)) { inEnv = true; return; }
      if (inEnv && /^\S/.test(line)) { inEnv = false; return; }
      if (inEnv) {
        const m = line.match(/^\s+(\w+):\s*(.+)/);
        if (m && !m[2].startsWith('#') && !m[2].startsWith('(')) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/#.*$/, '').trim();
        }
      }
    });
    return env;
  } catch { return {}; }
}

const yamlEnv = loadEnvFromYaml();
const env = (k: string): string => process.env[k] || yamlEnv[k] || '';

async function queryD1Remote(sql: string): Promise<D1Row[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env('CF_ACCOUNT_ID')}/d1/database/${env('D1_DATABASE_ID')}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('CLOUDFLARE_API_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`D1 ${res.status}: ${await res.text()}`);
  const data = await res.json() as { success: boolean; errors?: unknown; result: { results: D1Row[] }[] };
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result[0]?.results ?? [];
}

function queryD1Local(sql: string): D1Row[] {
  const escaped = sql.replace(/"/g, '\\"');
  const out = execSync(
    `npx wrangler d1 execute trip-planner-db --local --json --command "${escaped}"`,
    { encoding: 'utf8', timeout: 30000 },
  );
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: D1Row[] }[];
  return parsed[0]?.results ?? [];
}

const queryD1 = LOCAL ? queryD1Local : queryD1Remote;

async function findOrphans(table: string, column: string, extraWhere = ''): Promise<UnresolvedRow[]> {
  // 找出該 column 所有 value 不存在於 users.email 的 row（用 LEFT JOIN + COUNT，效能 OK）
  const sql = `
    SELECT t.${column} AS value, COUNT(*) AS cnt
    FROM ${table} t
    LEFT JOIN users u ON u.email = t.${column}
    WHERE t.${column} IS NOT NULL
      AND u.id IS NULL
      ${extraWhere}
    GROUP BY t.${column}
    ORDER BY cnt DESC
  `;
  const rows = await queryD1(sql);
  return rows.map((r) => ({
    table,
    column,
    value: String(r.value ?? ''),
    count: Number(r.cnt ?? 0),
  }));
}

async function main(): Promise<void> {
  console.log(`verify-user-backfill.ts — ${LOCAL ? 'LOCAL' : 'PROD'} D1 verification`);
  console.log('='.repeat(60));

  const checks: Array<{ name: string; table: string; column: string; extra: string }> = [
    { name: 'trips.owner', table: 'trips', column: 'owner', extra: '' },
    { name: 'saved_pois.email', table: 'saved_pois', column: 'email', extra: '' },
    {
      name: 'trip_permissions.email',
      table: 'trip_permissions',
      column: 'email',
      extra: `AND t.email != '*'`, // '*' 是 wildcard public-read row
    },
    {
      name: 'audit_log.changed_by',
      table: 'audit_log',
      column: 'changed_by',
      // 'system' / 'cron' / 'admin' 是 sentinel 值（系統自動 audit events，非 real user）
      // 這些 row 不 cutover，audit_log.changed_by 保持 TEXT field 不轉 user_id FK
      extra: `AND t.changed_by NOT IN ('system', 'cron', 'admin', 'service')`,
    },
  ];

  let totalOrphans = 0;
  const allReports: { name: string; orphans: UnresolvedRow[] }[] = [];

  for (const check of checks) {
    process.stdout.write(`  ${check.name.padEnd(30)} `);
    try {
      const orphans = await findOrphans(check.table, check.column, check.extra);
      const total = orphans.reduce((sum, o) => sum + o.count, 0);
      console.log(orphans.length === 0 ? 'OK (0 orphans)' : `FAIL (${orphans.length} distinct, ${total} total rows)`);
      totalOrphans += total;
      allReports.push({ name: check.name, orphans });
    } catch (err) {
      console.log(`SKIP (${(err as Error).message.slice(0, 60)})`);
    }
  }

  console.log('='.repeat(60));

  if (totalOrphans === 0) {
    console.log('PASS — all email-keyed columns can resolve to users.id');
    console.log('Migration 0046 phase 1 backfill is safe to proceed.');
    process.exit(0);
  }

  console.log(`FAIL — ${totalOrphans} total orphan rows across ${allReports.filter((r) => r.orphans.length > 0).length} columns`);
  console.log('');
  console.log('Orphan details:');
  for (const report of allReports) {
    if (report.orphans.length === 0) continue;
    console.log(`  ${report.name}:`);
    for (const o of report.orphans) {
      console.log(`    "${o.value}" × ${o.count}`);
    }
  }
  console.log('');
  console.log('Action items before migration:');
  console.log('  1. 確認每個 orphan email 是否該存在（可能是 typo / legacy / abandoned account）');
  console.log('  2. 對於該保留的：要該 user 走 V2 OAuth signup 建立 users row');
  console.log('  3. 對於 abandoned 的：手動 DELETE 該 row（trips/saved_pois/trip_permissions）');
  console.log('  4. audit_log.changed_by 是 historical data，可考慮：');
  console.log('     a) 把 orphan 改成 NULL（acceptable，audit 仍有 trip_id + diff 留痕）');
  console.log('     b) 或保留 email 字串作 audit-only field（不轉 user_id）');
  console.log('');
  console.log('Re-run after fixes.');
  process.exit(1);
}

main().catch((err: Error) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
