/**
 * AddEntryPage + ChangePoiPage mode=new — v2.32.0 source-grep contract.
 *
 * 新增景點 wizard：EditEntryPage 形狀（POI placeholder + 備選/時間 section）+
 * day 下拉 + 3 picker buttons (搜尋/收藏/自訂)。User pick → navigate ChangePoiPage
 * with mode=new&day=N → backend POST /entries → redirect /stop/:newId/edit。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ADD_ENTRY_PATH = path.resolve(__dirname, '../../src/pages/AddEntryPage.tsx');
const ADD_ENTRY_SRC = readFileSync(ADD_ENTRY_PATH, 'utf8');

const CHANGE_POI_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

const MAIN_TSX = readFileSync(
  path.resolve(__dirname, '../../src/entries/main.tsx'),
  'utf8',
);

describe('AddEntryPage — file exists + route registered', () => {
  it('AddEntryPage 檔案存在', () => {
    expect(existsSync(ADD_ENTRY_PATH)).toBe(true);
  });

  it('main.tsx 註冊 /add-entry route', () => {
    expect(MAIN_TSX).toContain('AddEntryPage');
    expect(MAIN_TSX).toMatch(/<Route path="add-entry" element={<AddEntryPage \/>}/);
  });
});

describe('AddEntryPage — EditEntryPage-shape layout', () => {
  it('TitleBar 用「新增景點」title prefix', () => {
    expect(ADD_ENTRY_SRC).toMatch(/title=\{titleBar\}/);
    expect(ADD_ENTRY_SRC).toContain("'新增景點'");
  });

  it('Day dropdown 用 TripSelect render + dayNum options + testid', () => {
    expect(ADD_ENTRY_SRC).toContain("import { TripSelect } from '../components/TripSelect'");
    expect(ADD_ENTRY_SRC).toContain('data-testid="add-entry-daypicker"');
    // v2.33.17: native <select> → TripSelect 拔了 per-option testid，
    // options 透過 .map 構造為 { value: d.dayNum, label: formatDayLabel(d) } 餵 TripSelect。
    expect(ADD_ENTRY_SRC).toMatch(/value:\s*d\.dayNum/);
    expect(ADD_ENTRY_SRC).toMatch(/label:\s*formatDayLabel\(d\)/);
  });

  it('Empty POI placeholder + 3 picker buttons (search / favorites / custom)', () => {
    expect(ADD_ENTRY_SRC).toContain('add-entry-poi-placeholder');
    expect(ADD_ENTRY_SRC).toContain('add-entry-pick-search');
    expect(ADD_ENTRY_SRC).toContain('add-entry-pick-favorites');
    expect(ADD_ENTRY_SRC).toContain('add-entry-pick-custom');
  });

  it('openPicker navigate ChangePoiPage with mode=new + day + tab', () => {
    expect(ADD_ENTRY_SRC).toMatch(/`\/trip\/\$\{encodeURIComponent\(tripId\)\}\/stop\/0\/change-poi\?mode=new&day=\$\{dayNum\}&tab=\$\{tab\}`/);
  });

  it('Buttons disabled when dayNum invalid (defensive)', () => {
    expect(ADD_ENTRY_SRC).toMatch(/disabled=\{!Number\.isFinite\(dayNum\)\}/);
  });

  it('Preview sections (備選 / 時間 / 移動方式) greyed 提示 user 完成後可編', () => {
    expect(ADD_ENTRY_SRC).toContain('備選');
    expect(ADD_ENTRY_SRC).toContain('時間');
    expect(ADD_ENTRY_SRC).toContain('移動方式');
    expect(ADD_ENTRY_SRC).toContain('opacity: 0.6');
  });
});

describe('ChangePoiPage — v2.32.0 mode=new branch', () => {
  it('mode union 加入 new', () => {
    expect(CHANGE_POI_SRC).toMatch(/mode:\s*'master'\s*\|\s*'alternate'\s*\|\s*'new'/);
  });

  it('解析 ?day=N → newDayNum', () => {
    expect(CHANGE_POI_SRC).toMatch(/const newDayParam = searchParams\.get\('day'\)/);
    expect(CHANGE_POI_SRC).toMatch(/const newDayNum = newDayParam \? parseInt\(newDayParam, 10\) : NaN/);
  });

  it('pageTitle / submitLabel 對應 new 模式', () => {
    expect(CHANGE_POI_SRC).toContain("mode === 'new' ? '新增景點'");
    expect(CHANGE_POI_SRC).toContain("mode === 'new' ? '加入行程'");
  });

  it('handleSubmit mode=new + custom tab → POST /entries with source: custom', () => {
    const idx = CHANGE_POI_SRC.indexOf("if (mode === 'new') {");
    expect(idx).toBeGreaterThan(0);
    const ctx = CHANGE_POI_SRC.slice(idx, idx + 800);
    expect(ctx).toMatch(/POST/);
    expect(ctx).toMatch(/\/days\/\$\{newDayNum\}\/entries/);
  });

  it('handleSubmit mode=new + search/favorites → POST /entries + navigate /edit', () => {
    expect(CHANGE_POI_SRC).toMatch(/source:\s*['"]favorite['"]/);
    expect(CHANGE_POI_SRC).toMatch(/source:\s*['"]google['"]/);
    expect(CHANGE_POI_SRC).toMatch(/navigate\(`\/trip\/\$\{encodeURIComponent\(tripId\)\}\/stop\/\$\{created\.id\}\/edit`/);
  });

  it('entryPoisVersion fetch effect 跳過 mode=new（new entry 沒對應 OCC token）', () => {
    expect(CHANGE_POI_SRC).toMatch(/if \(mode === 'new'\) return;[\s\S]{0,200}entryPoisVersion/);
  });
});
