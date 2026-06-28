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

  // ── 台灣地址簡轉繁（Google addressComponents locale fix）──
  // Root cause: Google Places v1 對部分台灣 POI 的 address（formattedAddress +
  // addressComponents）存簡體（如「屏东县琉球乡」），languageCode=zh-TW /
  // zh-Hant-TW / regionCode=TW 皆無效（Google 端資料）。displayName（店名）繁體不受影響。
  // 取證 2026-06-27：place_id ChIJHdrseQDlcTQRK06leVen9Uc（琉浪日嚐）enrich 反覆寫簡體。
  describe('台灣地址簡轉繁', () => {
    it('行政區簡體「屏东县琉球乡」→「屏東縣琉球鄉」(prod-found)', () => {
      expect(normalizePoiAddress('929台灣屏东县琉球乡中福村福德路2號'))
        .toBe('929台灣屏東縣琉球鄉中福村福德路2號');
    });

    it('多個簡體字「广东路华龙里」→ 繁體', () => {
      expect(normalizePoiAddress('台灣高雄市广东路华龙里'))
        .toBe('台灣高雄市廣東路華龍里');
    });

    it('「臺灣」前綴也判定為台灣地址', () => {
      expect(normalizePoiAddress('臺灣宜兰县罗东镇'))
        .toBe('臺灣宜蘭縣羅東鎮');
    });

    it('台灣繁體地址不變（已乾淨）', () => {
      expect(normalizePoiAddress('台灣屏東縣琉球鄉本福村環島公路245號'))
        .toBe('台灣屏東縣琉球鄉本福村環島公路245號');
    });

    it('「台北」的「台」不強轉「臺」（保留 Google 通用寫法）', () => {
      expect(normalizePoiAddress('台灣台北市大安区忠孝东路'))
        .toBe('台灣台北市大安區忠孝東路');
    });

    // 破音字非轉換鎖（fix 的安全基石：后/松 一簡對多繁，不在 S2T_TW）
    it('「后里」的「后」不誤轉「後」（區→區 仍轉）', () => {
      expect(normalizePoiAddress('台灣台中市后里区'))
        .toBe('台灣台中市后里區');
    });

    it('「松山」的「松」不誤轉「鬆」（區→區 仍轉）', () => {
      expect(normalizePoiAddress('台灣台北市松山区'))
        .toBe('台灣台北市松山區');
    });

    // 全簡體「台湾」（湾 簡體）前綴也納入 anchor → country token + 行政區都轉
    it('全簡體「台湾」前綴也轉換（湾→灣 + 行政區）', () => {
      expect(normalizePoiAddress('台湾屏东县中正路'))
        .toBe('台灣屏東縣中正路');
    });

    // ── 日本地址保護（NOT 台灣 → 不簡轉繁，保留日文新字體）──
    it('日本地址「区」不轉「區」(無「台灣」前綴)', () => {
      expect(normalizePoiAddress('日本沖縄県那覇市新宿区西新宿'))
        .toBe('日本沖縄県那覇市新宿区西新宿');
    });

    it('日本「県」「町」「号」不被簡轉繁誤動', () => {
      expect(normalizePoiAddress('日本沖縄県北谷町美浜2号'))
        .toBe('日本沖縄県北谷町美浜2号');
    });

    // adversarial case：「台灣」當地名出現在他國地址中間（非開頭 country 前綴），
    // anchor 防止誤轉其中的「区」等簡日共用字（substring 判定會 corruption）
    it('含「台灣」substring 的日本地址不被誤轉（anchor 防 corruption）', () => {
      expect(normalizePoiAddress('日本東京都新宿区台灣広場2号'))
        .toBe('日本東京都新宿区台灣広場2号');
    });

    // Codex cross-model case：街道號（1-2 碼）開頭 +「台灣」地名，不可把街道號當郵遞區號。
    // anchor 限定恰 3 或 5-6 碼台灣郵遞區號，排除此誤判。
    it('街道號開頭+「台灣」地名不誤判（郵遞區號限 3/5-6 碼）', () => {
      expect(normalizePoiAddress('2台灣広場区2号'))
        .toBe('2台灣広場区2号');
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
