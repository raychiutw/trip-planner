/**
 * Jest-DOM matchers 設定（toBeInTheDocument, toHaveAttribute 等）
 * 供 @testing-library/react 元件測試使用。
 */
import '@testing-library/jest-dom';

// Node.js 25 內建 localStorage accessor；讀取它會噴 `--localstorage-file`
// warning。用 descriptor 偵測後直接覆蓋，避免觸發 getter。
const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
if (
  !localStorageDescriptor ||
  typeof localStorageDescriptor.get === 'function' ||
  !localStorageDescriptor.value ||
  typeof localStorageDescriptor.value.clear !== 'function'
) {
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
  if (typeof globalThis.window !== 'undefined') {
    Object.defineProperty(globalThis.window, 'localStorage', { value: ls, writable: true, configurable: true });
  }
}

// jsdom 不提供 ResizeObserver — @headlessui Listbox 內部 element-movement
// observer 需要它。提供 no-op stub。
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
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
