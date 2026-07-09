/**
 * useScrollRestoreOnBack — restores scroll to anchor element after back nav
 *
 * Critical for PR2 UX: TripPage → click stop → StopDetailPage → back
 * must return to the same timeline entry, not top of page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useScrollRestoreOnBack } from '../../src/hooks/useScrollRestoreOnBack';

function HookHost() {
  useScrollRestoreOnBack();
  return (
    <div>
      <div data-scroll-anchor="entry-7">Target entry</div>
      <div data-scroll-anchor="entry-8">Other entry</div>
    </div>
  );
}

describe('useScrollRestoreOnBack', () => {
  beforeEach(() => {
    // Mock rAF to run synchronously so useLayoutEffect can resolve inside render
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('scrolls anchor element into view when state.scrollAnchor present', () => {
    const scrollIntoView = vi.fn();
    // Patch all elements' scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];

    render(
      <MemoryRouter initialEntries={[{ pathname: '/trip/t1', state: { scrollAnchor: 'entry-7' } }]}>
        <Routes>
          <Route path="/trip/:tripId" element={<HookHost />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // v2.55.44：block:'nearest'（原 'center'）— 已在視野的 anchor 不被硬拉到中央 → 返回不移動頁面
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('does nothing when state has no scrollAnchor', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];

    render(
      <MemoryRouter initialEntries={['/trip/t1']}>
        <Routes>
          <Route path="/trip/:tripId" element={<HookHost />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing when anchor element does not exist', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];

    render(
      <MemoryRouter initialEntries={[{ pathname: '/trip/t1', state: { scrollAnchor: 'entry-999' } }]}>
        <Routes>
          <Route path="/trip/:tripId" element={<HookHost />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
