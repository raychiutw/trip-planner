import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = readFileSync('css/tokens.css', 'utf8');
const rule = (sel: string) => css.split('\n').find((l) => l.startsWith(sel)) ?? '';

describe('PasswordToggle 共用樣式（.tp-pw-toggle）', () => {
  it('觸控目標至少 44×44', () => {
    const r = rule('.tp-pw-toggle {');
    expect(r).toContain('min-width: 44px');
    expect(r).toContain('min-height: 44px');
  });
  it('有 :hover 與 :focus-visible', () => {
    expect(rule('.tp-pw-toggle:hover')).not.toBe('');
    expect(rule('.tp-pw-toggle:focus-visible')).toContain('outline');
  });
});
