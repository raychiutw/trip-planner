/**
 * mobile-bottom-nav-optional-clear-sheet.test.tsx — F004 TDD red test
 *
 * 驗證：不傳入 onClearSheet prop 的 MobileBottomNav 不 crash 且正常渲染 4 個 tab。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from '../../src/components/trip/MobileBottomNav';

const mockNavigate = vi.fn();
let mockPathname = '/trip/test-trip';

vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...orig,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: mockPathname,
      search: '',
      hash: '',
      state: null,
      key: 'default',
    }),
  };
});

beforeEach(() => {
  mockNavigate.mockReset();
  mockPathname = '/trip/test-trip';
});

describe('MobileBottomNav — onClearSheet optional (F004)', () => {
  it('不傳 onClearSheet 不 crash，4 個 tab 正常渲染', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/trip/test-trip']}>
          <MobileBottomNav
            tripId="test-trip"
            activeSheet={null}
            onOpenSheet={vi.fn()}
            // onClearSheet 刻意不傳
          />
        </MemoryRouter>,
      );
    }).not.toThrow();
  });

  it('不傳 onClearSheet：仍 render nav element', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip']}>
        <MobileBottomNav
          tripId="test-trip"
          activeSheet={null}
          onOpenSheet={vi.fn()}
        />
      </MemoryRouter>,
    );
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
  });

  it('不傳 onClearSheet：仍有 4 個 button', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip']}>
        <MobileBottomNav
          tripId="test-trip"
          activeSheet={null}
          onOpenSheet={vi.fn()}
        />
      </MemoryRouter>,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4);
  });

  it('不傳 onClearSheet：行程 tab 有 aria-current="page"', () => {
    mockPathname = '/trip/test-trip';
    const { container } = render(
      <MemoryRouter initialEntries={['/trip/test-trip']}>
        <MobileBottomNav
          tripId="test-trip"
          activeSheet={null}
          onOpenSheet={vi.fn()}
        />
      </MemoryRouter>,
    );
    const activeBtn = container.querySelector('[aria-current="page"]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn?.textContent).toContain('行程');
  });
});
