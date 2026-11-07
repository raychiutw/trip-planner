/**
 * 聊天頁「誰在說話」要看得出來（比照 App：不用頭像，靠氣泡底色與名稱標籤顏色）：
 * 自己／AI／協作者 三種氣泡底色、三種標籤文字色，解析後的實際色值必須兩兩不同。
 *
 * 起因：V3 三色退場後 `--color-accent-2-bg` 與 `--color-accent-3-bg` 值相同，
 * 原本只比 token 名的測試抓不到 AI 與旅伴撞成同一色。這裡把 token（含巢狀 var()、color-mix 內的 var()）
 * 一路展開成色值再比，不依賴「用了哪個 token 名」。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TOKENS = fs.readFileSync(path.resolve(__dirname, '../../css/tokens.css'), 'utf8');
const CHAT = fs.readFileSync(path.resolve(__dirname, '../../src/pages/ChatPage.tsx'), 'utf8');

/** 深色 token 區塊：`@layer base { body.dark { ... } }`，用括號配對取出（不靠固定字元距離）。 */
function darkBlock(): string {
  const start = TOKENS.indexOf('body.dark {', TOKENS.indexOf('@layer base {'));
  if (start < 0) throw new Error('dark token block not found');
  let depth = 0;
  for (let i = TOKENS.indexOf('{', start); i < TOKENS.length; i++) {
    if (TOKENS[i] === '{') depth++;
    else if (TOKENS[i] === '}' && --depth === 0) return TOKENS.slice(start, i + 1);
  }
  throw new Error('unbalanced dark block');
}
const DARK = darkBlock();

/** 取 token 的原始宣告值：深色先找 body.dark 區塊，找不到就沿用淺色（真實 CSS 的繼承行為）。 */
function rawToken(name: string, dark: boolean): string {
  const re = new RegExp(`(?:^|[\\s;{])${name}:\\s*([^;]+);`);
  const v = (dark ? DARK.match(re)?.[1] : undefined) ?? TOKENS.match(re)?.[1];
  if (!v) throw new Error(`token ${name} not found (${dark ? 'dark' : 'light'})`);
  return v.trim();
}

/** 把 var(--x) 一路解析到字面值；兩個 token 經不同別名指到同色也會被抓到。 */
function tokenValue(name: string, dark: boolean, depth = 0): string {
  if (depth > 8) throw new Error(`var() chain too deep at ${name}`);
  const v = rawToken(name, dark);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? tokenValue(ref[1], dark, depth + 1) : v;
}

/** 把值裡所有 var(--x) 遞迴展開成字面值（color-mix 內的也會展開）。 */
function expand(value: string, dark: boolean, depth = 0): string {
  if (depth > 8) throw new Error('var() chain too deep');
  return value.replace(/var\((--[\w-]+)\)/g, (_m, name: string) => expand(rawToken(name, dark), dark, depth + 1));
}

/** 抓 `selector { ... }` 內某屬性的值並展開成色值。 */
function resolved(selector: string, prop: 'background' | 'color', dark: boolean): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = CHAT.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'))?.[1] ?? '';
  const v = body.match(new RegExp(`(?:^|[\\s;])${prop}:\\s*([^;]+);`))?.[1].trim();
  if (!v) throw new Error(`${selector} has no ${prop}`);
  return expand(v, dark).replace(/\s+/g, ' ').toLowerCase();
}

const BUBBLES = ['.tp-chat-msg-user', '.tp-chat-msg-assistant', '.tp-chat-msg-other-user'];
const LABELS = ['.tp-chat-msg-sender-name', '.tp-chat-msg-sender-name.is-user', '.tp-chat-msg-sender-name.is-other-user'];
const pairs = <T,>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe.each([['light', false], ['dark', true]] as const)('%s：自己／AI／協作者可分辨', (_n, dark) => {
  // Value: protects=三種氣泡底色兩兩不同（比照 App 的 自己 accent／AI 中性／協作者靛藍淡染）; fails_when=任兩種解析成同一色（V3 三色退場時 AI 與旅伴就是這樣撞色）; why_new=舊測試只比 token 名、不比解析後色值; seam=none; no_claim=不含實際視覺對比（由 DESIGN.md 的對比計算與真瀏覽器檢查）
  it.each(pairs(BUBBLES))('氣泡底色不同：%s vs %s', (a, b) => {
    expect(resolved(a, 'background', dark)).not.toBe(resolved(b, 'background', dark));
  });

  // Value: protects=自己與 AI 的氣泡「看得出差異」而不只是色值不相等（RGB 各通道差總和 >= 24，滿分 765）; fails_when=兩者只差幾個色階（曾經淺色 #F2EAD9 vs #F1E8DE，肉眼等於同色，但「不相等」測試照樣通過）; why_new=上面的兩兩不相等擋不住「值不同但看起來一樣」; seam=none; no_claim=不是感知色差（ΔE），只是下限
  it('自己與 AI 的氣泡色差夠大', () => {
    const rgb = (hex: string) => { const m = hex.match(/^#([0-9a-f]{6})$/); if (!m) throw new Error(`not a plain hex: ${hex}`); return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); };
    const a = rgb(resolved('.tp-chat-msg-user', 'background', dark));
    const b = rgb(resolved('.tp-chat-msg-assistant', 'background', dark));
    const diff = a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);
    expect(diff).toBeGreaterThanOrEqual(24);
  });

  // Value: protects=三種名稱標籤文字色兩兩不同（AI muted／自己 accent 文字／協作者靛藍文字）; fails_when=標籤退回同色; why_new=同上; seam=none; no_claim=不含對比比值
  it.each(pairs(LABELS))('標籤文字色不同：%s vs %s', (a, b) => {
    expect(resolved(a, 'color', dark)).not.toBe(resolved(b, 'color', dark));
  });
});

describe('聊天不再使用頭像（比照 App）', () => {
  it('ChatPage 原始碼沒有 tp-chat-avatar 規則或元素', () => {
    expect(CHAT).not.toMatch(/tp-chat-avatar/);
  });
});
