/**
 * Unit test — tokens.css grid layout variables (P2 §1 · rev2 2026-07-17)
 *
 * 驗 `css/tokens.css` 含 layout refactor 所需的 grid / layout CSS variables，
 * 避免未來被誤刪。owner 2026-07-17 rev2：桌機三欄 `216px 1fr 1fr`
 * （sidebar 216 / 中欄行程 1fr / 右欄地圖 1fr，等寬）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_PATH = path.join(__dirname, '..', '..', 'css', 'tokens.css');
const TOKENS = fs.readFileSync(TOKENS_PATH, 'utf8');

describe('tokens.css — grid layout variables (rev2)', () => {
  it('--grid-3pane-desktop 為 `216px 1fr 1fr`（rev2 三欄等寬）', () => {
    expect(TOKENS).toMatch(/--grid-3pane-desktop:\s*216px 1fr 1fr;/);
  });

  it('--grid-2pane-desktop 為 `216px 1fr`', () => {
    expect(TOKENS).toMatch(/--grid-2pane-desktop:\s*216px 1fr;/);
  });

  it('--nav-height-mobile 為 `88px`', () => {
    expect(TOKENS).toMatch(/--nav-height-mobile:\s*88px;/);
  });

  it('--sidebar-width-desktop 為 `216px`', () => {
    expect(TOKENS).toMatch(/--sidebar-width-desktop:\s*216px;/);
  });

  it('breakpoint 慣例註解存在', () => {
    expect(TOKENS).toMatch(/AppShell layout grid templates/);
    expect(TOKENS).toMatch(/≥1024px/);
    expect(TOKENS).toMatch(/<1024px/);
  });
});
