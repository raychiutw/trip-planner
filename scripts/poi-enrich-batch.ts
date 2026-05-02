#!/usr/bin/env bun
/**
 * poi-enrich-batch.ts — one-off batch enrich script.
 *
 * Run AFTER migration 0045 (which cleared pois.rating to NULL) to backfill
 * rating + OSM cols (osm_id, wikidata_id, cuisine, etc.) from OpenTripMap +
 * Overpass + Nominatim.
 *
 * Reuses src/server/poi/enrich.ts via a CF REST → D1 shim (mac mini Bun
 * has no workerd D1 binding; the shim exposes .prepare().bind().first()/
 * .run()/.all() that matches the workerd interface so enrichPoi works
 * unchanged).
 *
 * Usage:
 *   bun run scripts/poi-enrich-batch.ts                 # all pois
 *   bun run scripts/poi-enrich-batch.ts --force         # ignore 90d cache
 *   bun run scripts/poi-enrich-batch.ts --limit=20      # smoke test
 *
 * Throttles to 1100ms between POIs (Nominatim 1 req/sec hard policy).
 * For ~500 POIs: estimated ~10 minutes total.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichPoi } from '../src/server/poi/enrich';

interface Env {
  CF_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  OPENTRIPMAP_API_KEY: string;
  D1_DATABASE_ID: string;
}

const PROD_DB_ID = 'd61c42d5-8083-4e18-9b6c-70e133e37322'; // trip-planner-db (prod)

function loadEnv(): Env {
  const envPath = join(import.meta.dir, '..', '.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  const map: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const required = ['CF_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'OPENTRIPMAP_API_KEY'];
  for (const k of required) {
    if (!map[k]) throw new Error(`${k} not found in .env.local`);
  }
  return {
    CF_ACCOUNT_ID: map.CF_ACCOUNT_ID!,
    CLOUDFLARE_API_TOKEN: map.CLOUDFLARE_API_TOKEN!,
    OPENTRIPMAP_API_KEY: map.OPENTRIPMAP_API_KEY!,
    D1_DATABASE_ID: map.D1_DATABASE_ID || PROD_DB_ID,
  };
}

/**
 * D1 HTTP shim — mimics workerd D1Database surface so enrichPoi (which
 * expects D1Database) works from a Bun script via CF REST API.
 */
function makeD1Shim(env: Env) {
  async function exec(sql: string, params: unknown[]): Promise<{ results: unknown[] }> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) {
      throw new Error(`D1 REST ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = (await res.json()) as {
      success: boolean;
      errors?: unknown;
      result?: Array<{ results?: unknown[] }>;
    };
    if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
    return { results: data.result?.[0]?.results ?? [] };
  }
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => (await exec(sql, args)).results[0] ?? null,
            run: async () => exec(sql, args),
            all: async () => exec(sql, args),
          };
        },
      };
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

  const env = loadEnv();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeD1Shim(env) as any;

  console.log(`[enrich-batch] starting (force=${force}, limit=${limit || 'all'})`);

  // Fetch all POI ids from D1
  const sql = limit > 0
    ? `SELECT id, name FROM pois ORDER BY id LIMIT ${limit}`
    : 'SELECT id, name FROM pois ORDER BY id';
  const list = await db.prepare(sql).bind().all() as { results: Array<{ id: number; name: string }> };
  console.log(`[enrich-batch] ${list.results.length} POIs to process`);

  const stats = { updated: 0, cached: 0, no_data: 0, error: 0 };
  let i = 0;
  for (const poi of list.results) {
    i++;
    try {
      const result = await enrichPoi({
        db,
        poiId: poi.id,
        openTripMapApiKey: env.OPENTRIPMAP_API_KEY,
        forceRefresh: force,
        throttleMs: 1100,                            // Nominatim 1 req/s + buffer
      });
      const tag =
        result.updated ? '✓ updated' :
        result.reason.startsWith('cached') ? '○ cached' :
        result.reason === 'no data found' ? '— no data' :
        '? ' + result.reason;
      console.log(`[${i}/${list.results.length}] poi#${poi.id} ${poi.name.padEnd(40)} ${tag} (${result.fieldsUpdated.join(', ') || '-'})`);
      if (result.updated) stats.updated++;
      else if (result.reason.startsWith('cached')) stats.cached++;
      else if (result.reason === 'no data found') stats.no_data++;
    } catch (err) {
      stats.error++;
      console.error(`[${i}/${list.results.length}] poi#${poi.id} ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n[enrich-batch] done.');
  console.log(`  updated:  ${stats.updated}`);
  console.log(`  cached:   ${stats.cached}`);
  console.log(`  no_data:  ${stats.no_data}`);
  console.log(`  error:    ${stats.error}`);
  console.log(`  total:    ${list.results.length}`);
}

main().catch((err) => {
  console.error('[enrich-batch] fatal:', err);
  process.exit(1);
});
