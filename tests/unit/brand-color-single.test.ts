/**
 * 品牌色單一化守門（#1572，對應 App 票 trip-planner.flutter#548／父 spec #554）。
 *
 * 淺色模式只剩一個棕 #8A6038：所有 accent 系列 token 與寫死色碼都是它，
 * 舊的裝飾色 #A97A4A、色塊上文字色 #7A5430 與 PWA／theme-color 的舊橘 #F47B5E 不得在 production 來源出現。
 * 深色模式比照 App 單一值 #D0A576（#1702），前景文字用 App 的 tintDeep #E5C39F，見檔尾第二個 describe。
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

/** 深色色票區塊：body.dark 中含 --color-accent: 的那個（排除 composite override 區塊）。 */
const darkBlock = tokens.slice(tokens.indexOf('/* ===== Dark mode override')).match(/body\.dark\s*\{([\s\S]*?)\n\s{4}\}/)![1];
const dark = (name: string) => darkBlock.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))![1].toUpperCase();
const DARK_TINT = '#D0A576';
const DARK_TINT_DEEP = '#E5C39F';

describe('web 深色品牌色對齊 App #D0A576（#1702）', () => {
  it.each(['accent', 'accent-fill', 'accent-2', 'accent-3'])('深色 --color-%s 是 #D0A576', (name) => {
    expect(dark(name)).toBe(DARK_TINT);
  });

  it.each(['accent-deep', 'accent-text', 'accent-text-on-tonal', 'accent-2-deep', 'accent-3-deep', 'focus-ring'])(
    '深色前景 --color-%s 是 App 的 tintDeep #E5C39F', (name) => {
      expect(dark(name)).toBe(DARK_TINT_DEEP);
    });

  it('舊深色值 #CBA06E／#E0BC90 不得殘留在 production 來源', () => {
    const hits = sources.filter((f) => /#CBA06E|#E0BC90/i.test(readFileSync(f, 'utf8'))).map((f) => f.replace(ROOT + '/', ''));
    expect(hits).toEqual([]);
  });

  it('對比：前景文字壓在深色底與 tonal 底 ≥ 4.5；填色鈕深字 ≥ 4.5；焦點框對頁面底 ≥ 3', () => {
    for (const bg of ['background', 'secondary', 'accent-subtle', 'accent-bg']) {
      expect(contrastRatio(dark('accent-text'), dark(bg)), `accent-text on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(dark('accent-foreground'), dark('accent-fill'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark('focus-ring'), dark('background'))).toBeGreaterThanOrEqual(3);
  });

  it('焦點框與實心填色鈕要分得開（不得同值，否則 1.00:1）', () => {
    expect(dark('focus-ring')).not.toBe(dark('accent-fill'));
  });
});
