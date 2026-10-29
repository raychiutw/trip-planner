/**
 * CSS 變數守門 —— 引用的 var(--x) 都要有定義。
 *
 * 變數沒定義時瀏覽器不報錯：顏色算成 none、字級退回繼承值，畫面靜默壞掉，
 * 只驗「有用 var」的測試一路全綠。2026-09-24 一次掃出 6 處：落地頁插畫
 * --d1..--d4（prod 隱形兩個月），另有 --color-danger、--color-surface、
 * --font-size-caption1／support／title1 從加進來那天起就不存在。
 *
 * 範圍：沒有 fallback、名字寫死的 var()。帶 fallback 的 var(--x, y) 不會整個失效；
 * 也認 Tailwind 任意值簡寫（utility 名後接括號包住的變數名）。動態組名（var(--day-text-${n})）由 day-palette-text.test.ts 守。
 * 這條讀原始碼；build 產物（含 @theme tree-shake 後）由 e2e css-var-resolution.spec.js 驗。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '../../');

const files = ['src', 'css'].flatMap((dir) =>
  (readdirSync(join(ROOT, dir), { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => join(dir, f)),
);

/**
 * 剝掉註解 —— 說明文字裡的 var(--x)／--x: 不算數。
 * `//` 只在行首或空白後才算註解（整行與行尾都剝），避開 https:// 與 '//cdn' 這類字串。
 * ponytail: 正規式不懂字串 —— 字串裡「空白＋//」之後的同一行會被一起剝掉（2026-09-24 src 零例）；
 * 真的踩到再換成會跳過字串的 tokenizer。
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
/** 定義：--x: …、'--x': …（style 物件）、setProperty('--x', …) */
const definitionsIn = (src: string) => [
  ...[...src.matchAll(/(--[\w-]+)['"]?\s*:/g)].map((m) => m[1]),
  ...[...src.matchAll(/setProperty\(\s*['"](--[\w-]+)/g)].map((m) => m[1]),
];
/** 引用：沒有 fallback、名字寫死的 var(--x)，以及 Tailwind 任意值簡寫（utility 名後接括號包住的變數名） */
const referencesIn = (src: string) => [
  ...[...src.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]),
  ...[...src.matchAll(/-\((--[\w-]+)\)/g)].map((m) => m[1]),
];

const sources = files.map((f) => ({ f, src: strip(readFileSync(join(ROOT, f), 'utf-8')) }));
// ponytail: defined 是全 repo 一個集合，不分選擇器、主題、media —— 只在深色或某個 media 裡定義的變數
// 也算「有定義」。目前淺深色 token 都成對；要抓這類再改成逐規則比對範圍。
const defined = new Set(sources.flatMap(({ src }) => definitionsIn(src)));

describe('CSS 變數 — 解析邏輯（守門自己也要被守住）', () => {
  it('整行、行尾、區塊註解裡的 --x: 都不算定義；https:// 後面的程式碼照常掃', () => {
    const src = strip([
      '// --a: 整行註解',
      'const x = 1; // --b: 行尾註解',
      '/* --c: 區塊註解 */',
      'const u = "https://e.com"; const css = `.k{--d: 4px}`;',
    ].join('\n'));
    expect(definitionsIn(src)).toEqual(['--d']);
  });

  it("'--x': 物件鍵與 setProperty('--x') 都算定義", () => {
    expect(definitionsIn("style={{ '--k': v }}; el.style.setProperty('--m', v);")).toEqual(['--k', '--m']);
  });

  it('Tailwind 任意值簡寫也算引用（--z-print-exit 就是這樣被當成沒人用而刪掉）', () => {
    // 執行時才組字串 —— 原始碼裡寫死的話，Tailwind 會把它當真的 class 產出 CSS
    const shorthand = (utility: string, name: string) => `${utility}-(${name})`;
    expect(referencesIn(`className="fixed ${shorthand('z', '--z-a')} ${shorthand('bg', '--b')}"`)).toEqual(['--z-a', '--b']);
  });

  it('帶 fallback 的 var(--x, y) 不算引用；寫死名字的 var(--x) 才算', () => {
    expect(referencesIn('a{color:var(--p, red);background:var(--q);width:var( --r )}')).toEqual(['--q', '--r']);
  });
});

describe('CSS 變數 — 引用的都要有定義', () => {
  it('掃得到巢狀目錄（舊版 Node 會忽略 readdirSync 的 recursive，靜默只掃頂層）', () => {
    expect(files).toContain(join('src', 'pages', 'LandingPage.tsx'));
  });

  it('沒有 fallback 的 var(--x) 都找得到 --x 的定義', () => {
    const missing = sources.flatMap(({ f, src }) =>
      referencesIn(src).filter((name) => !defined.has(name)).map((name) => `${name} ← ${f}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });
});
