/**
 * LandingPage — 未登入首頁
 *
 * 現況問題：`/` 落到 `path="*"` → LegacyRedirect → `/trips` → `/login`，
 * 未登入訪客直接被丟到登入頁，完全不知道這個 app 是做什麼的。
 * Google Play 上架也需要一個能說明功能的落地頁。
 *
 * 視覺 SoT：docs/design-sessions/2026-07-20-landing-page-FINAL-variantB.html
 * （owner 於三版比較後選定變體 B — SVG 插畫導向）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../');
const landing = readFileSync(resolve(ROOT, 'src/pages/LandingPage.tsx'), 'utf-8');
const mainEntry = readFileSync(resolve(ROOT, 'src/entries/main.tsx'), 'utf-8');

/** 剝掉註解 —— 解釋用的散文不該滿足「必須存在 X」的斷言。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const page = strip(landing);
const entry = strip(mainEntry);

describe('路由 — / 不再直接踢到登入頁', () => {
  it('/ 有明確的 route，不落到 path="*"', () => {
    expect(entry).toMatch(/<Route\s+path="\/"\s/);
  });

  it('/ 指向 LandingPage', () => {
    expect(entry).toMatch(/<Route\s+path="\/"[^>]*LandingPage/);
  });

  it('已登入者不該看到行銷頁，導向 /trips', () => {
    expect(page).toMatch(/\/trips/);
  });
});

describe('LandingPage — 內容', () => {
  it('有導向登入的主要 CTA', () => {
    expect(page).toMatch(/to="\/login"|href="\/login"/);
  });

  it('頁尾連到隱私權政策（Google Play 要求可取得）', () => {
    expect(page).toMatch(/\/privacy/);
  });

  it('用 .tp-lp-* class 前綴（新 component 慣例）', () => {
    expect(page).toMatch(/tp-lp-/);
  });
});

describe('LandingPage — 視覺資產策略（變體 B 的核心）', () => {
  it('插畫是 inline SVG，不是圖片檔', () => {
    // 選變體 B 的理由就是「零圖片檔」。一旦改用 <img>，
    // 就變成專案第一批圖片資產 —— DESIGN.md L284「全站不做 artwork」被推翻。
    expect(page).toMatch(/<svg/);
    expect(page, '不得引入圖片檔，否則變體 B 的選擇理由失效').not.toMatch(/<img\s/);
  });

  it('SVG 用 token 上色，深色模式自動適應', () => {
    expect(page).toMatch(/var\(--color-accent|var\(--d\d/);
  });

  it('SVG 有 a11y 描述（role + aria-label）', () => {
    expect(page).toMatch(/role="img"/);
    expect(page).toMatch(/aria-label=/);
  });
});

describe('LandingPage — 桌機手機同一版（owner 要求）', () => {
  it('用 media query 而非兩套 component', () => {
    expect(page).toMatch(/@media\s*\(min-width:\s*761px\)/);
  });

  it('觸控目標 ≥44px', () => {
    expect(page).toMatch(/min-height:\s*(4[4-9]|[5-9]\d)px/);
  });
});

describe('LandingPage — 不得殘留已否決的文案', () => {
  it('沒有「用 Google 帳號登入即可」（owner 2026-07-20 要求刪除）', () => {
    expect(page).not.toMatch(/用 Google 帳號登入即可/);
    expect(page).not.toMatch(/Google 帳號或 Email 皆可/);
  });
});
