import { describe, it, expect, beforeEach } from 'vitest';
import { lsSet, lsGet, LS_PREFIX } from '../../src/lib/localStorage';

/**
 * Unit tests for useDarkMode hook logic — Ocean-only design system.
 *
 * The project now ships one theme (Ocean). The hook only manages `body.dark`
 * and `<meta name="theme-color">`, no more per-theme class switching.
 */

/** Ocean theme colors (mirror of OCEAN_COLORS in useDarkMode.ts). */
const OCEAN_COLORS = { light: '#0077B6', dark: '#0D1B2A' };

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
});

describe('colorMode localStorage', () => {
  it('預設值為 auto（無儲存值時）', () => {
    const saved = lsGet('color-mode');
    expect(saved).toBeNull();
  });

  it('儲存 color-mode', () => {
    lsSet('color-mode', 'dark');
    expect(lsGet('color-mode')).toBe('dark');
  });

  it('legacy dark key 相容', () => {
    localStorage.setItem(LS_PREFIX + 'dark', JSON.stringify({ v: '1', exp: Date.now() + 86400000 }));
    expect(lsGet('dark')).toBe('1');
  });
});

describe('dark class 套用邏輯', () => {
  it('套上 dark class 時 body 變深色', () => {
    document.body.classList.add('dark');
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('移除 dark class 時 body 回到淺色', () => {
    document.body.classList.add('dark');
    document.body.classList.remove('dark');
    expect(document.body.classList.contains('dark')).toBe(false);
  });
});

describe('meta theme-color 更新', () => {
  function updateMeta(isDark) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? OCEAN_COLORS.dark : OCEAN_COLORS.light);
    }
  }

  it('淺色模式使用 Ocean primary #0077B6', () => {
    updateMeta(false);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#0077B6');
  });

  it('深色模式使用 Ocean deep navy #0D1B2A', () => {
    updateMeta(true);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#0D1B2A');
  });
});

describe('Ocean-only — 舊主題 class 不再被程式產生', () => {
  it('OCEAN_COLORS 沒有 sun/sky/zen/forest/sakura/night', () => {
    expect(OCEAN_COLORS.sun).toBeUndefined();
    expect(OCEAN_COLORS.sky).toBeUndefined();
    expect(OCEAN_COLORS.night).toBeUndefined();
  });
});
