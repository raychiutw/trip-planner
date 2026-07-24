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
const kbOpen = () => document.documentElement.getAttribute('data-kb-open');

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--kb-inset');
  document.documentElement.removeAttribute('data-kb-open');
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

describe('#1140 item 10 — 鍵盤開合切換 data-kb-open（收 root tab 的訊號）', () => {
  it('inset 超門檻（300 > 120）→ 掛 data-kb-open="1"', () => {
    setInnerHeight(800);
    setVV(mockVV(500, 0));
    render(<Harness />);
    expect(kbOpen()).toBe('1');
  });

  it('inset 小幅（URL bar 顯隱，80 < 120）→ 不掛 data-kb-open', () => {
    setInnerHeight(800);
    setVV(mockVV(720, 0));
    render(<Harness />);
    expect(kbInset()).toBe('80px');
    expect(kbOpen()).toBeNull();
  });

  it('鍵盤收起（resize 回 inset 0）→ 移除 data-kb-open', () => {
    setInnerHeight(800);
    const vv = mockVV(500, 0);
    setVV(vv);
    render(<Harness />);
    expect(kbOpen()).toBe('1');
    vv.height = 800;
    vv._emit('resize');
    expect(kbOpen()).toBeNull();
  });

  it('unmount → 清除 data-kb-open', () => {
    setInnerHeight(800);
    setVV(mockVV(500, 0));
    const { unmount } = render(<Harness />);
    expect(kbOpen()).toBe('1');
    unmount();
    expect(kbOpen()).toBeNull();
  });
});

describe('wiring source-lock', () => {
  const chatSrc = readFileSync(join(__dirname, '../../src/pages/ChatPage.tsx'), 'utf8');
  const mainSrc = readFileSync(join(__dirname, '../../src/entries/main.tsx'), 'utf8');
  const appShellSrc = readFileSync(join(__dirname, '../../src/components/shell/AppShell.tsx'), 'utf8');

  it('#1140 item 10：useKeyboardInset 改由 app root 全站掛（main.tsx），非 ChatPage', () => {
    // 全站掛一次 → 所有頁面都能收 tab；ChatPage 不再各自掛（避免雙掛 cleanup 打架）。
    expect(mainSrc).toMatch(/useKeyboardInset\(\)/);
    expect(chatSrc).not.toMatch(/useKeyboardInset\(\)/);
  });

  it('composer 仍用全站 --kb-inset 上移（不受移到 app root 影響）', () => {
    expect(chatSrc).toMatch(/translateY\(calc\(-1 \* var\(--kb-inset/);
  });

  it('#1140 item 10：data-kb-open 時 root tab 滑出畫面', () => {
    expect(appShellSrc).toMatch(/:root\[data-kb-open="1"\]\s*\.app-shell-bottom-nav\s*\{[\s\S]{0,120}transform:\s*translate\(-50%,/);
  });

  it('Enter 送出保留（owner 2026-07-24：不反轉成 ⌘Enter）', () => {
    // 送出條件仍是 Enter 且非 Shift、非組字中；沒有改成 metaKey/ctrlKey 才送。
    expect(chatSrc).toMatch(/e\.key === 'Enter' && !e\.shiftKey/);
    expect(chatSrc).not.toMatch(/e\.key === 'Enter' && \(e\.metaKey \|\| e\.ctrlKey\)/);
  });
});
