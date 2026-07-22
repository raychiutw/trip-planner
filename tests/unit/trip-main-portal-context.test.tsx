/**
 * TripMainPortalContext — owner 2026-07-21 回報 #2 修復核心機制。
 *
 * push-based callback ref：host 的 placeholder <div ref={setPortalNode}> mount 時
 * React 同步呼叫這個 callback，consumer（TripPageHost）拿到 node 後 createPortal
 * 內容進去。第一版用 pull-based document.getElementById + useEffect 依
 * location.pathname 重查，playwright e2e 實測抓到 race（新 host 的 placeholder
 * 有時還沒 mount，effect 跑的當下查不到，之後也不會重查）——這個 context 就是
 * 為了徹底避開那個 race 存在的。這裡驗證最基本的契約：mount 觸發 callback、
 * unmount 觸發 callback 帶 null、沒有 Provider 時的 fallback 不噴錯。
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { TripMainPortalContext, useTripMainPortal } from '../../src/contexts/TripMainPortalContext';

function Placeholder({ mounted }: { mounted: boolean }) {
  const { setPortalNode } = useTripMainPortal();
  return mounted ? <div ref={setPortalNode} data-testid="placeholder" /> : null;
}

function Consumer({ onNodeChange }: { onNodeChange: (node: Element | null) => void }) {
  const [node, setNode] = useState<Element | null>(null);
  return (
    <TripMainPortalContext.Provider value={{ setPortalNode: (n) => { setNode(n); onNodeChange(n); } }}>
      <Placeholder mounted />
    </TripMainPortalContext.Provider>
  );
}

describe('TripMainPortalContext — push-based callback ref', () => {
  it('placeholder mount → callback 立刻收到實際 DOM node（非 null）', () => {
    const onNodeChange = vi.fn();
    render(<Consumer onNodeChange={onNodeChange} />);
    expect(onNodeChange).toHaveBeenCalled();
    const lastCall = onNodeChange.mock.calls[onNodeChange.mock.calls.length - 1];
    expect(lastCall[0]).not.toBeNull();
    expect(lastCall[0]?.getAttribute('data-testid')).toBe('placeholder');
  });

  it('placeholder unmount → callback 收到 null（host 換了 / 離開時通知）', () => {
    const onNodeChange = vi.fn();
    function Wrapper({ mounted }: { mounted: boolean }) {
      return (
        <TripMainPortalContext.Provider value={{ setPortalNode: onNodeChange }}>
          <Placeholder mounted={mounted} />
        </TripMainPortalContext.Provider>
      );
    }
    const { rerender } = render(<Wrapper mounted />);
    onNodeChange.mockClear();
    rerender(<Wrapper mounted={false} />);
    expect(onNodeChange).toHaveBeenCalled();
    expect(onNodeChange.mock.calls[0][0]).toBeNull();
  });

  it('沒有 Provider 時 useTripMainPortal() fallback 是 no-op（不噴錯，供手機/獨立頁面安全呼叫）', () => {
    function Standalone() {
      const { setPortalNode } = useTripMainPortal();
      return <div ref={setPortalNode} data-testid="standalone" />;
    }
    expect(() => render(<Standalone />)).not.toThrow();
  });
});
