/**
 * ChatPage 依角色三色 — avatar tone（v2.54.9，mockup V1「輕觸」）。
 *
 * 色 = 誰在說話：你=柔褐（accent，is-user avatar 已是）、AI=sage（accent-2）、
 * 共編旅伴=pink（accent-3）。修掉原本 AI 與旅伴 avatar 撞色（都 secondary/foreground）
 * 分不出的問題。avatar 底用 `--color-accent-2-bg`/`-3-bg`（隨 light/dark 翻轉、對
 * `--color-foreground` 字 ~7–12:1，避開 vivid sage/粉 dark mode <2:1 的對比 fail）。
 *
 * 純 CSS 顏色改動 → source-grep contract（render 測 avatar 存在見 chat-page-ai-avatar）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../../src/pages/ChatPage.tsx'), 'utf8');

/** 抓某個 CSS selector 的 rule body（`.selector { ... }`）。 */
function ruleBody(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = SRC.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

describe('ChatPage avatar 依角色三色（v2.54.9）', () => {
  it('AI avatar (.is-ai) 底用 sage 的 -bg 階（dark-safe，非 vivid --color-accent-2）', () => {
    const body = ruleBody('.tp-chat-avatar.is-ai');
    // 必須是 -bg 階（隨 light/dark 翻轉、對 foreground 字 ~7–12:1）；
    // vivid --color-accent-2 dark mode 對 foreground 僅 1.78:1，故明確排除。
    expect(body).toMatch(/background:\s*var\(--color-accent-2-bg\)/);
    expect(body).not.toMatch(/background:\s*var\(--color-accent-2\)\s*;/);
    // 不再用原本的 --color-foreground 實心深底（撞色來源）
    expect(body).not.toMatch(/background:\s*var\(--color-foreground\)/);
  });

  it('共編旅伴 avatar (.is-other-user) 底用 pink 的 -bg 階（dark-safe）', () => {
    const body = ruleBody('.tp-chat-avatar.is-other-user');
    expect(body).toMatch(/background:\s*var\(--color-accent-3-bg\)/);
    expect(body).not.toMatch(/background:\s*var\(--color-accent-3\)\s*;/);
    // 不再用 secondary（與 AI 撞色來源）
    expect(body).not.toMatch(/background:\s*var\(--color-secondary\)/);
  });

  it('avatar 字用 --color-foreground（對比安全，非 --t-deep）', () => {
    expect(ruleBody('.tp-chat-avatar.is-ai')).toMatch(/color:\s*var\(--color-foreground\)/);
    expect(ruleBody('.tp-chat-avatar.is-other-user')).toMatch(/color:\s*var\(--color-foreground\)/);
  });

  it('avatar 角色色用單一 rule 涵蓋 light/dark（-bg token 自己翻轉、無 [data-theme=dark] 覆寫）', () => {
    // 移除了原本的 [data-theme="dark"] .tp-chat-avatar.is-ai / .is-other-user 覆寫；
    // 留著會是 dead override（-bg token 已 per-mode）。確保沒殘留。
    expect(SRC).not.toMatch(/\[data-theme="dark"\]\s*\.tp-chat-avatar\.is-ai/);
    expect(SRC).not.toMatch(/\[data-theme="dark"\]\s*\.tp-chat-avatar\.is-other-user/);
  });

  it('你自己的 avatar (base .tp-chat-avatar) 維持柔褐 accent', () => {
    // is-user 沿用 base .tp-chat-avatar = --color-accent（不改），符合「你=柔褐」。
    const base = ruleBody('.tp-chat-avatar');
    expect(base).toMatch(/background:\s*var\(--color-accent\)/);
  });
});
