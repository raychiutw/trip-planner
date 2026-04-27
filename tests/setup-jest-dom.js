/**
 * Jest-DOM matchers 設定（toBeInTheDocument, toHaveAttribute 等）
 * 供 @testing-library/react 元件測試使用。
 */
import '@testing-library/jest-dom';

// Node.js 25 內建 localStorage 但缺少 .clear()/.key()/.length — jsdom 也無法正確覆蓋
// 用完整的 Map-backed polyfill 替代
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  const ls = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
}

// jsdom 不提供 window.matchMedia — useDarkMode / ThemeToggle 需要它。
// 提供一個保守的 stub（永遠回傳 matches=false + 標準 EventTarget 介面）。
if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.matchMedia !== 'function') {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
