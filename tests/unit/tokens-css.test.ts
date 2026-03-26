import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokensPath = resolve(__dirname, '../../css/tokens.css');
const sharedPath = resolve(__dirname, '../../css/shared.css');

describe('tokens.css', () => {
  const tokens = readFileSync(tokensPath, 'utf-8');
  const shared = readFileSync(sharedPath, 'utf-8');

  it('includes Tailwind imports', () => {
    expect(tokens).toContain('@import "tailwindcss/theme" layer(theme)');
    expect(tokens).toContain('@import "tailwindcss/utilities" layer(utilities)');
  });

  it('includes @theme block with all design tokens', () => {
    expect(tokens).toContain('@theme {');
    expect(tokens).toContain('--color-accent:');
    expect(tokens).toContain('--color-background:');
    expect(tokens).toContain('--radius-sm:');
    expect(tokens).toContain('--shadow-md:');
    expect(tokens).toContain('--spacing-4:');
    expect(tokens).toContain('--font-size-body:');
    expect(tokens).toContain('--font-family-system:');
    expect(tokens).toContain('--transition-duration-fast:');
  });

  it('includes all 6 theme overrides (light + dark)', () => {
    expect(tokens).toContain('body.theme-sun.dark');
    expect(tokens).toContain('body.theme-sky {');
    expect(tokens).toContain('body.theme-sky.dark');
    expect(tokens).toContain('body.theme-zen {');
    expect(tokens).toContain('body.theme-zen.dark');
    expect(tokens).toContain('body.theme-forest {');
    expect(tokens).toContain('body.theme-forest.dark');
    expect(tokens).toContain('body.theme-sakura {');
    expect(tokens).toContain('body.theme-sakura.dark');
    expect(tokens).toContain('body.theme-night {');
    expect(tokens).toContain('body.theme-night.dark');
    expect(tokens).toContain('body.theme-print');
  });

  it('includes sheet animation tokens', () => {
    expect(tokens).toContain('--ease-spring:');
    expect(tokens).toContain('--duration-sheet-open:');
    expect(tokens).toContain('--duration-sheet-close:');
  });

  it('includes non-utility tokens (z-index, layout)', () => {
    expect(tokens).toContain('--z-sticky-nav:');
    expect(tokens).toContain('--z-fab:');
    expect(tokens).toContain('--page-max-w:');
    expect(tokens).toContain('--nav-h:');
    expect(tokens).toContain('--tap-min:');
  });

  it('includes global reset', () => {
    expect(tokens).toContain('box-sizing: border-box');
    expect(tokens).toContain('font-family: var(--font-family-system)');
    expect(tokens).toContain('background: var(--color-background)');
  });

  it('does NOT include component classes', () => {
    expect(tokens).not.toContain('.page-layout');
    expect(tokens).not.toContain('.container');
    expect(tokens).not.toContain('.sticky-nav');
    expect(tokens).not.toContain('.trip-btn');
    expect(tokens).not.toContain('.nav-title');
    expect(tokens).not.toContain('.request-item');
    expect(tokens).not.toContain('.chat-container');
    expect(tokens).not.toContain('.admin-');
    // stepper-pulse 和 toast-slide-* 已搬到 tokens.css（V2 元件需要）
    expect(tokens).toContain('@keyframes stepper-pulse');
    expect(tokens).toContain('@keyframes toast-slide-down');
    expect(tokens).toContain('@keyframes toast-slide-up');
  });

  it('token values match shared.css @theme block', () => {
    // Verify key token values are identical
    const tokenAccent = tokens.match(/--color-accent:\s*([^;]+);/)?.[1]?.trim();
    const sharedAccent = shared.match(/--color-accent:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenAccent).toBe(sharedAccent);

    const tokenBody = tokens.match(/--font-size-body:\s*([^;]+);/)?.[1]?.trim();
    const sharedBody = shared.match(/--font-size-body:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenBody).toBe(sharedBody);
  });
});
