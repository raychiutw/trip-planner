/**
 * resolveDesktopMiddleColumnTripId — owner 2026-07-21 回報 #2 修復用的路由判斷函式。
 * 見 src/lib/tripStackRoutes.ts 檔頭註解。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveDesktopMiddleColumnTripId, TRIP_STACK_OPERATION_PATTERNS } from '../../src/lib/tripStackRoutes';

describe('resolveDesktopMiddleColumnTripId', () => {
  it('/trips?selected=X → X', () => {
    expect(resolveDesktopMiddleColumnTripId('/trips', '?selected=t1')).toBe('t1');
  });

  it('/trips（無 selected）→ null', () => {
    expect(resolveDesktopMiddleColumnTripId('/trips', '')).toBeNull();
  });

  it('/trips/new → null（不是行程詳情）', () => {
    expect(resolveDesktopMiddleColumnTripId('/trips/new', '')).toBeNull();
  });

  it.each([
    ['/trip/t1/edit', 't1'],
    ['/trip/t1/add-stop', 't1'],
    ['/trip/t1/add-entry', 't1'],
    ['/trip/t1/collab', 't1'],
    ['/trip/t1/health', 't1'],
    ['/trip/t1/notes', 't1'],
    ['/trip/t1/stop/42/copy', 't1'],
    ['/trip/t1/stop/42/move', 't1'],
    ['/trip/t1/stop/42/change-poi', 't1'],
    ['/trip/t1/stop/42/edit', 't1'],
  ])('%s → %s（9 條操作路由都要中欄顯示 TripPage）', (pathname, expected) => {
    expect(resolveDesktopMiddleColumnTripId(pathname, '')).toBe(expected);
  });

  it.each([
    '/trip/t1',
    '/trip/t1/map',
    '/trip/t1/stop/42',
    '/trip/t1/stop/42/map',
    '/trip/t1/print',
  ])('%s → null（獨立整頁，不經過中欄，不該掛 TripPage）', (pathname) => {
    expect(resolveDesktopMiddleColumnTripId(pathname, '')).toBeNull();
  });

  it('非 trip 相關頁（/chat、/map、/favorites）→ null', () => {
    expect(resolveDesktopMiddleColumnTripId('/chat', '')).toBeNull();
    expect(resolveDesktopMiddleColumnTripId('/map', '')).toBeNull();
    expect(resolveDesktopMiddleColumnTripId('/favorites', '')).toBeNull();
  });
});

describe('TRIP_STACK_OPERATION_PATTERNS cross-check against main.tsx route 表', () => {
  const MAIN = readFileSync(join(__dirname, '../../src/entries/main.tsx'), 'utf8');

  it('main.tsx 的 <Route element={<TripStackLayout />}> 區塊剛好有 10 條 path="..."（9 操作 + add-custom-stop 例外）', () => {
    const block = MAIN.match(/<Route element=\{<TripStackLayout \/>\}>([\s\S]*?)<\/Route>/);
    expect(block).toBeTruthy();
    const paths = [...(block?.[1] ?? '').matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    expect(paths.sort()).toEqual(
      [
        'edit',
        'add-stop',
        'add-entry',
        'collab',
        'health',
        'notes',
        'stop/:entryId/copy',
        'stop/:entryId/move',
        'stop/:entryId/change-poi',
        'stop/:entryId/edit',
      ].sort(),
    );
  });

  it('每一條 main.tsx 路由 path 都被 TRIP_STACK_OPERATION_PATTERNS 其中一條 pattern 命中（避免清單漂移）', () => {
    const block = MAIN.match(/<Route element=\{<TripStackLayout \/>\}>([\s\S]*?)<\/Route>/);
    const paths = [...(block?.[1] ?? '').matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    for (const routePath of paths) {
      // main.tsx 用 :entryId route param，實際 URL 是數字/字串 id — 用一個代表值替換掉再測。
      const concrete = routePath.replace(':entryId', '42');
      const hit = TRIP_STACK_OPERATION_PATTERNS.some((re) => re.test(concrete));
      expect(hit, `path="${routePath}" (as "${concrete}") 沒有被任何 pattern 命中`).toBe(true);
    }
  });
});
