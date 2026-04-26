/**
 * TimelineRail — V3 inline expansion + click-to-edit (PR2 of v2.7).
 *
 * Reverses the 2026-04-19 navigation-to-StopDetailPage decision. Click row
 * toggles inline detail panel (description / locations / note). Click note
 * value → editable textarea with Cmd+Enter / ESC. PATCH persists; success
 * dispatches `tp-entry-updated` so TripPage triggers refetchCurrentDay.
 *
 * Accordion behavior: only one row expanded at a time per rail.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';
import { TripDaysContext } from '../../src/contexts/TripDaysContext';
import type { DayOption } from '../../src/components/trip/EntryActionPopover';

const ENTRY_A: TimelineEntryData = {
  id: 42,
  time: '11:30-14:00',
  title: '沖縄美ら海水族館',
  description: '世界第二大水族館，鎮館之寶是黑潮之海。',
  note: '提前線上買票省 ¥120。',
  googleRating: 4.6,
};

const ENTRY_B: TimelineEntryData = {
  id: 43,
  time: '15:00-16:30',
  title: '古宇利大橋',
  description: '本島最長海上橋。',
  note: null,
  googleRating: 4.5,
};

function renderRail(events: TimelineEntryData[] = [ENTRY_A, ENTRY_B], tripId = 'okinawa-2026') {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TimelineRail events={events} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimelineRail — inline expand', () => {
  it('all rows collapsed by default', () => {
    renderRail();
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
    expect(screen.queryByTestId('timeline-rail-detail-43')).toBeNull();
  });

  it('clicking row expands inline detail', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
  });

  it('expanded panel shows description + note text', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    expect(detail.textContent).toContain('世界第二大水族館');
    expect(detail.textContent).toContain('提前線上買票省 ¥120');
  });

  it('clicking same row again collapses', () => {
    renderRail();
    const row = screen.getByTestId('timeline-rail-row-42');
    fireEvent.click(row);
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
  });

  it('accordion: opening another row collapses previous', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-detail-42')).toBeTruthy();
    fireEvent.click(screen.getByTestId('timeline-rail-row-43'));
    expect(screen.queryByTestId('timeline-rail-detail-42')).toBeNull();
    expect(screen.getByTestId('timeline-rail-detail-43')).toBeTruthy();
  });

  it('aria-expanded reflects state on row button', () => {
    renderRail();
    const row = screen.getByTestId('timeline-rail-row-42');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('TimelineRail — click-to-edit note', () => {
  it('clicking note value shows editable textarea', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('提前線上買票省 ¥120。');
  });

  it('shows kbd hint + save/cancel buttons in edit mode', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const detail = screen.getByTestId('timeline-rail-detail-42');
    expect(within(detail).getByTestId('timeline-rail-note-save-42')).toBeTruthy();
    expect(within(detail).getByTestId('timeline-rail-note-cancel-42')).toBeTruthy();
    expect(detail.textContent).toMatch(/⌘.*↩/);
  });

  it('ESC cancels edit, restores original note', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '改成這個' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByTestId('timeline-rail-note-input-42')).toBeNull();
    expect(screen.getByTestId('timeline-rail-note-value-42').textContent).toContain('提前線上買票省 ¥120');
  });

  it('Cmd+Enter saves, calls PATCH with new note', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '推薦 11:00 餵食秀' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/trips/okinawa-2026/entries/42');
    expect((opts as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ note: '推薦 11:00 餵食秀' });
  });

  it('Save button click also triggers PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '改備註' } });
    fireEvent.click(screen.getByTestId('timeline-rail-note-save-42'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('successful save dispatches tp-entry-updated event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    window.addEventListener('tp-entry-updated', listener);
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-note-value-42'));
    const textarea = screen.getByTestId('timeline-rail-note-input-42') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(listener).toHaveBeenCalled());
    const evt = listener.mock.calls[0]![0] as CustomEvent<{ tripId: string; entryId: number }>;
    expect(evt.detail).toEqual({ tripId: 'okinawa-2026', entryId: 42 });
    window.removeEventListener('tp-entry-updated', listener);
  });

  it('empty note shows「+ 加備註」placeholder', () => {
    renderRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-43'));
    const placeholder = screen.getByTestId('timeline-rail-note-value-43');
    expect(placeholder.textContent).toContain('加備註');
  });
});

const DAY_OPTIONS: DayOption[] = [
  { dayNum: 1, dayId: 101, label: 'Day 1', stopCount: 2 },
  { dayNum: 2, dayId: 102, label: 'Day 2', stopCount: 0 },
  { dayNum: 3, dayId: 103, label: 'Day 3', stopCount: 1 },
];

function renderWiredRail(events = [ENTRY_A, ENTRY_B], days = DAY_OPTIONS, dayId: number | null = 101, tripId = 'okinawa-2026') {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value={tripId}>
        <TripDaysContext.Provider value={days}>
          <TimelineRail events={events} dayId={dayId} />
        </TripDaysContext.Provider>
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — ⎘/⇅ copy/move buttons (v2.10 Wave 1)', () => {
  it('expanded row shows ⎘ + ⇅ buttons when ≥2 days + dayId set', () => {
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.getByTestId('timeline-rail-copy-open-42')).toBeTruthy();
    expect(screen.getByTestId('timeline-rail-move-open-42')).toBeTruthy();
  });

  it('hides ⎘/⇅ when only 1 day available', () => {
    renderWiredRail([ENTRY_A], [DAY_OPTIONS[0]!]);
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.queryByTestId('timeline-rail-copy-open-42')).toBeNull();
  });

  it('hides ⎘/⇅ when no dayId provided', () => {
    renderWiredRail(undefined, undefined, null);
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    expect(screen.queryByTestId('timeline-rail-copy-open-42')).toBeNull();
  });

  it('clicking ⎘ opens popover with copy heading', () => {
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-copy-open-42'));
    const popover = screen.getByTestId('entry-action-popover');
    expect(popover.textContent).toContain('複製到哪一天');
  });

  it('clicking ⇅ opens popover with move heading', () => {
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-open-42'));
    const popover = screen.getByTestId('entry-action-popover');
    expect(popover.textContent).toContain('移動到哪一天');
  });

  it('confirm copy → POST /api/trips/:id/entries/:eid/copy with targetDayId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-copy-open-42'));
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/trips/okinawa-2026/entries/42/copy');
    expect((opts as RequestInit).method).toBe('POST');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ targetDayId: 102 });
  });

  it('confirm move → PATCH /api/trips/:id/entries/:eid with day_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-move-open-42'));
    fireEvent.click(screen.getByTestId('entry-action-day-3'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/trips/okinawa-2026/entries/42');
    expect((opts as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ day_id: 103 });
  });

  it('successful copy/move dispatches tp-entry-updated event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const listener = vi.fn();
    window.addEventListener('tp-entry-updated', listener);
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-copy-open-42'));
    fireEvent.click(screen.getByTestId('entry-action-day-2'));
    fireEvent.click(screen.getByTestId('entry-action-confirm'));
    await waitFor(() => expect(listener).toHaveBeenCalled());
    const evt = listener.mock.calls[0]![0] as CustomEvent<{ tripId: string; entryId: number }>;
    expect(evt.detail).toEqual({ tripId: 'okinawa-2026', entryId: 42 });
    window.removeEventListener('tp-entry-updated', listener);
  });

  it('current day option marked disabled in popover', () => {
    renderWiredRail();
    fireEvent.click(screen.getByTestId('timeline-rail-row-42'));
    fireEvent.click(screen.getByTestId('timeline-rail-copy-open-42'));
    const day1 = screen.getByTestId('entry-action-day-1');
    expect(day1.getAttribute('aria-disabled')).toBe('true');
  });
});
