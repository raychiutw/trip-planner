/**
 * 分隔線聚焦／hover 的 3px 線對相鄰欄背景的對比守門（WCAG 1.4.11 非文字對比 ≥3:1、2.4.7）。
 * 分隔線夾在中欄（--color-secondary）與右欄（--color-tertiary）之間，線色必須對兩者都 ≥3。
 * 線色從 AppShell 的規則讀出 token 名，再到 tokens.css 解析淺／深色值。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from './__helpers__/wcag';

const shell = readFileSync(join(__dirname, '../../src/components/shell/AppShell.tsx'), 'utf8');
const css = readFileSync(join(__dirname, '../../css/tokens.css'), 'utf8');

const rule = shell.match(/\.app-shell-divider:focus-visible::before[^{]*\{([^}]*)\}/);
if (!rule) throw new Error('AppShell 找不到 .app-shell-divider:focus-visible::before 規則 — 選擇器改了？守衛不可靜默失效');
const token = (rule[1].match(/background:\s*var\((--[\w-]+)\)/) ?? [])[1];

const darkBlock = [...css.matchAll(/body\.dark\s*\{([\s\S]*?)\}/g)].map((m) => m[1]).find((b) => b.includes('--color-accent:')) ?? '';
const lightBlock = css; // 淺色 token 在 @theme，取檔內第一個宣告
const hex = (block: string, name: string) => (block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)) ?? [])[1];
/** 深色沒覆寫的 token 沿用淺色值 */
const resolve = (mode: 'light' | 'dark', name: string) => (mode === 'dark' ? hex(darkBlock, name) : undefined) ?? hex(lightBlock, name);

describe('分隔線焦點線對比', () => {
  it('焦點線用 token 上色', () => { expect(token).toMatch(/^--color-/); });
  for (const mode of ['light', 'dark'] as const) {
    for (const surface of ['--color-secondary', '--color-tertiary']) {
      it(`${mode}：${token} 對 ${surface} ≥ 3:1`, () => {
        const fg = resolve(mode, token);
        const bg = resolve(mode, surface);
        expect(fg, `${mode} ${token}`).toMatch(/^#/);
        expect(bg, `${mode} ${surface}`).toMatch(/^#/);
        expect(contrastRatio(fg!, bg!)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
