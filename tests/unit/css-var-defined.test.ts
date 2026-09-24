/**
 * CSS 變數守門 —— 引用的 var(--x) 都要有定義。
 *
 * 變數沒定義時瀏覽器不報錯：顏色算成 none、字級退回繼承值，畫面靜默壞掉，
 * 只驗「有用 var」的測試一路全綠。2026-09-24 一次掃出 6 處：落地頁插畫
 * --d1..--d4（prod 隱形兩個月），另有 --color-danger、--color-surface、
 * --font-size-caption1／support／title1 從加進來那天起就不存在。
 *
 * 範圍：沒有 fallback、名字寫死的 var()。帶 fallback 的 var(--x, y) 不會整個失效；
 * 動態組名（var(--day-text-${n})）由 day-palette-text.test.ts 守。
 * 這條讀原始碼；瀏覽器實際算出的顏色由 e2e tokens-layer.spec.ts 驗落地頁。
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

/** 剝掉註解 —— 說明文字裡的 var(--x) 不算引用。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sources = files.map((f) => ({ f, src: strip(readFileSync(join(ROOT, f), 'utf-8')) }));

const defined = new Set(
  sources.flatMap(({ src }) => [
    ...[...src.matchAll(/(--[\w-]+)['"]?\s*:/g)].map((m) => m[1]),        // --x: …／'--x': …
    ...[...src.matchAll(/setProperty\(\s*['"](--[\w-]+)/g)].map((m) => m[1]),
  ]),
);

describe('CSS 變數 — 引用的都要有定義', () => {
  it('沒有 fallback 的 var(--x) 都找得到 --x 的定義', () => {
    const missing = sources.flatMap(({ f, src }) =>
      [...src.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
        .map((m) => m[1])
        .filter((name) => !defined.has(name))
        .map((name) => `${name} ← ${f}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });
});
