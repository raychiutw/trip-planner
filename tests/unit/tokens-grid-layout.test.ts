/**
 * Unit test — tokens.css grid layout variables (P2 §1)
 *
 * 驗 `css/tokens.css` 含 layout refactor Phase 2 所需的 3 個 grid / layout
 * CSS variables，避免未來被誤刪。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_PATH = path.join(__dirname, '..', '..', 'css', 'tokens.css');
const TOKENS = fs.readFileSync(TOKENS_PATH, 'utf8');

describe('tokens.css — P2 grid layout variables', () => {
  it('--grid-3pane-desktop 為 `240px 1fr min(780px, 40vw)`', () => {
    expect(TOKENS).toMatch(/--grid-3pane-desktop:\s*240px 1fr min\(780px, 40vw\);/);
  });

  it('--grid-2pane-desktop 為 `240px 1fr`', () => {
    expect(TOKENS).toMatch(/--grid-2pane-desktop:\s*240px 1fr;/);
  });

  it('--nav-height-mobile 為 `88px`', () => {
    expect(TOKENS).toMatch(/--nav-height-mobile:\s*88px;/);
  });

  it('--sidebar-width-desktop 為 `240px`', () => {
    expect(TOKENS).toMatch(/--sidebar-width-desktop:\s*240px;/);
  });

  it('breakpoint 慣例註解存在', () => {
    expect(TOKENS).toMatch(/AppShell layout grid templates/);
    expect(TOKENS).toMatch(/≥1280px/);
    expect(TOKENS).toMatch(/1024-1279px/);
    expect(TOKENS).toMatch(/<1024px/);
  });
});
