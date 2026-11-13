/**
 * DesktopSidebar B（#1689，owner 2026-11-13 簽核）— macOS tint source list。
 * 實底、選取 = accent-bg tint + 中性文字、「我的行程」可摺疊、帳號列姓名＋信箱、
 * 主導覽不再包 --tabbar-* 浮動卡片（該材質回歸手機底部膠囊）。
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopSidebar from '../../src/components/shell/DesktopSidebar';

const TRIPS = [{ tripId: 'kyoto-5', name: '京都', published: true } as never];

function renderSidebar(user: { name: string; email: string } | null = { name: 'Ray', email: 'ray@x.com' }) {
  const r = render(
    <MemoryRouter initialEntries={['/trips']}>
      <DesktopSidebar user={user} trips={TRIPS} activeTripId="kyoto-5" />
    </MemoryRouter>,
  );
  const style = r.container.querySelector('style')?.textContent ?? '';
  return { ...r, style };
}
const rule = (style: string, sel: string) => style.match(new RegExp(`${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('DesktopSidebar B — 材質', () => {
  it('實底 secondary、右側 1px 分隔線；不是毛玻璃', () => {
    const { container, style } = renderSidebar();
    const r = rule(style, '.tp-sidebar');
    expect(r).toMatch(/background:\s*var\(--color-secondary\)/);
    expect(r).toMatch(/border-right:\s*1px solid var\(--color-border\)/);
    expect(r).not.toMatch(/--glass-|backdrop-filter/);
    expect(container.querySelector('.tp-sidebar')?.classList.contains('tp-glass')).toBe(false);
  });

  it('主導覽不再用 --tabbar-* 浮動卡片材質', () => {
    const { style } = renderSidebar();
    expect(style).not.toMatch(/--tabbar-/);
  });

  it('選取 = accent-bg tint + 中性文字；icon 用 accent', () => {
    const { style } = renderSidebar();
    const on = rule(style, '.tp-sidebar-nav-item.is-active');
    expect(on).toMatch(/background:\s*var\(--color-accent-bg\)/);
    expect(on).toMatch(/color:\s*var\(--color-foreground\)/);
    expect(on).not.toMatch(/accent-fill|accent-foreground/);
    expect(rule(style, '.tp-sidebar-nav-item .svg-icon')).toMatch(/color:\s*var\(--color-accent\)/);
    expect(rule(style, '.tp-trip-item.is-active')).toMatch(/background:\s*var\(--color-accent-bg\)/);
  });
});

describe('DesktopSidebar B — 我的行程可摺疊', () => {
  it('button 帶 aria-expanded，預設展開；點擊摺疊／展開清單', () => {
    renderSidebar();
    const btn = screen.getByRole('button', { name: /我的行程/ });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('sidebar-trip-kyoto-5')).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('sidebar-trip-kyoto-5')).toBeTruthy();
  });

  it('aria-controls 永遠指向存在的元素：摺疊時仍在 DOM 且 hidden，展開時可見', () => {
    const { container } = renderSidebar();
    const btn = screen.getByRole('button', { name: /我的行程/ });
    const target = () => container.ownerDocument.getElementById(btn.getAttribute('aria-controls')!);
    expect(target()).not.toBeNull();
    expect(target()!.hasAttribute('hidden')).toBe(false);
    fireEvent.click(btn);
    expect(target()).not.toBeNull();
    expect(target()!.hasAttribute('hidden')).toBe(true);
    fireEvent.click(btn);
    expect(target()!.hasAttribute('hidden')).toBe(false);
  });

  it('hidden 要真的隱藏：樣式不得用 display 覆蓋 [hidden]', () => {
    const { style } = renderSidebar();
    expect(rule(style, '.tp-sidebar-trips')).toMatch(/display:\s*flex/);
    expect(style).toMatch(/\.tp-sidebar-trips\[hidden\]\s*\{[^}]*display:\s*none/);
  });
});

describe('DesktopSidebar B — 焦點與 dark 不變式', () => {
  it('新增的 :focus-visible 都帶 DESIGN.md 規定的內帶 box-shadow', () => {
    const { style } = renderSidebar();
    expect(rule(style, '.tp-sidebar-section-label:focus-visible')).toMatch(/box-shadow:\s*0 0 0 2px var\(--color-background\)/);
  });

  it('dark 覆寫不得冗餘：不得出現 body.dark .tp-sidebar', () => {
    const { style } = renderSidebar();
    expect(style).not.toMatch(/body\.dark\s+\.tp-sidebar/);
  });
});

describe('DesktopSidebar B — 帳號列', () => {
  it('同時顯示姓名與信箱', () => {
    renderSidebar({ name: 'Ray', email: 'ray@x.com' });
    const card = screen.getByTestId('sidebar-account-card');
    expect(card.querySelector('.tp-account-name')?.textContent).toBe('Ray');
    expect(card.querySelector('.tp-account-email')?.textContent).toBe('ray@x.com');
  });
});
