/** 選單鍵／Delete：輸入法組字中與長按連發不得觸發；checkbox 上的 Delete 不刪除。 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useContextMenuTrigger } from '../../src/hooks/useContextMenuTrigger';

afterEach(cleanup);

function setup() {
  const el = document.createElement('div');
  el.innerHTML = '<input type="checkbox" id="k"/><a href="#" id="l">x</a>';
  document.body.appendChild(el);
  const openAt = vi.fn(); const del = vi.fn();
  renderHook(() => useContextMenuTrigger({ current: el }, openAt, del));
  const press = (target: Element, init: KeyboardEventInit) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  return { el, openAt, del, press };
}

describe('useContextMenuTrigger keydown', () => {
  it('Delete 觸發一次', () => {
    const { el, del, press } = setup();
    press(el.querySelector('#l')!, { key: 'Delete' });
    expect(del).toHaveBeenCalledTimes(1);
  });
  it('isComposing／repeat 不觸發', () => {
    const { el, del, openAt, press } = setup();
    const l = el.querySelector('#l')!;
    press(l, { key: 'Delete', isComposing: true });
    press(l, { key: 'Delete', repeat: true });
    press(l, { key: 'ContextMenu', repeat: true });
    expect(del).not.toHaveBeenCalled();
    expect(openAt).not.toHaveBeenCalled();
  });
  it('焦點在 checkbox 時 Delete 不觸發，選單鍵照常', () => {
    const { el, del, openAt, press } = setup();
    const k = el.querySelector('#k')!;
    press(k, { key: 'Delete' });
    expect(del).not.toHaveBeenCalled();
    press(k, { key: 'ContextMenu' });
    expect(openAt).toHaveBeenCalledTimes(1);
  });
});
