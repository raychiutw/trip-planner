// @vitest-environment node
/**
 * 「使用者的行程清單」不得從公開清單取
 *
 * 2026-07-21 prod 回歸（owner 回報：側邊欄「尚無行程」、切換器只剩 tripId）：
 * migration 0089 把既有 10 個行程改為 `published = 0` 之後，兩個地方同時空掉。
 *
 * 根因不是 0089，是這兩處**本來就取錯來源**：
 *   - `src/hooks/useMyTrips.ts` 打 `/trips?all=1`。`all=1` 需要
 *     `ops:trips:read` service-token scope（`trips.ts` 的 `hasOpsScope`），
 *     一般使用者拿不到 → 靜默 fallback 成 `WHERE t.published = 1`。
 *   - `src/pages/TripPage.tsx` 打 `/trips`，那支永遠只回 `published = 1`。
 *
 * 也就是說，這兩處一直在用「全站公開行程」冒充「我的行程」。過去看起來能用，
 * 純粹是因為前端建立行程時寫死 `published: 1`（v2.57.0 已移除）。
 *
 * 正確來源是 `/api/my-trips` —— `FROM trip_permissions WHERE p.user_id = ?`，
 * 純看權限、不看 published，這才是「我的行程」的定義。
 *
 * 用 source-grep 而非 render 測試：要鎖的是「打哪一支 API」這個契約，
 * 而它在兩個不同層（hook 與 page）各出現一次，grep 比搭兩套 render harness 直接。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('useMyTrips — 側邊欄「我的行程」', () => {
  const SRC = read('src/hooks/useMyTrips.ts');

  it('打 /my-trips，不打公開清單', () => {
    expect(SRC, '應改用權限來源 /my-trips').toMatch(/apiFetch<[\s\S]*?>\('\/my-trips'\)/);
  });

  it('不再依賴 /trips?all=1（一般使用者拿不到 ops scope，會靜默降級成公開清單）', () => {
    expect(SRC).not.toMatch(/\/trips\?all=1/);
  });
});

describe('TripPage — 行程切換器與預設行程', () => {
  const SRC = read('src/pages/TripPage.tsx');

  it('行程清單來自 /my-trips', () => {
    expect(SRC).toMatch(/apiFetch<[\s\S]*?>\('\/my-trips'\)/);
  });

  it('不再從 /trips 取清單', () => {
    expect(SRC).not.toMatch(/apiFetch<[\s\S]*?>\('\/trips'\)/);
  });

  it('預設行程不再靠 published === 1 挑選', () => {
    // `/my-trips` 回的每一筆都是使用者有權限的，published 與可否存取無關。
    // 舊邏輯 `trips.find(t => t.published === 1)` 在全部 unpublish 後回 undefined，
    // 於是沒有預設行程可導。
    expect(SRC, '仍在用 published 挑預設行程').not.toMatch(/published\s*===\s*1/);
  });
});
