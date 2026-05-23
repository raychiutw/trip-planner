/**
 * infobox-safetext.test.ts — v2.33.44 round 6a coverage
 *
 * InfoBox.safeText() 是 API shape adapter — 接 string / number / 物件
 * {label, text} / {text} / {name} 等不同形態的 user content。v2.28.3 +
 * v2.31.17 加新 API field，shape 又改了，silent fall-through 到 String(value)
 * 會 render `[object Object]`。本 spec 守每個 branch。
 */
import { describe, it, expect } from 'vitest';
import { safeText } from '../../src/components/trip/InfoBox';

describe('safeText', () => {
  it('null / undefined → empty string', () => {
    expect(safeText(null)).toBe('');
    expect(safeText(undefined)).toBe('');
  });

  it('string passes through', () => {
    expect(safeText('hello')).toBe('hello');
    expect(safeText('')).toBe('');
  });

  it('number / boolean → String(value)', () => {
    expect(safeText(42)).toBe('42');
    expect(safeText(0)).toBe('0');
    expect(safeText(true)).toBe('true');
    expect(safeText(false)).toBe('false');
  });

  it('{label, text} → "label: text"', () => {
    expect(safeText({ label: '證件', text: '護照' })).toBe('證件: 護照');
  });

  it('{text} → text', () => {
    expect(safeText({ text: 'note 內容' })).toBe('note 內容');
  });

  it('{name} → name', () => {
    expect(safeText({ name: '寶可夢中心' })).toBe('寶可夢中心');
  });

  it('{label, text} 優先於 {text}（label 完整）', () => {
    expect(safeText({ label: 'A', text: 'B', name: 'C' })).toBe('A: B');
  });

  it('{text} 優先於 {name}（text 完整）', () => {
    expect(safeText({ text: 'B', name: 'C' })).toBe('B');
  });

  it('未知 shape → String(value) fallback（regression guard）', () => {
    // Object 沒有 label/text/name → 走 String(value)，會回 [object Object]
    expect(safeText({ foo: 'bar' })).toBe('[object Object]');
  });

  it('array → String(value)', () => {
    expect(safeText(['a', 'b'])).toBe('a,b');
  });

  it('mixed-type label / text values 被 ignore', () => {
    // label 是 number 不是 string → 走 fallback 找 text
    expect(safeText({ label: 1, text: 'only' })).toBe('only');
    expect(safeText({ label: '只 label 沒 text' })).toBe('[object Object]');
  });
});
