/**
 * OperationShell — rev2「6 條全接」操作頁雙形態外殼契約。
 *
 * 桌機 TripStackLayout 當 host（inStack=true）→ bare panel：只 StackPanelHeader + 內容，
 *   不 render 自己的 AppShell（中欄行程詳情由 host 保留）。‹=back、✕=closeStack。
 * 手機／無 host（inStack=false，預設）→ 整頁：AppShell + TitleBar（既有行為）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationShell from '../../src/components/shell/OperationShell';
import { SheetStackProvider } from '../../src/contexts/SheetStackContext';

// G-S1：‹ 的 depth-gated back（depth>1 → navigate(-1) pop 一層）需 spy navigate。
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// DesktopSidebarConnected（整頁模式）會打 /api/trips — mock 掉資料源。
vi.mock('../../src/hooks/useMyTrips', () => ({
  useMyTrips: () => ({ trips: [] }),
  __clearMyTripsCache: () => {},
}));
vi.mock('../../src/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { userId: 'u1', email: 'ray@example.com' } }),
}));

beforeEach(() => mockNavigate.mockClear());

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

  it('inStack=true：actions 不顯（完成鈕由 children bottom-bar 提供）、title 顯示、焦點移入面板', () => {
    const { getByTestId, queryByTestId, getByText } = renderStack(
      <OperationShell
        shellClassName="tp-op-x"
        testId="op-x-page"
        title="加入景點"
        back={() => {}}
        actions={<button data-testid="op-actions">完成</button>}
      >
        <div>面板內容</div>
      </OperationShell>,
    );
    // stack 模式不顯 TitleBar actions（submit 唯一入口是 children 內的 bottom bar）
    expect(queryByTestId('op-actions')).toBeNull();
    // title 有 render（heading 語意由 StackPanelHeader 提供）
    expect(getByText('加入景點')).toBeTruthy();
    // a11y：面板開啟時焦點移進面板容器（非停在中欄觸發鈕）
    expect(document.activeElement).toBe(getByTestId('op-x-page'));
  });

  it('inStack=true 預設（從 timeline，L2 modal）→ 只「✕」closeStack、無「‹」（mockup layer.l2 右上關閉）', () => {
    const back = vi.fn();
    const closeStack = vi.fn();
    const { getByTestId, queryByTestId } = renderStack(
      <OperationShell shellClassName="tp-op-x" title="編輯景點" back={back}>
        <div />
      </OperationShell>,
      closeStack,
    );
    // rev2 Section 01：桌機第一層只給關閉，不給回前頁
    expect(queryByTestId('stack-panel-back')).toBeNull();
    (getByTestId('stack-panel-close') as HTMLButtonElement).click();
    expect(closeStack).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it('inStack=true + depth>1（L3 push）→ 「‹」= navigate(-1) pop 一層（非跳回 trip），「✕」= closeStack', () => {
    const back = vi.fn();
    const closeStack = vi.fn();
    const { getByTestId } = render(
      <MemoryRouter initialEntries={[{ pathname: '/x', state: { opStacked: true, depth: 2 } }]}>
        <SheetStackProvider value={{ inStack: true, closeStack }}>
          <OperationShell shellClassName="tp-op-x" title="換景點" back={back}>
            <div />
          </OperationShell>
        </SheetStackProvider>
      </MemoryRouter>,
    );
    (getByTestId('stack-panel-back') as HTMLButtonElement).click();
    // G-S1：L3 的 ‹ 走 navigate(-1) 退回上一操作頁，不呼叫頁自帶 back（那會跳回 trip、跳過中間頁）
    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(back).not.toHaveBeenCalled();
    (getByTestId('stack-panel-close') as HTMLButtonElement).click();
    expect(closeStack).toHaveBeenCalledTimes(1);
  });

  it('手機 L2（depth=1，無 push）→ 「‹」= 頁自帶 explicit back（回 trip），不 navigate(-1)（冷啟不踢出 app）', () => {
    const back = vi.fn();
    const { getByTestId } = render(
      <MemoryRouter>
        <OperationShell shellClassName="tp-op-x" testId="op-x-page" title="加入景點" back={back}>
          <div />
        </OperationShell>
      </MemoryRouter>,
    );
    // 手機 inStack=false → showBack 恆真，但 depth=1 → ‹ 走 explicit back（非 navigate(-1)）
    (getByTestId('stack-panel-back') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it('inStack=false（手機全頁下鑽）→ 整頁 AppShell + 共用 StackPanelHeader（‹/✕），無 TitleBar', () => {
    // rev2「手機也做」：手機操作頁也用共用 drill-down header（.dd-top ‹/✕），非 TitleBar。
    const { getByTestId, queryByTestId, getByText } = render(
      <MemoryRouter>
        <OperationShell
          shellClassName="tp-op-x"
          testId="op-x-page"
          title="加入景點"
          back={() => {}}
          actions={<button data-testid="op-actions">完成</button>}
        >
          <div>面板內容</div>
        </OperationShell>
      </MemoryRouter>,
    );
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('stack-panel-header')).toBeTruthy();
    expect(getByText('面板內容')).toBeTruthy();
    // 手機全頁也無 TitleBar、無 titlebar action（完成由 children bottom-bar 提供）
    expect(queryByTestId('titlebar')).toBeNull();
    expect(queryByTestId('op-actions')).toBeNull();
  });
});
