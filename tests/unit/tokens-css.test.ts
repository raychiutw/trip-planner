import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokensPath = resolve(__dirname, '../../css/tokens.css');

describe('tokens.css', () => {
  const tokens = readFileSync(tokensPath, 'utf-8');

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

  it('Ocean-only design system: dark + print, no legacy theme blocks', () => {
    expect(tokens).toContain('body.dark {');
    expect(tokens).toContain('body.theme-print');
    expect(tokens).not.toContain('body.theme-sun');
    expect(tokens).not.toContain('body.theme-sky');
    expect(tokens).not.toContain('body.theme-zen');
    expect(tokens).not.toContain('body.theme-forest');
    expect(tokens).not.toContain('body.theme-sakura');
    expect(tokens).not.toContain('body.theme-night');
  });

  it('uses Ocean accent + white background as default @theme', () => {
    expect(tokens).toMatch(/--color-accent:\s*#0077B6/);
    expect(tokens).toMatch(/--color-background:\s*#FFFFFF/);
    expect(tokens).toMatch(/--color-foreground:\s*#222222/);
  });

  it('loads Inter + Noto Sans TC primary font stack', () => {
    expect(tokens).toMatch(/--font-family-system:.*'Inter'.*'Noto Sans TC'/);
  });

  it('includes sheet animation tokens', () => {
    expect(tokens).toContain('--ease-spring:');
    expect(tokens).toContain('--duration-sheet-open:');
    expect(tokens).toContain('--duration-sheet-close:');
  });

  it('includes non-utility tokens (z-index, layout)', () => {
    expect(tokens).toContain('--z-sticky-nav:');
    expect(tokens).toContain('--z-fab:');
    expect(tokens).toContain('--spacing-page-max-w:');
    expect(tokens).toContain('--spacing-nav-h:');
    expect(tokens).toContain('--spacing-tap-min:');
  });

  it('includes global reset', () => {
    expect(tokens).toContain('box-sizing: border-box');
    expect(tokens).toContain('font-family: var(--font-family-system)');
    expect(tokens).toContain('background: var(--color-background)');
  });

  it('does NOT include old V1 component classes', () => {
    expect(tokens).not.toContain('.request-item');
    expect(tokens).not.toContain('.chat-container');
    expect(tokens).not.toContain('.admin-');
    // keyframes 定義在 tokens.css
    expect(tokens).toContain('@keyframes stepper-pulse');
    expect(tokens).toContain('@keyframes toast-slide-down');
    expect(tokens).toContain('@keyframes toast-slide-up');
    expect(tokens).toContain('@keyframes shimmer');
  });

  it('includes page-level base styles (migrated from SCOPED_STYLES)', () => {
    expect(tokens).toContain('.day-header');
    expect(tokens).toContain('.info-panel');
    expect(tokens).toContain('.trip-btn');
    expect(tokens).toContain('.color-mode-card');
    expect(tokens).toContain('.skeleton-bone');
    expect(tokens).toContain('#tripContent section');
  });

  it('has essential token values', () => {
    const tokenAccent = tokens.match(/--color-accent:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenAccent).toBeTruthy();

    const tokenBody = tokens.match(/--font-size-body:\s*([^;]+);/)?.[1]?.trim();
    expect(tokenBody).toBeTruthy();
  });
});
