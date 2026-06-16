/**
 * renderPage — wrap any component with usual provider stack for unit test.
 *
 * v2.33.70 round 20: 17 個 test 各自 inline `MemoryRouter` + provider wrap，
 * 集中於此 helper 防 add new provider 時逐檔同步遺漏。
 *
 * 使用方式:
 *
 *   import { renderPage } from '../__helpers__/renderPage';
 *
 *   const { getByText } = renderPage(<MyPage />, {
 *     route: '/trip/abc',
 *     authData: makeAuthData({ email: 'owner@test.com' }),
 *   });
 *
 * Customize providers via `options.wrap` for special cases。
 */
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NewTripProvider } from '../../../src/contexts/NewTripContext';
import { ActiveTripProvider } from '../../../src/contexts/ActiveTripContext';
import type { ReactNode } from 'react';

export interface RenderPageOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route — default '/' */
  route?: string;
  /** Custom additional wrap around the standard provider stack */
  wrap?: (children: ReactNode) => ReactNode;
}

export function renderPage(
  ui: ReactNode,
  options: RenderPageOptions = {},
): RenderResult {
  const { route = '/', wrap, ...rest } = options;
  const wrapper = ({ children }: { children: ReactNode }) => {
    const content = (
      <MemoryRouter initialEntries={[route]}>
        <ActiveTripProvider>
          <NewTripProvider>
            {children}
          </NewTripProvider>
        </ActiveTripProvider>
      </MemoryRouter>
    );
    return wrap ? (<>{wrap(content)}</>) : content;
  };
  return render(ui as React.ReactElement, { ...rest, wrapper });
}
