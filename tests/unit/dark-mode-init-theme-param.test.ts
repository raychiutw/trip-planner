// @vitest-environment jsdom
/**
 * #1732：App 開啟 web 時帶 `?theme=light|dark`，繪製前（dark-mode-init.js）
 * 就套用並寫入 localStorage color-mode。只驗外部行為：URL → body.dark 與 localStorage。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { lsGet } from '../../src/lib/localStorage';

const SCRIPT = readFileSync(path.resolve(__dirname, '../../public/dark-mode-init.js'), 'utf8');

function runInit(search: string, system: 'dark' | 'light' = 'light') {
  history.replaceState(null, '', '/' + search);
  window.matchMedia = ((q: string) => ({
    matches: system === 'dark' && q.includes('dark'),
  })) as unknown as typeof window.matchMedia;
  new Function(SCRIPT)();
}

const stored = () => {
  const raw = localStorage.getItem('tp-color-mode');
  return raw ? (JSON.parse(raw) as { v: string }).v : null;
};
const seed = (v: string) =>
  localStorage.setItem('tp-color-mode', JSON.stringify({ v, exp: Date.now() + 1e9 }));

describe('dark-mode-init.js theme 參數', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    document.documentElement.removeAttribute('data-tp-dark-init');
  });

  it('theme=dark：套用深色並覆蓋已存的 light', () => {
    seed('light');
    runInit('?theme=dark');
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(stored()).toBe('dark');
  });

  it('theme=light：覆蓋已存的 dark / auto 並維持淺色（即使系統深色）', () => {
    seed('dark');
    runInit('?theme=light', 'dark');
    expect(document.body.classList.contains('dark')).toBe(false);
    expect(stored()).toBe('light');
  });

  it.each(['?theme=', '?theme=Dark', '?theme=LIGHT', '?theme=亂填', '?theme=auto'])(
    '%s：忽略，沿用已存的 light',
    (q) => {
      seed('light');
      runInit(q);
      expect(document.body.classList.contains('dark')).toBe(false);
      expect(stored()).toBe('light');
    },
  );

  it('沒帶參數：行為不變（不寫入、跟系統）', () => {
    runInit('', 'dark');
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(stored()).toBeNull();
  });

  it('腳本寫入的值能被 useDarkMode 用的 lsGet 讀回（格式相容）', () => {
    runInit('?theme=dark');
    expect(lsGet<string>('color-mode')).toBe('dark');
  });

  it('重複 theme 參數：與 api 一致，視為沒帶（忽略，沿用已存的 light）', () => {
    seed('light');
    runInit('?theme=dark&theme=light');
    expect(document.body.classList.contains('dark')).toBe(false);
    expect(stored()).toBe('light');
  });
});
