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
