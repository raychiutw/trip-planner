/**
 * EntryActionPopover — V3 ⎘ copy / ⇅ move popover (PR3 v2.9).
 *
 * Pure UI scaffolding. Confirm button is disabled with tooltip until backend
 * gains:
 *   - Copy: POST /api/trips/:id/entries/:eid/copy?targetDayId=&sortOrder=
 *   - Move: PATCH /api/trips/:id/entries/:eid 加 day_id 進 ALLOWED_FIELDS
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EntryActionPopover, { type DayOption } from '../../src/components/trip/EntryActionPopover';

const DAYS: DayOption[] = [
  { dayNum: 1, dayId: 101, label: '7/26 (六)', stopCount: 6, swatchColor: '#f43f5e' },
  { dayNum: 2, dayId: 102, label: '7/27 (日)', stopCount: 3, swatchColor: '#14b8a6' },
  { dayNum: 3, dayId: 103, label: '7/28 (一)', stopCount: 0, swatchColor: '#f59e0b' },
];

function renderPopover(action: 'copy' | 'move' = 'copy', currentDayId = 101) {
  const onClose = vi.fn();
  const utils = render(
    <EntryActionPopover
      open
      action={action}
      days={DAYS}
      currentDayId={currentDayId}
      onClose={onClose}
    />,
  );
  return { ...utils, onClose };
}

describe('EntryActionPopover — render', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <EntryActionPopover open={false} action="copy" days={DAYS} currentDayId={101} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows copy heading + day options when action=copy', () => {
    renderPopover('copy');
    expect(screen.getByTestId('entry-action-popover').textContent).toContain('複製到哪一天');
    expect(screen.getByTestId('entry-action-day-1')).toBeTruthy();
    expect(screen.getByTestId('entry-action-day-2')).toBeTruthy();
  });

  it('shows move heading when action=move', () => {
    renderPopover('move');
    expect(screen.getByTestId('entry-action-popover').textContent).toContain('移動到哪一天');
  });

  it('current day option is disabled with「目前」 marker', () => {
    renderPopover('copy', 101);
    const cur = screen.getByTestId('entry-action-day-1');
    expect(cur.getAttribute('aria-disabled')).toBe('true');
    expect(cur.textContent).toContain('目前');
  });

  it('non-current days are selectable', () => {
    renderPopover('copy', 101);
    const day2 = screen.getByTestId('entry-action-day-2');
    expect(day2.getAttribute('aria-disabled')).toBeFalsy();
    fireEvent.click(day2);
    expect(day2.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows day stop count + swatch color', () => {
    renderPopover('copy');
    const day2 = screen.getByTestId('entry-action-day-2');
    expect(day2.textContent).toContain('3');
    // jsdom serializes hex to rgb()
    expect(day2.querySelector('.tp-action-swatch')?.getAttribute('style')).toMatch(/#14b8a6|rgb\(20,\s*184,\s*166\)/);
  });

  it('shows time slot select with predefined slots', () => {
    renderPopover('copy');
    const slot = screen.getByTestId('entry-action-timeslot') as HTMLSelectElement;
    expect(slot).toBeTruthy();
    // Default option matches mockup: 同原時段、早上第一站、午後、晚餐、自訂
    expect(slot.options.length).toBeGreaterThanOrEqual(3);
  });
});

describe('EntryActionPopover — confirm disabled (v2.9 mock mode)', () => {
  it('confirm button disabled with backend-pending tooltip', () => {
    renderPopover('copy');
    const confirm = screen.getByTestId('entry-action-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute('title')).toMatch(/即將推出|backend|尚未/);
  });

  it('disabled state persists even after picking a target day', () => {
    renderPopover('copy', 101);
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    expect((screen.getByTestId('entry-action-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancel button calls onClose', () => {
    const { onClose } = renderPopover('copy');
    fireEvent.click(screen.getByTestId('entry-action-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC key calls onClose', () => {
    const { onClose } = renderPopover('copy');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('EntryActionPopover — wired mode (v2.10 Wave 1 with onConfirm)', () => {
  it('confirm button disabled until a day is picked', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <EntryActionPopover
        open
        action="copy"
        days={DAYS}
        currentDayId={101}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByTestId('entry-action-confirm') as HTMLButtonElement;
    // No day picked → still disabled
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute('title')).toMatch(/請先選擇/);
    // Pick a day
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    expect(confirm.disabled).toBe(false);
    expect(confirm.textContent).toBe('複製');
  });

  it('clicking confirm calls onConfirm with selected day + slot', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <EntryActionPopover
        open
        action="move"
        days={DAYS}
        currentDayId={101}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId('entry-action-day-3'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    // wait for async confirm to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onConfirm).toHaveBeenCalledWith({ targetDayId: 103, timeSlot: 'same' });
    expect(onClose).toHaveBeenCalled();
  });

  it('confirm shows error when onConfirm throws', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('伺服器壞了'));
    render(
      <EntryActionPopover
        open
        action="copy"
        days={DAYS}
        currentDayId={101}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('alert').textContent).toContain('伺服器壞了');
  });

  it('wired mode hides backend-pending notice', () => {
    render(
      <EntryActionPopover
        open
        action="copy"
        days={DAYS}
        currentDayId={101}
        onClose={() => {}}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId('entry-action-popover').textContent).not.toMatch(/即將推出/);
  });
});
