import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const boot = readFileSync(resolve(__dirname, '../../public/dark-mode-init.js'), 'utf8');
beforeEach(() => { localStorage.clear(); document.body.classList.remove('dark'); document.documentElement.removeAttribute('data-tp-dark-init'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each([{ v: 'dark' }, { v: 'dark', exp: 1 }, { v: 'dark', exp: String(Date.now() + 60000) }])('ignores invalid or expired preferences at first paint: %j', entry => {
  localStorage.setItem('tp-color-mode', JSON.stringify(entry)); localStorage.setItem('tp-dark', JSON.stringify({ ...entry, v: '1' }));
  new Function(boot)(); expect(document.body).not.toHaveClass('dark');
});
it('still follows the system when browser storage is unavailable before React loads', () => {
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.stubGlobal('matchMedia', () => ({ matches: true })); new Function(boot)(); expect(document.body).toHaveClass('dark');
});
