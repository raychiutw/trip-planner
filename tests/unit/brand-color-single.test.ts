/**
 * 品牌色單一化守門（#1572，對應 App 票 trip-planner.flutter#548／父 spec #554）。
 *
 * 淺色模式只剩一個棕 #8A6038：所有 accent 系列 token 與寫死色碼都是它，
 * 舊的裝飾色 #A97A4A、色塊上文字色 #7A5430 與 PWA／theme-color 的舊橘 #F47B5E 不得在 production 來源出現。
 * 深色模式的 accent（#CBA06E 一帶）維持原狀，不在本守門範圍。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { contrastRatio } from './__helpers__/wcag';

const ROOT = resolve(__dirname, '../..');
const BRAND = '#8A6038';
const RETIRED = /#A97A4A|#7A5430|#F47B5E|169,\s*122,\s*74/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|html|json|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const sources = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'css')),
  ...walk(join(ROOT, 'functions')),
  ...walk(join(ROOT, 'public')),
  join(ROOT, 'index.html'),
];

const tokens = readFileSync(join(ROOT, 'css/tokens.css'), 'utf8');
const theme = tokens.match(/@theme\s*\{([\s\S]*?)\n\}/)![1];
const light = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))![1].toUpperCase();

describe('web 品牌色單一值 #8A6038', () => {
  it('production 來源沒有殘留舊的 #A97A4A／#7A5430／#F47B5E／rgba(169,122,74)', () => {
    const hits = sources.filter((f) => RETIRED.test(readFileSync(f, 'utf8'))).map((f) => f.replace(ROOT + '/', ''));
    expect(hits).toEqual([]);
  });

  it.each([
    'accent', 'accent-deep', 'accent-text', 'accent-text-on-tonal', 'accent-fill', 'focus-ring',
    'accent-2', 'accent-2-deep', 'accent-3', 'accent-3-deep',
  ])('淺色 --color-%s 解析成 #8A6038', (name) => {
    expect(light(name)).toBe(BRAND);
  });

  it('淡底與色塊由品牌色衍生，同組 subtle／bg 值一致，文字壓在上面 ≥ 4.5', () => {
    for (const g of ['accent', 'accent-2', 'accent-3']) {
      expect(light(`${g}-subtle`)).toBe(light('accent-subtle'));
      expect(light(`${g}-bg`)).toBe(light('accent-bg'));
    }
    expect(contrastRatio(BRAND, light('accent-subtle'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BRAND, light('accent-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
