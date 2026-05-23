/**
 * ChangePoiPage 自訂 tab — v2.31.98 source-grep contract test。
 *
 * 確認 ChangePoiPage 接上 shared <CustomPoiForm> + 新 custom tab + submit
 * 走 {name, lat, lng, source: 'custom'} payload。同 AddStopPage 自訂 tab。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

const CUSTOM_FORM_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/trip/CustomPoiForm.tsx'),
  'utf8',
);

describe('ChangePoiPage — v2.31.98 自訂 tab wiring', () => {
  it('imports CustomPoiForm shared component', () => {
    expect(SRC).toMatch(/import\s+\{\s*CustomPoiForm[\s\S]*?\}\s+from\s+['"]\.\.\/components\/trip\/CustomPoiForm['"]/);
  });

  it('Tab type includes custom (via shared lib/poiSearchHelpers PoiSearchTab)', () => {
    // v2.33.34: Tab 改 import from poiSearchHelpers as PoiSearchTab
    expect(SRC).toMatch(/type\s+PoiSearchTab\s+as\s+Tab/);
    const helperSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/poiSearchHelpers.ts'),
      'utf8',
    );
    expect(helperSrc).toMatch(/PoiSearchTab\s*=\s*'search'\s*\|\s*'favorites'\s*\|\s*'custom'/);
  });

  it('renders 自訂 tab button with testid', () => {
    expect(SRC).toContain('change-poi-tab-custom');
    expect(SRC).toMatch(/aria-selected=\{tab === 'custom'\}/);
  });

  it('renders <CustomPoiForm> when tab === custom', () => {
    expect(SRC).toMatch(/tab === 'custom'[\s\S]*?<CustomPoiForm/);
  });

  it('passes testIdPrefix="change-poi-custom" to CustomPoiForm', () => {
    expect(SRC).toContain(`testIdPrefix="change-poi-custom"`);
  });

  it('handleSubmit gates custom tab on title + coord', () => {
    expect(SRC).toMatch(/if \(tab === 'custom'\)/);
    expect(SRC).toMatch(/'請輸入標題'|'請在地圖上選擇位置'/);
  });

  it('handleSubmit custom branch posts source=custom', () => {
    expect(SRC).toMatch(/source:\s*['"]custom['"]/);
  });

  it('handleSubmit alternate mode hits /alternates endpoint with POST', () => {
    expect(SRC).toMatch(/entries\/\$\{entryId\}\/alternates[\s\S]{0,200}method:\s*['"]POST['"]/);
  });

  it('handleSubmit master mode hits /poi-id endpoint with PUT', () => {
    expect(SRC).toMatch(/entries\/\$\{entryId\}\/poi-id/);
  });

  it('TitleBar action button disabled gating supports custom tab (title + coord)', () => {
    expect(SRC).toMatch(/submitDisabled[\s\S]{0,200}tab === 'custom'/);
  });
});

describe('CustomPoiForm — shared contract', () => {
  it('exports CustomPoiForm + CustomPoiCoord type', () => {
    expect(CUSTOM_FORM_SRC).toMatch(/export function CustomPoiForm/);
    expect(CUSTOM_FORM_SRC).toMatch(/export type CustomPoiCoord/);
  });

  it('uses usePlacesAutocomplete + useTypeaheadKeyboard (encapsulated)', () => {
    expect(CUSTOM_FORM_SRC).toContain('usePlacesAutocomplete');
    expect(CUSTOM_FORM_SRC).toContain('useTypeaheadKeyboard');
  });

  it('hits /places/resolve when typeahead suggestion picked', () => {
    expect(CUSTOM_FORM_SRC).toContain('/places/resolve');
  });

  it('renders LocationPickerMap with flyToSignal', () => {
    expect(CUSTOM_FORM_SRC).toContain('LocationPickerMap');
    expect(CUSTOM_FORM_SRC).toContain('flyToSignal');
  });

  it('owns hint checkbox testid via testIdPrefix prop', () => {
    expect(CUSTOM_FORM_SRC).toMatch(/`\$\{testIdPrefix\}-hint`/);
  });

  it('embeds two-pane media query for ≥1024px (mockup C)', () => {
    expect(CUSTOM_FORM_SRC).toMatch(/@media\s*\(min-width:\s*1024px\)/);
    expect(CUSTOM_FORM_SRC).toMatch(/grid-template-columns:\s*380px\s+1fr/);
  });
});
