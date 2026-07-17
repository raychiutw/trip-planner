/**
 * OperationShell — rev2「6 條全接」操作頁雙形態外殼契約。
 *
 * 桌機 TripStackLayout 當 host（inStack=true）→ bare panel：只 StackPanelHeader + 內容，
 *   不 render 自己的 AppShell（中欄行程詳情由 host 保留）。‹=back、✕=closeStack。
 * 手機／無 host（inStack=false，預設）→ 整頁：AppShell + TitleBar（既有行為）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationShell from '../../src/components/shell/OperationShell';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';

// DesktopSidebarConnected（整頁模式）會打 /api/trips — mock 掉資料源。
vi.mock('../../src/hooks/useMyTrips', () => ({
  useMyTrips: () => ({ trips: [] }),
  __clearMyTripsCache: () => {},
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { userId: 'u1', email: 'ray@example.com' } }),
}));

function renderStack(ui: React.ReactElement, closeStack = () => {}) {
  return render(
    <MemoryRouter>
      <SheetStackProvider value={{ inStack: true, closeStack }}>{ui}</SheetStackProvider>
    </MemoryRouter>,
  );
}

describe('OperationShell — 雙形態外殼', () => {
  it('inStack=true（桌機右欄）→ StackPanelHeader + 內容，無自己的 AppShell / TitleBar', () => {
    const { getByTestId, queryByTestId, getByText } = renderStack(
      <OperationShell shellClassName="tp-op-x" testId="op-x-page" title="加入景點" back={() => {}}>
        <div>面板內容</div>
      </OperationShell>,
    );
    expect(getByTestId('stack-panel-header')).toBeTruthy();
    expect(getByTestId('op-x-page')).toBeTruthy();
    expect(getByText('面板內容')).toBeTruthy();
    // bare panel：不得有自己的 AppShell 或整頁 TitleBar（避免 host 內雙層 shell）
    expect(queryByTestId('app-shell')).toBeNull();
    expect(queryByTestId('titlebar')).toBeNull();
  });

  it('inStack=true：‹ 觸發 back、✕ 觸發 closeStack', () => {
    const back = vi.fn();
    const closeStack = vi.fn();
    const { getByTestId } = renderStack(
      <OperationShell shellClassName="tp-op-x" title="換景點" back={back}>
        <div />
      </OperationShell>,
      closeStack,
    );
    (getByTestId('stack-panel-back') as HTMLButtonElement).click();
    (getByTestId('stack-panel-close') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalledTimes(1);
    expect(closeStack).toHaveBeenCalledTimes(1);
  });

  it('inStack=false（手機／無 host）→ 整頁 AppShell + TitleBar，無 StackPanelHeader', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <MemoryRouter>
        <OperationShell shellClassName="tp-op-x" testId="op-x-page" title="加入景點" back={() => {}}>
          <div>面板內容</div>
        </OperationShell>
      </MemoryRouter>,
    );
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('titlebar')).toBeTruthy();
    expect(getByText('面板內容')).toBeTruthy();
    expect(queryByTestId('stack-panel-header')).toBeNull();
  });
});
