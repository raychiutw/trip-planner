/**
 * v2.31.91：chat bubble 內 markdown link 改用 site terracotta 風格
 * （user feedback：「報告連結 樣式不符合網站風格」— browser 預設藍/紫 underline）。
 *
 * AI reply 含 markdown `[前往行程筆記](/trip/:id/notes)` link，MarkdownText
 * 渲染 <a>，現在套 site accent color + subtle underline 對齊 terracotta UX。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.91: chat bubble markdown link site style', () => {
  const src = read('src/pages/ChatPage.tsx');

  it('.tp-chat-msg a 用 terracotta accent color（accent-deep fallback accent）', () => {
    expect(src).toMatch(/\.tp-chat-msg a\s*\{[\s\S]*?color:\s*var\(--color-accent-deep,\s*var\(--color-accent\)\)/);
  });

  it('.tp-chat-msg a 有 underline 1px + 2px offset（subtle non-default）', () => {
    expect(src).toMatch(/\.tp-chat-msg a\s*\{[\s\S]*?text-decoration:\s*underline[\s\S]*?text-decoration-thickness:\s*1px[\s\S]*?text-underline-offset:\s*2px/);
  });

  it('.tp-chat-msg a:hover opacity 0.7 transition', () => {
    expect(src).toMatch(/\.tp-chat-msg a:hover\s*\{\s*opacity:\s*0\.7/);
  });

  it('.tp-chat-msg-user a 用 accent-foreground（white on orange bg）+ semi-transparent underline', () => {
    expect(src).toMatch(/\.tp-chat-msg-user a\s*\{[\s\S]*?color:\s*var\(--color-accent-foreground\)[\s\S]*?text-decoration-color:\s*rgba\(255,\s*255,\s*255,\s*0\.55\)/);
  });
});
