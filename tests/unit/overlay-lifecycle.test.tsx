import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useSheetBehavior } from '../../src/hooks/useSheetBehavior';
import ConfirmModal from '../../src/components/shared/ConfirmModal';

afterEach(cleanup);
function Panel({ modal = true, empty = false }: { modal?: boolean; empty?: boolean }) {
  const { panelRef, handlePanelKeyDown } = useSheetBehavior(true, () => {}, { modal });
  return <div ref={panelRef} onKeyDown={handlePanelKeyDown} data-testid="panel">
    {!empty && <><button>First</button><button>Last</button><button hidden>Hidden</button></>}
  </div>;
}
it('nonmodal panels leave native Tab navigation and background interaction available', () => {
  render(<><button data-testid="background">Background</button><Panel modal={false} /></>);
  screen.getByText('First').focus();
  expect(fireEvent.keyDown(screen.getByText('First'), { key: 'Tab', shiftKey: true })).toBe(true);
  expect(screen.getByTestId('background').closest('[inert]')).toBeNull();
});
it('modal traversal ignores hidden controls and retains focus when all controls disappear', async () => {
  const { rerender } = render(<Panel />);
  await waitFor(() => expect(screen.getByTestId('panel')).toHaveFocus());
  screen.getByText('First').focus(); fireEvent.keyDown(screen.getByText('First'), { key: 'Tab', shiftKey: true });
  expect(screen.getByText('Last')).toHaveFocus();
  rerender(<Panel empty />);
  fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Tab' });
  expect(screen.getByTestId('panel')).toHaveFocus();
});
it('nested real dialogs isolate background, retain busy focus, then restore each opener', async () => {
  function Flow() {
    const [outer, setOuter] = useState(false), [inner, setInner] = useState(false), [busy, setBusy] = useState(false);
    return <><button onClick={() => setOuter(true)}>Open</button>
      <ConfirmModal open={outer} title="Outer" message="Outer message" onCancel={() => setOuter(false)} onConfirm={() => {}}>
        <button onClick={() => setInner(true)}>Nested</button>
      </ConfirmModal>
      <ConfirmModal open={inner} title="Inner" message="Inner message" busy={busy} onCancel={() => setInner(false)} onConfirm={() => setBusy(true)} />
    </>;
  }
  render(<Flow />);
  const opener = screen.getByText('Open'); opener.focus(); fireEvent.click(opener);
  await waitFor(() => expect(opener.closest('[inert]')).not.toBeNull());
  const nested = screen.getByText('Nested'); nested.focus(); fireEvent.click(nested);
  await waitFor(() => expect(nested.closest('[inert]')).not.toBeNull());
  expect(screen.getByRole('alertdialog', { name: 'Inner' })).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(nested).toHaveFocus());
  expect(opener.closest('[inert]')).not.toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(opener).toHaveFocus());
  expect(opener.closest('[inert]')).toBeNull();
});
it('busy real dialog with no enabled actions traps Tab on its focusable panel', async () => {
  const cancel = vi.fn();
  render(<ConfirmModal open busy title="Busy" message="Wait" onCancel={cancel} onConfirm={() => {}} />);
  const dialog = screen.getByRole('alertdialog');
  await waitFor(() => expect(dialog).toHaveFocus());
  expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(cancel).not.toHaveBeenCalled();
});

it('isolates newly mounted background content and restores pre-existing inert state on unmount', async () => {
  const alreadyInert = document.createElement('div'); alreadyInert.setAttribute('inert', ''); document.body.append(alreadyInert);
  const { unmount } = render(<Panel />);
  const late = document.createElement('button'); document.body.append(late);
  try {
    await waitFor(() => expect(late).toHaveAttribute('inert'));
    unmount();
    expect(late).not.toHaveAttribute('inert');
    expect(alreadyInert).toHaveAttribute('inert');
  } finally { late.remove(); alreadyInert.remove(); }
});
