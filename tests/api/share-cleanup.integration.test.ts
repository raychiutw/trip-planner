/**
 * Integration — share cleanup SQL (v2.42.0 C1 + C3).
 * Runs the actual scripts/cleanup-*.sql against Miniflare D1 to prove they delete the
 * right rows and ONLY those (expired-past-grace shares; orphaned cloned trips), keeping
 * active / within-grace / owned rows.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDb } from './setup';
import { seedTrip } from './helpers';

let db: D1Database;
const ROOT = join(__dirname, '..', '..');

// Strip `--` comment lines, run the remaining single DELETE statement.
async function runSqlFile(rel: string) {
  const sql = readFileSync(join(ROOT, rel), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .trim();
  await db.prepare(sql).run();
}

beforeAll(async () => {
  db = await createTestDb();
});

describe('cleanup-expired-shares.sql (C1)', () => {
  it('deletes shares past expiry + 30-day grace; keeps active + within-grace', async () => {
    const { id } = await seedTrip(db, { id: 'cleanup-c1', days: 1 });
    const now = Date.now();
    const ins = (label: string, expiresAt: number | null) =>
      db.prepare("INSERT INTO trip_shares (trip_id, token_hash, label, visible_sections, expires_at) VALUES (?,?,?,'[]',?)").bind(id, `h-${label}`, label, expiresAt).run();
    await ins('never', null); // permanent → keep
    await ins('within-grace', now - 5 * 86400_000); // expired 5d ago (<30d grace) → keep
    await ins('past-grace', now - 40 * 86400_000); // expired 40d ago (>30d) → DELETE

    await runSqlFile('scripts/cleanup-expired-shares.sql');

    const rows = (await db.prepare('SELECT label FROM trip_shares WHERE trip_id = ?').bind(id).all()).results as { label: string }[];
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(['never', 'within-grace']); // past-grace gone
  });
});

describe('cleanup-orphan-cloned-trips.sql (C3)', () => {
  it('deletes only old cloned trips with NO permission; keeps owned + recent + non-cloned', async () => {
    // users FK: the manual orphan inserts need a real owner_user_id row.
    await db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES ('u','u@test.com','u')").run();
    // owned cloned trip (has permission) → keep
    await seedTrip(db, { id: 'cln-owned', days: 1 }); // seedTrip writes data_source default 'manual'
    await db.prepare("UPDATE trips SET data_source='cloned', created_at='2020-01-01 00:00:00' WHERE id='cln-owned'").run();

    // orphan: cloned, old, NO permission row → DELETE
    await db.prepare("INSERT INTO trips (id, name, owner_user_id, title, countries, published, data_source, created_at) VALUES ('cln-orphan','x','u','x','JP',0,'cloned','2020-01-01 00:00:00')").run();

    // recent orphan (cloned, no permission, but created today) → keep (grace)
    await db.prepare("INSERT INTO trips (id, name, owner_user_id, title, countries, published, data_source, created_at) VALUES ('cln-recent','x','u','x','JP',0,'cloned', datetime('now'))").run();

    // non-cloned orphan-looking trip → keep (only cloned are swept)
    await db.prepare("INSERT INTO trips (id, name, owner_user_id, title, countries, published, data_source, created_at) VALUES ('manual-noperm','x','u','x','JP',0,'manual','2020-01-01 00:00:00')").run();

    await runSqlFile('scripts/cleanup-orphan-cloned-trips.sql');

    const exists = async (id: string) => !!(await db.prepare('SELECT 1 FROM trips WHERE id = ?').bind(id).first());
    expect(await exists('cln-orphan')).toBe(false); // swept
    expect(await exists('cln-owned')).toBe(true); // has permission
    expect(await exists('cln-recent')).toBe(true); // within 1-day grace
    expect(await exists('manual-noperm')).toBe(true); // not cloned
  });
});
