// @vitest-environment node
/**
 * Auto-category fix — 加入行程的各路徑必須把 Google `primaryType` 對應成
 * whitelist poi_type 後，以後端認得的 snake_case key `poi_type` 送出。
 *
 * Root cause（investigate）：entries POST body 從不帶分類，後端 entries.ts:84
 * fallback 'attraction'，導致新增景點幾乎都變「景點」。修法是在 4 個 add 路徑
 * forward poi_type。沿用本目錄 add-stop-page-*.test 的 source-grep 慣例
 * （page component 太大不易 render）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');
const ADD_STOP = read('src/pages/AddStopPage.tsx');
const ADD_FAV = read('src/pages/AddPoiFavoriteToTripPage.tsx');
const CHANGE_POI = read('src/pages/ChangePoiPage.tsx');
const CUSTOM_FORM = read('src/components/trip/CustomPoiForm.tsx');

describe('add-entry paths forward poi_type (Google primaryType → whitelist)', () => {
  it('AddStopPage imports the Google→whitelist mapper', () => {
    expect(ADD_STOP).toMatch(/mapGooglePrimaryTypeToPoiType/);
  });

  it('AddStopPage POST Body type carries optional poi_type', () => {
    expect(ADD_STOP).toMatch(/poi_type\?:\s*(string|PoiType)/);
  });

  it('AddStopPage search payload derives poi_type from r.category', () => {
    expect(ADD_STOP).toMatch(/poi_type:\s*mapGooglePrimaryTypeToPoiType\(r\.category\)/);
  });

  it('AddStopPage favorites payload derives poi_type from r.poiType', () => {
    expect(ADD_STOP).toMatch(/poi_type:\s*mapGooglePrimaryTypeToPoiType\(r\.poiType\)/);
  });

  it('AddPoiFavoriteToTripPage direct mode forwards poi_type from the favorite', () => {
    expect(ADD_FAV).toMatch(/mapGooglePrimaryTypeToPoiType/);
    expect(ADD_FAV).toMatch(/poi_type:\s*mapGooglePrimaryTypeToPoiType\(favorite\.poiType\)/);
  });

  it('ChangePoiPage mode=new google branch forwards poi_type from selected.category', () => {
    expect(CHANGE_POI).toMatch(/poi_type:\s*mapGooglePrimaryTypeToPoiType\(selected\.category\)/);
  });
});

describe('custom-stop category picker (Variant C) integration', () => {
  it('CustomPoiForm wires an optional CategoryPicker via category / onCategoryChange', () => {
    expect(CUSTOM_FORM).toMatch(/CategoryPicker/);
    expect(CUSTOM_FORM).toMatch(/onCategoryChange/);
  });

  it('AddStopPage custom payload sends user-picked poi_type from customCategory', () => {
    expect(ADD_STOP).toMatch(/poi_type:\s*customCategory/);
  });

  it('ChangePoiPage mode=new custom body sends user-picked poi_type from customCategory', () => {
    expect(CHANGE_POI).toMatch(/poi_type:\s*customCategory/);
  });

  it('ChangePoiPage non-new (alternate/master) custom body forwards type:customCategory (find-or-create key, not poi_type)', () => {
    // /alternates + /poi-id normalize body.type (NOT poi_type); the picker shows in
    // all modes so the choice must reach those endpoints too.
    expect(CHANGE_POI).toMatch(/source: 'custom', type: customCategory/);
  });
});
