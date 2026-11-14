/** 整合分支 code-review 修正：fail-closed 預設權限、不渲染隱藏的 trigger（只 import 既有模組，紅燈是行為而非缺檔）。 */
import { describe, it, expect } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { useCanEditEntries } from '../../src/contexts/EntryEditAccessContext';
import { RailRowMenu } from '../../src/components/trip/RailRowMenu';
import TripCardMenu from '../../src/components/trip/TripCardMenu';

describe('EntryEditAccessContext', () => {
  it('沒有 Provider 時 fail-closed', () => {
    expect(renderHook(() => useCanEditEntries()).result.current).toBe(false);
  });
});

describe('選單 trigger', () => {
  it('RailRowMenu hideTrigger 不渲染 trigger 按鈕', () => {
    const { container } = render(<RailRowMenu menuId="m1" label="x" items={[]} hideTrigger />);
    expect(container.querySelector('[popovertarget], button[aria-haspopup]')).toBeNull();
  });
  it('TripCardMenu hideTrigger 不渲染 trigger 按鈕', () => {
    const { queryByTestId } = render(
      <TripCardMenu tripId="t" onCollab={() => {}} onEdit={() => {}} onHealthCheck={() => {}} hideTrigger />,
    );
    expect(queryByTestId('trip-card-menu-trigger-t')).toBeNull();
  });
});

