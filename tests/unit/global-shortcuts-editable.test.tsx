/** 無 ⌘/Ctrl 的快捷鍵（⌥⇧N、⌥⇧S）在輸入框內不攔截，Mac 才打得出 Option+Shift 特殊字元。 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useGlobalShortcuts } from '../../src/lib/globalShortcuts';

let clicked = 0;
beforeEach(() => {
  clicked = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  document.body.innerHTML = '<button data-shortcut="new" id="b"></button><input id="i"/><div id="c" contenteditable="true"></div>';
  document.getElementById('b')!.addEventListener('click', () => { clicked++; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

const press = (target: Element, init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('globalShortcuts 輸入框守衛', () => {
  it('焦點在 body：⌥⇧N 觸發', () => {
    renderHook(() => useGlobalShortcuts());
    press(document.body, { code: 'KeyN', altKey: true, shiftKey: true });
    expect(clicked).toBe(1);
  });
  it('焦點在 input／contenteditable：⌥⇧N 不觸發也不 preventDefault', () => {
    renderHook(() => useGlobalShortcuts());
    for (const id of ['i', 'c']) {
      const el = document.getElementById(id)!;
      Object.defineProperty(el, 'isContentEditable', { value: id === 'c' });
      const e = press(el, { code: 'KeyN', altKey: true, shiftKey: true });
      expect(e.defaultPrevented).toBe(false);
    }
    expect(clicked).toBe(0);
  });
  it('帶 ⌘ 的 ⌥⌘F 在輸入框內照常觸發（有搜尋目標時）', () => {
    document.body.insertAdjacentHTML('beforeend', '<button data-shortcut="search" id="s"></button>');
    let s = 0;
    document.getElementById('s')!.addEventListener('click', () => { s++; });
    renderHook(() => useGlobalShortcuts());
    press(document.getElementById('i')!, { code: 'KeyF', altKey: true, metaKey: true });
    expect(s).toBe(1);
  });
});
