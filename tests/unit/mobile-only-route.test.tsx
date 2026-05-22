/**
 * MobileOnlyRoute responsive guard — v2.31.94 custom-stop-location-picker.
 *
 * matchMedia (max-width: 1023px) matches → render children
 * matchMedia (max-width: 1023px) NOT match → <Navigate> to fallback path
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MobileOnlyRoute } from '../../src/components/MobileOnlyRoute';

function setViewportWidth(width: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const match = /max-width:\s*(\d+)px/.exec(query);
    const matches = match ? width <= Number(match[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('MobileOnlyRoute', () => {
  beforeEach(() => setViewportWidth(800));

  it('renders children when viewport ≤ 1023px (mobile)', () => {
    setViewportWidth(360);
    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route
            path="/test"
            element={
              <MobileOnlyRoute fallbackPath="/desktop-home">
                <div data-testid="mobile-content">mobile</div>
              </MobileOnlyRoute>
            }
          />
          <Route path="/desktop-home" element={<div data-testid="desktop-home">home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
  });

  it('redirects to fallbackPath when viewport ≥ 1024px (desktop)', () => {
    setViewportWidth(1280);
    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route
            path="/test"
            element={
              <MobileOnlyRoute fallbackPath="/desktop-home">
                <div data-testid="mobile-content">mobile</div>
              </MobileOnlyRoute>
            }
          />
          <Route path="/desktop-home" element={<div data-testid="desktop-home">home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('mobile-content')).toBeNull();
    expect(screen.getByTestId('desktop-home')).toBeInTheDocument();
  });

  it('exactly 1023px (boundary) renders children', () => {
    setViewportWidth(1023);
    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route
            path="/test"
            element={
              <MobileOnlyRoute fallbackPath="/desktop-home">
                <div data-testid="mobile-content">mobile</div>
              </MobileOnlyRoute>
            }
          />
          <Route path="/desktop-home" element={<div data-testid="desktop-home">home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
  });

  it('exactly 1024px → redirects', () => {
    setViewportWidth(1024);
    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route
            path="/test"
            element={
              <MobileOnlyRoute fallbackPath="/desktop-home">
                <div data-testid="mobile-content">mobile</div>
              </MobileOnlyRoute>
            }
          />
          <Route path="/desktop-home" element={<div data-testid="desktop-home">home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('desktop-home')).toBeInTheDocument();
  });
});
