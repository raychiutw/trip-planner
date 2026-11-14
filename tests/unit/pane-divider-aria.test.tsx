/**
 * 分隔線 ARIA 範圍（#1692 審查）：aria-valuemin／valuemax 必須是實際夾值範圍
 * （最小寬 中欄 400／右欄 360 換算成百分比），而不是 0／100，否則輔助科技報出走不到的刻度。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AppShell from '../../src/components/shell/AppShell';

const TOTAL = 1000; // 中欄 500 + 右欄 500

function mockWidths() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const w = this.matches('[data-testid="app-shell-main"],[data-testid="app-shell-sheet"]') ? TOTAL / 2 : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: 0, width: w, height: 0, toJSON() {} } as DOMRect;
  });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('PaneDivider aria 範圍', () => {
  it('valuemin／valuemax 依最小寬換算（400／360 of 1000 → 40／64），不是 0／100', async () => {
    mockWidths();
    render(<AppShell sidebar={null} main={<div />} sheet={<div />} />);
    const sep = await screen.findByRole('separator');
    expect(sep.getAttribute('aria-valuemin')).toBe('40');
    expect(sep.getAttribute('aria-valuemax')).toBe('64');
    expect(sep.getAttribute('aria-valuenow')).toBe('50');
  });

  it('鍵盤推到極限時 valuenow 停在 valuemax／valuemin', async () => {
    mockWidths();
    render(<AppShell sidebar={null} main={<div />} sheet={<div />} />);
    const sep = await screen.findByRole('separator');
    for (let i = 0; i < 20; i++) fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(sep.getAttribute('aria-valuenow')).toBe(sep.getAttribute('aria-valuemax'));
    for (let i = 0; i < 40; i++) fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(sep.getAttribute('aria-valuenow')).toBe(sep.getAttribute('aria-valuemin'));
  });
});

describe('PaneDivider 指標行為', () => {
  const press = (sep: Element, init: object) => {
    sep.setPointerCapture = vi.fn();
    fireEvent.pointerDown(sep, { pointerId: 1, clientX: 500, ...init });
  };
  it('非主鍵（右鍵）按下不進入拖曳', async () => {
    mockWidths();
    render(<AppShell sidebar={null} main={<div />} sheet={<div />} />);
    const sep = await screen.findByRole('separator');
    press(sep, { button: 2 });
    expect(sep.getAttribute('data-dragging')).toBe('false');
    press(sep, { button: 0 });
    expect(sep.getAttribute('data-dragging')).toBe('true');
  });
  it('lostpointercapture 結束拖曳', async () => {
    mockWidths();
    render(<AppShell sidebar={null} main={<div />} sheet={<div />} />);
    const sep = await screen.findByRole('separator');
    press(sep, { button: 0 });
    fireEvent.lostPointerCapture(sep, { pointerId: 1 });
    expect(sep.getAttribute('data-dragging')).toBe('false');
  });
});
