// @vitest-environment node
/**
 * Editable POI category — EditEntryPage wires the (reusable) EditableCategoryChip into the
 * master + alternates, calling PATCH /entries/:eid/pois/:poiId { poi_type }. Backend behavior
 * (re-point, collision-safe) is covered by tests/api/entry-pois.integration.test.ts; here we
 * lock the wiring via source-grep (EditEntryPage is too large to render meaningfully).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');
const EDIT_ENTRY = read('src/pages/EditEntryPage.tsx');
const BACKEND = read('functions/api/trips/[id]/entries/[eid]/pois/[poiId].ts');
const ADD_STOP = read('src/pages/AddStopPage.tsx');
const CHANGE_POI = read('src/pages/ChangePoiPage.tsx');

describe('AddStopPage — search result per-result category override', () => {
  it('imports EditableCategoryChip', () => {
    expect(ADD_STOP).toMatch(/import \{ EditableCategoryChip \}/);
  });

  it('selected search card shows an editable chip defaulting to the auto-derived category', () => {
    expect(ADD_STOP).toMatch(/isSelected && \(/);
    expect(ADD_STOP).toMatch(/searchCatOverride\[r\.place_id\] \?\? mapGooglePrimaryTypeToPoiType\(r\.category\)/);
    expect(ADD_STOP).toMatch(/autoValue=\{mapGooglePrimaryTypeToPoiType\(r\.category\)\}/);
  });

  it('search payload sends the per-result override when set, else the auto-derived poi_type', () => {
    expect(ADD_STOP).toMatch(/poi_type: searchCatOverride\[r\.place_id\] \?\? mapGooglePrimaryTypeToPoiType\(r\.category\)/);
  });

  it('clears the per-result override on deselect (no stale manual category on reselect)', () => {
    // toggleSearch 的 deselect 分支必須 delete searchCatOverride[id]，
    // 否則重新選取會殘留上次手動選的分類，而非回到 auto-derived 預設。
    expect(ADD_STOP).toMatch(/setSearchCatOverride\(\(m\) => \{[\s\S]*?delete cleaned\[id\]/);
  });
});

describe('EditEntryPage — editable category (master + alternates)', () => {
  it('imports the reusable EditableCategoryChip', () => {
    expect(EDIT_ENTRY).toMatch(/import \{ EditableCategoryChip \}/);
  });

  it('master category is editable, wired to handleChangeCategory (isMaster = true)', () => {
    expect(EDIT_ENTRY).toMatch(/handleChangeCategory\(masterSummary\.poiId, true,/);
  });

  it('each alternate category is editable, wired to handleChangeCategory (isMaster = false)', () => {
    expect(EDIT_ENTRY).toMatch(/handleChangeCategory\(alt\.poiId, false,/);
  });

  it('handler PATCHes /entries/:eid/pois/:poiId with poi_type and re-applies the returned poiId', () => {
    expect(EDIT_ENTRY).toMatch(/entries\/\$\{entryId\}\/pois\/\$\{poiId\}/);
    expect(EDIT_ENTRY).toMatch(/poi_type: newType/);
    expect(EDIT_ENTRY).toMatch(/poiId: newPoiId/);
  });

  it('uses the canonical CATEGORY_ICON (no local POI_TYPE_ICON drift duplicate)', () => {
    // v2.33.28 drift-bug 家族：本地 icon/label const 與 canonical 漂移。本地 POI_TYPE_ICON
    // 之前漏 `other` key → other 類 POI 顯示成 attraction pin。改用 CategoryPicker 匯出的
    // CATEGORY_ICON（8 類齊全）杜絕漂移。
    expect(EDIT_ENTRY).toMatch(/import \{[^}]*CATEGORY_ICON[^}]*\} from '\.\.\/components\/trip\/CategoryPicker'/);
    expect(EDIT_ENTRY).not.toMatch(/const POI_TYPE_ICON/);
  });
});

describe('ChangePoiPage mode=new — search result editable category override', () => {
  it('imports the reusable EditableCategoryChip', () => {
    expect(CHANGE_POI).toMatch(/import \{ EditableCategoryChip \}/);
  });

  it('has a per-selection searchCatOverride state (single-select model)', () => {
    expect(CHANGE_POI).toMatch(/const \[searchCatOverride, setSearchCatOverride\] = useState<PoiType \| null>\(null\)/);
  });

  it('renders the chip only for a selected search result in mode=new, defaulting to the auto-derived category', () => {
    expect(CHANGE_POI).toMatch(/mode === 'new' && selected\?\.source === 'search'/);
    expect(CHANGE_POI).toMatch(/autoValue=\{mapGooglePrimaryTypeToPoiType\(selected\.category\)\}/);
  });

  it('mode=new search payload sends the override when set, else the auto-derived poi_type', () => {
    expect(CHANGE_POI).toMatch(/poi_type: searchCatOverride \?\? mapGooglePrimaryTypeToPoiType\(selected\.category\)/);
  });

  it('resets the override on deselect / new selection (fresh auto-derive per pick)', () => {
    expect(CHANGE_POI).toMatch(/setSearchCatOverride\(null\)/);
  });

  it('chip uses dropUp + a selection-scoped key (fixed bottom bar: picker must open upward, remount per pick)', () => {
    // picker 在 fixed bottom bar 下方無空間 → dropUp 向上彈出；key 綁選取身分 → 換選取 remount 關掉殘留 picker。
    expect(CHANGE_POI).toMatch(/dropUp/);
    expect(CHANGE_POI).toMatch(/key=\{`\$\{selected\.name\}-\$\{selected\.lat\}-\$\{selected\.lng\}`\}/);
  });

  it('scopes a flex-wrap override onto the shared bottom bar (3 non-shrinking items must wrap on mobile)', () => {
    expect(CHANGE_POI).toMatch(/\.tp-page-bottom-bar\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});

describe('backend PATCH /pois/:poiId — poi_type contract', () => {
  it('validates poi_type against the whitelist and reuses findOrCreatePoi', () => {
    expect(BACKEND).toMatch(/ALLOWED_POI_TYPES/);
    expect(BACKEND).toMatch(/findOrCreatePoi/);
  });

  it('re-points trip_entry_pois.poi_id rather than mutating the shared pois.type', () => {
    expect(BACKEND).toMatch(/UPDATE trip_entry_pois SET poi_id/);
    expect(BACKEND).not.toMatch(/UPDATE pois SET type/);
  });
});
