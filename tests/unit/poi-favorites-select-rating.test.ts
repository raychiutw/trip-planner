// @vitest-environment node
/**
 * v2.31.17 fix: poi-favorites GET 補 p.rating SELECT。
 *
 * Bug #114（prod QA found）：
 *   AddStopPage / ChangePoiPage favorites card 沒辦法顯 ★ N.N（v2.31.10/11
 *   先拔了孤兒 star icon），原因是 functions/api/poi-favorites.ts SELECT 沒
 *   JOIN p.rating，frontend 拿不到 data。
 *
 * fix：SELECT 補 `p.rating AS poi_rating`，deepCamel 自動轉成 response 的
 *   `poiRating`，frontend PoiFavoriteRow type + UI 配合補回 ★ + rating。
 *
 * Pure-text grep（避開 D1 integration test 跑 miniflare 的 overhead）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/poi-favorites.ts'),
  'utf8',
);

describe('v2.31.17 poi-favorites GET SELECT 補 rating', () => {
  it('GET SQL SELECT 含 p.rating AS poi_rating', () => {
    // 找 SELECT pf.id 開頭那個主查詢（GET 的 D1 prepare 第一參數）
    const selectIdx = SRC.indexOf('SELECT pf.id, pf.user_id, pf.poi_id');
    expect(selectIdx).toBeGreaterThan(0);
    // 取 SELECT 起算 800 char 涵蓋 FROM clause 前的所有欄位
    const selectBlock = SRC.slice(selectIdx, selectIdx + 800);
    expect(selectBlock).toMatch(/p\.rating AS poi_rating/);
  });

  it('SELECT 仍含原本的 pois 欄位（regression：不要意外刪掉）', () => {
    const selectIdx = SRC.indexOf('SELECT pf.id, pf.user_id, pf.poi_id');
    const selectBlock = SRC.slice(selectIdx, selectIdx + 800);
    expect(selectBlock).toMatch(/p\.name AS poi_name/);
    expect(selectBlock).toMatch(/p\.address AS poi_address/);
    expect(selectBlock).toMatch(/p\.lat AS poi_lat/);
    expect(selectBlock).toMatch(/p\.lng AS poi_lng/);
    expect(selectBlock).toMatch(/p\.type AS poi_type/);
  });
});
