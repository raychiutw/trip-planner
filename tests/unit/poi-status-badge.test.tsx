/**
 * PoiStatusBadge contract tests — verify autoplan T3 fix invariants:
 *   - 'active' → return null（不渲染）
 *   - 'closed' → .tp-badge.is-destructive + 文字「已歇業」+ aria-label 含 reason
 *   - 'missing' → .tp-badge.is-warning + 文字「查無資料」
 *   - 禁 emoji（no-emoji-icons.test.ts 是另一 contract test，本檔 verify 文字 + class only）
 *   - role="status"
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PoiStatusBadge from '../../src/components/shared/PoiStatusBadge';

describe('PoiStatusBadge', () => {
  it('status="active" → return null（不渲染）', () => {
    const { container } = render(<PoiStatusBadge status="active" />);
    // Only the <style> tag may render; no badge element with data-testid
    expect(container.querySelector('[data-testid="poi-status-badge"]')).toBeNull();
  });

  it('status=null → return null', () => {
    const { container } = render(<PoiStatusBadge status={null} />);
    expect(container.querySelector('[data-testid="poi-status-badge"]')).toBeNull();
  });

  it('status="closed" → .tp-badge.is-destructive + 文字「已歇業」', () => {
    render(<PoiStatusBadge status="closed" />);
    const badge = screen.getByTestId('poi-status-badge');
    expect(badge).toHaveClass('tp-badge', 'is-destructive');
    expect(badge.textContent).toContain('已歇業');
  });

  it('status="missing" → .tp-badge.is-warning + 文字「查無資料」', () => {
    render(<PoiStatusBadge status="missing" />);
    const badge = screen.getByTestId('poi-status-badge');
    expect(badge).toHaveClass('tp-badge', 'is-warning');
    expect(badge.textContent).toContain('查無資料');
  });

  it('aria-label 含 reason（screen reader 不依賴 color signal）', () => {
    render(<PoiStatusBadge status="closed" reason="永久歇業" />);
    const badge = screen.getByTestId('poi-status-badge');
    expect(badge.getAttribute('aria-label')).toBe('已歇業：永久歇業');
  });

  it('role="status" present for SR announcement', () => {
    render(<PoiStatusBadge status="closed" />);
    expect(screen.getByTestId('poi-status-badge').getAttribute('role')).toBe('status');
  });

  it('data-status attr exposes raw status value', () => {
    render(<PoiStatusBadge status="missing" />);
    expect(screen.getByTestId('poi-status-badge').getAttribute('data-status')).toBe('missing');
  });
});
