/**
 * W8 · useKeyboardInset — 手機軟鍵盤 inset（visualViewport）+ composer wiring。
 *
 * owner 2026-07-24 選「保留 Enter 送出」，W8 只做 visualViewport：軟鍵盤彈出時把
 * composer 頂到鍵盤上方。這裡鎖 inset 計算（innerHeight - vv.height - vv.offsetTop）、
 * resize 更新、unmount 清除，以及 ChatPage 有接上 hook + Enter 送出未被動到。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useKeyboardInset } from '../../src/hooks/useKeyboardInset';

function Harness() {
  useKeyboardInset();
  return null;
}

function mockVV(height: number, offsetTop = 0) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    height,
    offsetTop,
    addEventListener: (t: string, cb: () => void) => { (listeners[t] ??= []).push(cb); },
    removeEventListener: (t: string, cb: () => void) => { listeners[t] = (listeners[t] ?? []).filter((f) => f !== cb); },
    _emit: (t: string) => (listeners[t] ?? []).forEach((f) => f()),
  };
}

function setVV(vv: unknown) {
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
}
function setInnerHeight(h: number) {
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
}
const kbInset = () => document.documentElement.style.getPropertyValue('--kb-inset');

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--kb-inset');
});

describe('useKeyboardInset', () => {
  it('鍵盤收起（vv.height == innerHeight）→ inset 0', () => {
    setInnerHeight(800);
    setVV(mockVV(800, 0));
    render(<Harness />);
    expect(kbInset()).toBe('0px');
  });

  it('鍵盤彈出（vv.height 縮小 300）→ inset 300px', () => {
    setInnerHeight(800);
    setVV(mockVV(500, 0));
    render(<Harness />);
    expect(kbInset()).toBe('300px');
  });

  it('visualViewport resize → inset 更新', () => {
    setInnerHeight(800);
    const vv = mockVV(800, 0);
    setVV(vv);
    render(<Harness />);
    expect(kbInset()).toBe('0px');
    vv.height = 500;
    vv._emit('resize');
    expect(kbInset()).toBe('300px');
  });

  it('unmount → 清除 --kb-inset', () => {
    setInnerHeight(800);
    setVV(mockVV(500, 0));
    const { unmount } = render(<Harness />);
    expect(kbInset()).toBe('300px');
    unmount();
    expect(kbInset()).toBe('');
  });

  it('無 visualViewport（桌機舊瀏覽器）→ no-op 不崩', () => {
    setVV(undefined);
    expect(() => render(<Harness />)).not.toThrow();
    expect(kbInset()).toBe('');
  });
});

describe('W8 wiring source-lock', () => {
  const src = readFileSync(join(__dirname, '../../src/pages/ChatPage.tsx'), 'utf8');

  it('ChatPage 接上 useKeyboardInset + composer 用 --kb-inset', () => {
    expect(src).toMatch(/useKeyboardInset\(\)/);
    expect(src).toMatch(/translateY\(calc\(-1 \* var\(--kb-inset/);
  });

  it('Enter 送出保留（owner 2026-07-24：不反轉成 ⌘Enter）', () => {
    // 送出條件仍是 Enter 且非 Shift、非組字中；沒有改成 metaKey/ctrlKey 才送。
    expect(src).toMatch(/e\.key === 'Enter' && !e\.shiftKey/);
    expect(src).not.toMatch(/e\.key === 'Enter' && \(e\.metaKey \|\| e\.ctrlKey\)/);
  });
});
