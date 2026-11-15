/**
 * 全站深色盤點補洞（#1733）。守三類缺漏，來源是逐檔盤點，不重新設計配色：
 *  1. 原生控制項（日期／時間／選單）被寫死 color-scheme: light，深色下彈出面板與捲軸仍是淺色。
 *  2. 淺色硬編碼底 + 跟主題走的前景色，深色下變成淺字壓淺底（地圖座標 pill）。
 *  3. 深色下對比不足：token 已有深色值卻被寫死的淺色 fallback 蓋掉（下拉更新失敗 pill）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');

describe('原生控制項不可寫死 color-scheme: light', () => {
  for (const f of [
    'src/components/TripDatePicker.styles.ts',
    'src/components/TripSelect.styles.ts',
    'src/components/TripTimePicker.styles.ts',
  ]) {
    it(`${f} 跟著 body 的 color-scheme`, () => {
      expect(read(f)).not.toMatch(/color-scheme:\s*light/);
    });
  }

  it('css/tokens.css 只有 body:not(.dark) 可以宣告 light', () => {
    const lines = read('css/tokens.css')
      .split('\n')
      .filter((l) => /color-scheme:\s*light\s*;/.test(l) && !l.trim().startsWith('*'));
    // 唯一合法的是「body:not(.dark) { color-scheme: light; }」那行
    expect(lines.filter((l) => !l.includes('body:not(.dark)'))).toEqual([]);
  });
});

describe('地圖座標 pill 不可淺底寫死', () => {
  for (const f of ['src/components/trip/CustomPoiForm.tsx', 'src/pages/AddCustomStopPage.tsx']) {
    it(`${f} 的 .tp-custom-picker-coord 底色走 token`, () => {
      const block = read(f).match(/\.tp-custom-picker-coord\s*\{[^}]*\}/)![0];
      expect(block).not.toMatch(/rgba\(\s*255/);
      expect(block).toMatch(/background:\s*var\(--color-/);
    });
  }
});

describe('下拉更新失敗 pill 深色對比', () => {
  it('文字色用有深色值的 token，不靠寫死的深紅 fallback', () => {
    const block = read('src/components/shell/AppShell.tsx').match(/\.app-shell-ptr-failed\s*\{[^}]*\}/)![0];
    expect(block).not.toContain('#8b2828');
    expect(block).toMatch(/color:\s*var\(--color-priority-high-dot\)/);
  });
});
