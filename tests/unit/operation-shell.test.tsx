/**
 * OperationShell — rev2「6 條全接」操作頁雙形態外殼契約。
 *
 * 桌機 TripStackLayout 當 host（inStack=true）→ bare panel：只 StackPanelHeader + 內容，
 *   不 render 自己的 AppShell（中欄行程詳情由 host 保留）。‹=back、✕=closeStack。
 * 手機／無 host（inStack=false，預設）→ 整頁：AppShell + TitleBar（既有行為）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationShell from '../../src/components/shell/OperationShell';
import ConfirmModal from '../../src/components/shared/ConfirmModal';
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

  it('inStack=true：title 顯示、焦點移入面板（完成鈕唯一入口是 children bottom-bar，header 無 action slot）', () => {
    const { getByTestId, getByText } = renderStack(
      <OperationShell
        shellClassName="tp-op-x"
        testId="op-x-page"
        title="加入景點"
        back={() => {}}
      >
        <div>面板內容</div>
      </OperationShell>,
    );
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
        >
          <div>面板內容</div>
        </OperationShell>
      </MemoryRouter>,
    );
    expect(getByTestId('app-shell')).toBeTruthy();
    expect(getByTestId('stack-panel-header')).toBeTruthy();
    expect(getByText('面板內容')).toBeTruthy();
    // 手機全頁也無 TitleBar（完成由 children bottom-bar 提供，header 無 action slot）
    expect(queryByTestId('titlebar')).toBeNull();
  });

  it('inStack=false + bottomNav prop（v2.57.x 共編/健檢/筆記 panel 化）→ 手機整頁沿用底部 tab', () => {
    // 這 3 頁移入 OperationShell 前手機版就有 GlobalBottomNav；既有 6 條操作路由手機版本來
    // 就沒有底部 nav（bottomNav 不傳 = undefined，行為不變）。新 optional prop 只讓有傳的頁面拿到。
    const { getByTestId } = render(
      <MemoryRouter>
        <OperationShell
          shellClassName="tp-op-x"
          testId="op-x-page"
          title="共編設定"
          back={() => {}}
          bottomNav={<div data-testid="mock-bottom-nav">nav</div>}
        >
          <div>面板內容</div>
        </OperationShell>
      </MemoryRouter>,
    );
    expect(getByTestId('app-shell-bottom-nav')).toBeTruthy();
    expect(getByTestId('mock-bottom-nav')).toBeTruthy();
  });

  it('inStack 桌機面板：Escape = 關最上層（G-S4；L2 無 ‹ → closeStack）', () => {
    const closeStack = vi.fn();
    renderStack(
      <OperationShell shellClassName="tp-op-x" testId="op-x-page" title="編輯景點" back={() => {}}>
        <div />
      </OperationShell>,
      closeStack,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeStack).toHaveBeenCalledTimes(1);
  });

  it('inStack：內層有 engine modal 開著時 Escape 不關 panel（nested guard，讓內層先處理）', () => {
    const closeStack = vi.fn();
    const onCancel = vi.fn();
    renderStack(
      <OperationShell shellClassName="tp-op-x" testId="op-x-page" title="編輯景點" back={() => {}}>
        {/* 從 panel 開的 discard ConfirmModal（走 useSheetBehavior engine，會註冊 registry） */}
        <ConfirmModal open title="捨棄？" message="x" onConfirm={() => {}} onCancel={onCancel} />
      </OperationShell>,
      closeStack,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    // panel 的 Escape 被 isAnySheetOpen() 擋下 → 不關 panel；由 ConfirmModal 自己吃 Escape
    expect(closeStack).not.toHaveBeenCalled();
  });
});
