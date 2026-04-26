/**
 * NewTripModal — V2 split-hero polish tests.
 *
 * Covers the v2.7 enhancement (PR1) + PR-M cleanup:
 *   - Split-screen hero pane (left illustration only — social proof banner
 *     removed in PR-M as fake-stat anti-slop + mobile cramping fix)
 *   - Flexible-dates mode upgrade: numeric stepper + month carousel
 *     (replaces 「先建空行程，之後再決定」 hint)
 *   - Existing fixed-date submit still works (regression guard)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewTripModal from '../../src/components/trip/NewTripModal';

function renderModal(overrides: Partial<React.ComponentProps<typeof NewTripModal>> = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const utils = render(
    <NewTripModal
      open
      ownerEmail="u@example.com"
      onClose={onClose}
      onCreated={onCreated}
      {...overrides}
    />,
  );
  return { ...utils, onClose, onCreated };
}

beforeEach(() => {
  // Only fake Date so month carousel queries are deterministic; leave
  // setTimeout real so testing-library's waitFor() polls correctly.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-04-26T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('NewTripModal — V2 split-hero pane', () => {
  it('renders hero pane with eyebrow + headline copy', () => {
    renderModal();
    const hero = screen.getByTestId('new-trip-hero');
    expect(hero).toBeTruthy();
    expect(hero.textContent).toMatch(/規劃下一/);
  });

  it('hero pane no longer renders social proof banner (PR-M cleanup)', () => {
    renderModal();
    expect(screen.queryByTestId('new-trip-social-proof')).toBeNull();
  });
});

describe('NewTripModal — flexible-dates upgrade', () => {
  it('shows numeric stepper when flexible mode active', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    expect(screen.getByTestId('new-trip-flex-stepper')).toBeTruthy();
    expect(screen.getByTestId('new-trip-flex-days').textContent).toBe('5'); // default
  });

  it('+ button increments day count', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    fireEvent.click(screen.getByTestId('new-trip-flex-day-plus'));
    expect(screen.getByTestId('new-trip-flex-days').textContent).toBe('6');
  });

  it('− button decrements day count, clamped to min 1', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    const minus = screen.getByTestId('new-trip-flex-day-minus');
    // From default 5, click 10 times: should clamp at 1
    for (let i = 0; i < 10; i += 1) fireEvent.click(minus);
    expect(screen.getByTestId('new-trip-flex-days').textContent).toBe('1');
  });

  it('+ button clamps at max 30 days', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    const plus = screen.getByTestId('new-trip-flex-day-plus');
    for (let i = 0; i < 50; i += 1) fireEvent.click(plus);
    expect(screen.getByTestId('new-trip-flex-days').textContent).toBe('30');
  });

  it('shows 6 month chips starting from current month', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    const months = screen.getByTestId('new-trip-flex-months');
    expect(months).toBeTruthy();
    // Current month is 2026-04 (April)
    expect(screen.getByTestId('new-trip-flex-month-2026-04')).toBeTruthy();
    expect(screen.getByTestId('new-trip-flex-month-2026-05')).toBeTruthy();
    expect(screen.getByTestId('new-trip-flex-month-2026-09')).toBeTruthy();
  });

  it('current month chip is selected by default', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    const apr = screen.getByTestId('new-trip-flex-month-2026-04');
    expect(apr.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking another month switches selection', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    fireEvent.click(screen.getByTestId('new-trip-flex-month-2026-07'));
    expect(screen.getByTestId('new-trip-flex-month-2026-07').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('new-trip-flex-month-2026-04').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('NewTripModal — flexible submit uses month + days', () => {
  it('submits with month-1st as start and start+days as end', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tripId: 'okinawa-abc1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onCreated } = renderModal();
    fireEvent.change(screen.getByTestId('new-trip-destination-input'), {
      target: { value: '沖繩' },
    });
    fireEvent.click(screen.getByTestId('new-trip-date-mode-flexible'));
    fireEvent.click(screen.getByTestId('new-trip-flex-day-plus')); // 5 → 6
    fireEvent.click(screen.getByTestId('new-trip-flex-month-2026-07'));
    fireEvent.click(screen.getByTestId('new-trip-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.startDate).toBe('2026-07-01');
    expect(body.endDate).toBe('2026-07-06'); // 6 calendar days inclusive: 1,2,3,4,5,6
    expect(body.countries).toBe('JP');
    expect(onCreated).toHaveBeenCalledWith('okinawa-abc1');
  });
});

describe('NewTripModal — fixed-date submit (regression)', () => {
  it('still submits with explicit start/end when in select mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tripId: 'kyoto-xyz9' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal();
    fireEvent.change(screen.getByTestId('new-trip-destination-input'), {
      target: { value: '京都' },
    });
    fireEvent.change(screen.getByTestId('new-trip-start-input'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('new-trip-end-input'), { target: { value: '2026-09-05' } });
    fireEvent.click(screen.getByTestId('new-trip-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.startDate).toBe('2026-09-01');
    expect(body.endDate).toBe('2026-09-05');
  });
});
