/**
 * v2.31.89：trip detail embedded TitleBar「切換行程」改 dropdown picker
 * （對齊 ChatPage TitleBar trip picker UX）。
 *
 * User feedback：「要用的下拉選單的版本的 icon」— v2.31.85 simple icon button
 * 改成 swap-horiz + chevron ▾ + dropdown 列 trips。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.89: TripsListPage embedded TitleBar trip picker dropdown', () => {
  const src = read('src/pages/TripsListPage.tsx');

  it('保留 trip-switch-trigger testid 但 button 結構升級 dropdown picker', () => {
    expect(src).toMatch(/className="tp-titlebar-trip-picker"[\s\S]*?data-testid="trip-switch-trigger"/);
  });

  it('button 內含 swap-horiz icon + chevron ▾（對齊 ChatPage 設計）', () => {
    expect(src).toMatch(/<Icon name="swap-horiz" \/>\s*<span className="tp-titlebar-trip-picker-chevron"[^>]*>▾<\/span>/);
  });

  it('dropdown menu 結構：.tp-titlebar-trip-menu wrap + .tp-titlebar-trip-dropdown panel + role="menu"', () => {
    expect(src).toMatch(/className="tp-titlebar-trip-menu"/);
    expect(src).toMatch(/className="tp-titlebar-trip-dropdown" role="menu"/);
    expect(src).toMatch(/className=\{`tp-titlebar-trip-row \$\{t\.tripId === effectiveSelectedId \? 'is-active' : ''\}`\}/);
  });

  it('aria-haspopup=menu + aria-expanded 綁 tripPickerOpen state', () => {
    expect(src).toMatch(/aria-haspopup="menu"\s+aria-expanded=\{tripPickerOpen\}/);
  });

  it('row click 切換 selected URL（reuse handleCardClick logic）+ 關閉 menu', () => {
    expect(src).toMatch(/setActiveTrip\(t\.tripId\);[\s\S]*?next\.set\('selected',\s*t\.tripId\);[\s\S]*?setSearchParams\(next,\s*\{\s*replace:\s*false\s*\}\);[\s\S]*?setTripPickerOpen\(false\)/);
  });

  it('outside click effect close menu (useEffect tripPickerOpen dep)', () => {
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(!tripPickerOpen\) return;[\s\S]*?tripPickerRef\.current && !tripPickerRef\.current\.contains[\s\S]*?setTripPickerOpen\(false\)/);
  });

  it('testid trip-switch-pick-${tripId} 給每個 menu row（QA selector）', () => {
    expect(src).toMatch(/data-testid=\{`trip-switch-pick-\$\{t\.tripId\}`\}/);
  });
});
