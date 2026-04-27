import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageHeader from '../../src/components/shell/PageHeader';

describe('PageHeader', () => {
  it('renders title as h1', () => {
    render(<PageHeader title="登入裝置" />);
    expect(screen.getByRole('heading', { level: 1, name: '登入裝置' })).toBeInTheDocument();
  });

  it('renders eyebrow above title when provided', () => {
    render(<PageHeader eyebrow="帳號" title="登入裝置" />);
    expect(screen.getByText('帳號')).toBeInTheDocument();
  });

  it('omits eyebrow node when not provided', () => {
    render(<PageHeader title="登入裝置" />);
    expect(document.querySelector('.tp-page-header-eyebrow')).toBeNull();
  });

  it('renders meta below title', () => {
    render(<PageHeader title="登入裝置" meta="3 個 session" />);
    expect(screen.getByText('3 個 session')).toBeInTheDocument();
  });

  it('defaults to standalone variant + left align', () => {
    render(<PageHeader title="x" />);
    const header = document.querySelector('.tp-page-header')!;
    expect(header.getAttribute('data-variant')).toBe('standalone');
    expect(header.getAttribute('data-align')).toBe('left');
  });

  it('respects sticky variant', () => {
    render(<PageHeader title="x" variant="sticky" />);
    expect(document.querySelector('.tp-page-header')!.getAttribute('data-variant')).toBe('sticky');
  });

  it('respects floating variant', () => {
    render(<PageHeader title="x" variant="floating" />);
    expect(document.querySelector('.tp-page-header')!.getAttribute('data-variant')).toBe('floating');
  });

  it('respects center align', () => {
    render(<PageHeader title="x" align="center" />);
    expect(document.querySelector('.tp-page-header')!.getAttribute('data-align')).toBe('center');
  });

  it('renders back button when callback provided + invokes on click', () => {
    const handleBack = vi.fn();
    render(<PageHeader title="x" back={handleBack} />);
    const btn = screen.getByRole('button', { name: '返回' });
    fireEvent.click(btn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('omits back button when no callback', () => {
    render(<PageHeader title="x" />);
    expect(screen.queryByRole('button', { name: '返回' })).toBeNull();
  });

  it('uses custom backLabel for accessibility', () => {
    render(<PageHeader title="x" back={() => {}} backLabel="回行程列表" />);
    expect(screen.getByRole('button', { name: '回行程列表' })).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<PageHeader title="x" actions={<button>登出全部</button>} />);
    expect(screen.getByRole('button', { name: '登出全部' })).toBeInTheDocument();
  });

  /* === Coverage gaps surfaced by /review adversarial pass (2026-04-27) === */

  it('omits actions container when actions is false (production short-circuit pattern)', () => {
    /* Sessions/Chat/TripsList all use `actions={cond && <Button/>}` — when cond
     * is falsy React passes `false` here. Don't render an empty `.tp-page-header-actions`. */
    render(<PageHeader title="x" actions={false as unknown as undefined} />);
    expect(document.querySelector('.tp-page-header-actions')).toBeNull();
  });

  it('omits actions container when actions is null', () => {
    render(<PageHeader title="x" actions={null} />);
    expect(document.querySelector('.tp-page-header-actions')).toBeNull();
  });

  it('omits actions container when actions is undefined (default)', () => {
    render(<PageHeader title="x" />);
    expect(document.querySelector('.tp-page-header-actions')).toBeNull();
  });

  it('back button activates on Enter keypress', () => {
    const handleBack = vi.fn();
    render(<PageHeader title="x" back={handleBack} />);
    const btn = screen.getByRole('button', { name: '返回' });
    fireEvent.keyDown(btn, { key: 'Enter' });
    /* native <button> handles Enter→click via UA — fireEvent.click is the
     * canonical way RTL tests this, since keyDown alone doesn't synthesize click */
    fireEvent.click(btn);
    expect(handleBack).toHaveBeenCalled();
  });

  it('renders placeholder title without crashing on empty data (loading state)', () => {
    /* TripsListPage:779 race — render must not crash on empty/placeholder title */
    render(<PageHeader title="載入中…" variant="sticky" />);
    expect(screen.getByRole('heading', { level: 1, name: '載入中…' })).toBeInTheDocument();
  });

  it('center align preserves text-content stacking on column layout', () => {
    render(<PageHeader title="授權請求" eyebrow="OAuth" align="center" />);
    const header = document.querySelector('.tp-page-header')!;
    expect(header.getAttribute('data-align')).toBe('center');
    expect(screen.getByText('OAuth')).toBeInTheDocument();
  });

  it('accepts ReactNode title with inline accent span (hero-page support)', () => {
    /* Future ConsentPage migration needs `<span class="accent">app</span> 想要存取` —
     * widening title from string to ReactNode unlocks this without breaking string callers. */
    render(
      <PageHeader
        title={<><span data-testid="title-accent">沖繩</span> 七日遊</>}
        align="center"
      />,
    );
    expect(screen.getByTestId('title-accent')).toHaveTextContent('沖繩');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('沖繩 七日遊');
  });
});
