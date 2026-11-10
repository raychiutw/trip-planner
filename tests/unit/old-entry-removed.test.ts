/**
 * #1627 守門：舊入口（Pages Functions 的 /api/*）已刪除，不得復活。
 * 保留的 functions/s、functions/trip 只負責分享頁／行程頁的 OG meta，不得再 import 已刪路徑。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

describe('舊入口已刪除（#1627）', () => {
  it('functions/api 不得存在', () => {
    expect(existsSync(join(root, 'functions/api'))).toBe(false);
  });

  it('tests/api 與 vitest.config.api.mts 不得存在', () => {
    expect(existsSync(join(root, 'tests/api'))).toBe(false);
    expect(existsSync(join(root, 'vitest.config.api.mts'))).toBe(false);
  });

  it('_routes.json 不含 /api/*，但仍路由 /s/* 與 /trip/*', () => {
    const routes = JSON.parse(read('public/_routes.json'));
    expect(routes.include).not.toContain('/api/*');
    expect(routes.include).toEqual(expect.arrayContaining(['/s/*', '/trip/*']));
  });

  it('functions/ 下任何檔都不得 import 已刪的 api 路徑', () => {
    const offenders = walk('functions').filter((f) => /from\s+['"][^'"]*\/api\/|from\s+['"]\.\.\/api['"]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('functions/ 只剩 s、trip、_shared', () => {
    expect(readdirSync(join(root, 'functions')).sort()).toEqual(['_shared', 's', 'trip']);
  });

  it('三支 D1 cleanup workflow 與 scripts/cleanup-*.sql 已移除（改由 api 的 Cron Trigger）', () => {
    for (const w of ['rate-limit-cleanup', 'share-cleanup', 'invitation-cleanup']) {
      expect(existsSync(join(root, `.github/workflows/${w}.yml`))).toBe(false);
    }
    expect(readdirSync(join(root, 'scripts')).filter((n) => n.startsWith('cleanup-') && n.endsWith('.sql'))).toEqual([]);
  });

  it('migrations/ 凍結為歷史基準：保留且不再新增（新 migration 進 trip-planner-api，否則會撞號）', () => {
    const nums = readdirSync(join(root, 'migrations')).flatMap((n) => (/^(\d{4})_.*\.sql$/.exec(n) ? [Number(n.slice(0, 4))] : []));
    expect(nums.length).toBeGreaterThan(50);
    expect(Math.max(...nums)).toBe(101);
  });

  it('web 不再有套用 D1 migration 的 deploy workflow', () => {
    expect(existsSync(join(root, '.github/workflows/deploy.yml'))).toBe(false);
  });
});
