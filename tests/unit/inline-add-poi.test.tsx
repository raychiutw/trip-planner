/**
 * InlineAddPoi — V3 inline + 加景點 affordance (PR3 v2.9).
 *
 * Replaces DaySection's `<Link to="/chat?...">+ 在 Day N 加景點</Link>` button
 * with an inline expandable card. Search results are placeholder until backend
 * gains POI search endpoint (or Nominatim integration). 「AI 幫我找」 chip
 * preserves the existing /chat fallback path so this is never a dead end.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InlineAddPoi from '../../src/components/trip/InlineAddPoi';

function renderInline(props: Partial<React.ComponentProps<typeof InlineAddPoi>> = {}) {
  return render(
    <MemoryRouter>
      <InlineAddPoi
        tripId="okinawa-2026"
        dayNum={1}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('InlineAddPoi — collapsed state', () => {
  it('renders collapsed call-to-action by default', () => {
    renderInline();
    const cta = screen.getByTestId('inline-add-poi-trigger');
    expect(cta.textContent).toContain('在 Day 1 加景點');
  });

  it('clicking trigger expands the form', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    expect(screen.getByTestId('inline-add-poi-form')).toBeTruthy();
  });

  it('expanded form has close button that collapses', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    fireEvent.click(screen.getByTestId('inline-add-poi-close'));
    expect(screen.queryByTestId('inline-add-poi-form')).toBeNull();
    expect(screen.getByTestId('inline-add-poi-trigger')).toBeTruthy();
  });
});

describe('InlineAddPoi — expanded form', () => {
  it('shows search input and quick chips', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    expect(screen.getByTestId('inline-add-poi-search')).toBeTruthy();
    expect(screen.getByTestId('inline-add-poi-chip-ai')).toBeTruthy();
    expect(screen.getByTestId('inline-add-poi-chip-custom')).toBeTruthy();
  });

  it('shows placeholder result list with disabled add buttons', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const results = screen.getAllByTestId(/inline-add-poi-result-add-/);
    expect(results.length).toBeGreaterThan(0);
    results.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      expect(btn.getAttribute('title')).toMatch(/即將推出|搜尋/);
    });
  });

  it('search input is disabled with placeholder explaining backend pending', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const search = screen.getByTestId('inline-add-poi-search') as HTMLInputElement;
    expect(search.disabled).toBe(true);
    expect(search.placeholder).toMatch(/即將推出|改用|chat|AI/i);
  });
});

describe('InlineAddPoi — chat fallback', () => {
  it('AI chip is a link to /chat with prefilled prompt', () => {
    renderInline({ tripId: 'okinawa-2026', dayNum: 3 });
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const aiChip = screen.getByTestId('inline-add-poi-chip-ai') as HTMLAnchorElement;
    expect(aiChip.getAttribute('href')).toContain('/chat');
    expect(aiChip.getAttribute('href')).toContain('tripId=okinawa-2026');
    expect(decodeURIComponent(aiChip.getAttribute('href') ?? '')).toContain('Day 3');
  });

  it('Custom chip is a link to /chat with custom prompt prefix', () => {
    renderInline({ tripId: 'okinawa-2026', dayNum: 2 });
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    const customChip = screen.getByTestId('inline-add-poi-chip-custom') as HTMLAnchorElement;
    expect(customChip.getAttribute('href')).toContain('/chat');
    expect(decodeURIComponent(customChip.getAttribute('href') ?? '')).toContain('Day 2');
  });
});

describe('InlineAddPoi — backend-pending hint', () => {
  it('shows pending notice in expanded form', () => {
    renderInline();
    fireEvent.click(screen.getByTestId('inline-add-poi-trigger'));
    expect(screen.getByTestId('inline-add-poi-form').textContent).toMatch(/即將推出|backend|搜尋/);
  });
});
