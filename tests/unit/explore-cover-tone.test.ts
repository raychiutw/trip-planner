/**
 * ExplorePage cover 依三色（v2.54.11，/qa 三色比例稽核 follow-up）。
 *
 * /qa 量測發現探索頁是唯一不符「木棕為主」的頁：cover 用舊的 8 色 hash 裝飾漸層
 * （5/8 冷色 綠/藍/粉紫/紫/teal），整頁 POI grid 像彩虹。改成依 POI 類型三色
 * （poiTypeToTone）—— cover 漸層 = 卡的 `--tone → --tone-deep`，與行程一覽 cover 一致。
 *
 * source-grep contract（cover 是 CSS 顏色 + 移除 hash 計算；render 互動見 explore-page.test）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../src/pages/ExplorePage.tsx'), 'utf8');

describe('ExplorePage cover 依 POI 類型三色（v2.54.11）', () => {
  it('cover 漸層用卡的 --tone（取代 8 色 hash 裝飾）', () => {
    expect(SRC).toMatch(/\.explore-poi-card\[data-tone\]\s+\.explore-poi-cover\s*\{[^}]*linear-gradient\([^}]*var\(--tone\)/);
  });

  it('移除舊的 8 色裝飾 cover 規則（.explore-poi-cover[data-tone="1..8"]）', () => {
    expect(SRC).not.toMatch(/\.explore-poi-cover\[data-tone="[1-8]"\]/);
  });

  it('移除 place_id char-sum hash（不再算 8 色 tone）', () => {
    expect(SRC).not.toMatch(/placeIdHash/);
    expect(SRC).not.toMatch(/%\s*8\)\s*\+\s*1/);
  });

  it('card data-tone 仍用 poiTypeToTone（三色語意來源不變）', () => {
    expect(SRC).toMatch(/data-tone=\{poiTypeToTone\(mapNominatimCategory\(poi\.category\)\)\}/);
  });

  it('neutral 顯式回 accent（不靠 var() fallback）', () => {
    expect(SRC).toMatch(/\.explore-poi-card\[data-tone="neutral"\][^}]*--tone:\s*var\(--color-accent\)/);
  });
});
