// @vitest-environment node
/**
 * v2.31.36 fix #137: normalize POI address — collapse doubled admin suffix chars
 * (號號 / 縣縣 / 市市 等) + collapse 連續逗號/空白。
 *
 * Bug 取證（prod QA）：Google Places 回 raw address「242 台灣新北市新莊區幸福路 736 號號地下一層」
 * 含「號號」doubled char（user 提交 typo at Google Maps）。Frontend display 直接顯成「號號」。
 *
 * Fix：backend 寫 pois.address 前 normalize（apply at google-client.ts search/details
 * 邊界，後續所有 INSERT/UPDATE 路徑 inherit clean data）+ backfill script 清 existing rows。
 */
import { describe, it, expect } from 'vitest';
import { normalizePoiAddress } from '../../src/lib/maps/normalize-address';

describe('v2.31.36 normalizePoiAddress', () => {
  describe('doubled admin suffix collapse', () => {
    it('「號號」→「號」(prod-found case)', () => {
      expect(normalizePoiAddress('242台灣新北市新莊區幸福路736號號地下一層'))
        .toBe('242台灣新北市新莊區幸福路736號地下一層');
    });

    it('「縣縣」→「縣」', () => {
      expect(normalizePoiAddress('沖繩縣縣那霸市'))
        .toBe('沖繩縣那霸市');
    });

    it('「市市」→「市」', () => {
      expect(normalizePoiAddress('東京市市中央區'))
        .toBe('東京市中央區');
    });

    it('「区区」(Japanese kanji 区) → 「区」', () => {
      expect(normalizePoiAddress('東京都新宿区区某地'))
        .toBe('東京都新宿区某地');
    });

    it('「県県」(Japanese 県) → 「県」', () => {
      expect(normalizePoiAddress('沖縄県県那覇市'))
        .toBe('沖縄県那覇市');
    });

    it('「号号」(Japanese 号) → 「号」', () => {
      expect(normalizePoiAddress('那覇市1-2-3号号'))
        .toBe('那覇市1-2-3号');
    });

    it('triple「號號號」→「號」', () => {
      expect(normalizePoiAddress('736 號號號 building'))
        .toBe('736 號 building');
    });

    it('「路路」「街街」「巷巷」「弄弄」', () => {
      expect(normalizePoiAddress('中山路路 1 段')).toBe('中山路 1 段');
      expect(normalizePoiAddress('信義街街 5 號')).toBe('信義街 5 號');
      expect(normalizePoiAddress('A 巷巷 B 弄弄')).toBe('A 巷 B 弄');
    });

    it('「鎮鎮」「鄉鄉」「村村」「里里」', () => {
      expect(normalizePoiAddress('竹山鎮鎮中山里里')).toBe('竹山鎮中山里');
      expect(normalizePoiAddress('美濃鄉鄉某村村')).toBe('美濃鄉某村');
    });

    it('「町町」(Japanese 町) → 「町」', () => {
      expect(normalizePoiAddress('北谷町町美浜')).toBe('北谷町美浜');
    });

    it('「丁目」+「丁丁」(Japanese)', () => {
      // 丁 單字也算 admin（丁目 = 街區），doubled「丁丁」→「丁」
      expect(normalizePoiAddress('1 丁丁目')).toBe('1 丁目');
    });
  });

  describe('non-admin chars unaffected (regression)', () => {
    it('「水水合甲烷」化學詞不 collapse（水 不是 admin suffix）', () => {
      expect(normalizePoiAddress('水水合甲烷研究所')).toBe('水水合甲烷研究所');
    });

    it('「東京都新宿区」單字不重複不變', () => {
      expect(normalizePoiAddress('東京都新宿区西新宿 2-8-1'))
        .toBe('東京都新宿区西新宿 2-8-1');
    });

    it('已乾淨 address 不變', () => {
      expect(normalizePoiAddress('沖縄県那覇市美栄橋 1-2-3 号'))
        .toBe('沖縄県那覇市美栄橋 1-2-3 号');
    });

    it('「西街口」(街 + 口 非 admin doubled) 不 collapse', () => {
      expect(normalizePoiAddress('西街口 5 號')).toBe('西街口 5 號');
    });
  });

  describe('whitespace + comma cleanup', () => {
    it('連續逗號 collapse「,,」→「,」', () => {
      expect(normalizePoiAddress('A, , B,, C')).toBe('A, B, C');
    });

    it('中文全形逗號「，，」→「，」', () => {
      expect(normalizePoiAddress('A，，B')).toBe('A，B');
    });

    it('連續空白 collapse', () => {
      expect(normalizePoiAddress('A    B   C')).toBe('A B C');
    });

    it('trim head/tail whitespace', () => {
      expect(normalizePoiAddress('  A B  ')).toBe('A B');
    });
  });

  describe('null / empty / non-string', () => {
    it('null → null', () => {
      expect(normalizePoiAddress(null)).toBe(null);
    });

    it('undefined → null', () => {
      expect(normalizePoiAddress(undefined)).toBe(null);
    });

    it('empty string → null', () => {
      expect(normalizePoiAddress('')).toBe(null);
    });

    it('whitespace-only → null', () => {
      expect(normalizePoiAddress('   ')).toBe(null);
    });
  });
});
