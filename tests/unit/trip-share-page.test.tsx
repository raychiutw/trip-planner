/**
 * TripSharePage — public no-login share view (v2.39.0).
 *
 * Locks: (1) the page is PUBLIC — it must NOT call useRequireAuth; (2) it renders the
 * reused TripPrintDocument with hideHeader (Variant B hero replaces the doc header);
 * (3) a friendly not-found state on an invalid/revoked/expired token; (4) the public
 * route /s/:token is registered outside any auth guard.
 *
 * Mocks at the fetch layer (real loadSharePrintData + apiFetch + mapRawToPrintData run
 * → also exercises the share payload mapping). renderTripPrintPdf is stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import TripSharePage from '../../src/pages/TripSharePage';

vi.mock('../../src/components/print/renderTripPrintPdf', () => ({ renderTripPrintPdf: vi.fn() }));

/** Raw server payload shape (already camelCase — server json() deep-camels). */
function sharePayload(sharedBy: string) {
  return {
    meta: { name: '沖繩', title: '沖繩五日', countries: 'JP', sharedBy, destinations: [{ name: '那霸' }, { name: '美麗海' }] },
    days: [], // empty → exercises mapPrintDay path without needing a full toTimelineEntry fixture
    notes: { flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] },
  };
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
}

function renderAt(token = 'tok_abc123def456ghi789') {
  return render(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <Routes>
        <Route path="/s/:token" element={<TripSharePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripSharePage render', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('renders the share hero + reused document (hideHeader → no doc name header)', async () => {
    stubFetch(200, sharePayload('Ray'));
    renderAt();
    await waitFor(() => expect(screen.getByTestId('share-title')).toBeTruthy());
    expect(screen.getByText('由 Ray 分享給你')).toBeTruthy();
    expect(screen.getByTestId('share-title').textContent).toBe('沖繩五日');
    expect(screen.getByTestId('trip-print-document')).toBeTruthy();
    // hideHeader: the document's own name header must NOT render (hero owns the title)
    expect(screen.queryByTestId('print-doc-name')).toBeNull();
    // public actions present, no edit affordances
    expect(screen.getByTestId('share-copy')).toBeTruthy();
    expect(screen.getByTestId('share-print')).toBeTruthy();
    expect(screen.getByTestId('share-pdf')).toBeTruthy();
  });

  it('falls back to a generic eyebrow when the owner has no display name', async () => {
    stubFetch(200, sharePayload(''));
    renderAt();
    await waitFor(() => expect(screen.getByTestId('share-title')).toBeTruthy());
    expect(screen.getByText('有人分享了一份行程給你')).toBeTruthy();
  });

  it('shows a friendly not-found state for an invalid / revoked / expired token', async () => {
    stubFetch(404, { error: 'NOT_FOUND' });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('share-notfound')).toBeTruthy());
    expect(screen.queryByTestId('trip-print-document')).toBeNull();
  });
});

describe('TripSharePage is public (source contracts)', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'src/pages/TripSharePage.tsx'), 'utf8');

  it('does NOT gate behind useRequireAuth (public page)', () => {
    expect(src).not.toMatch(/useRequireAuth/);
  });

  it('reuses TripPrintDocument with hideHeader', () => {
    expect(src).toMatch(/TripPrintDocument[\s\S]*hideHeader/);
  });

  it('the /s/:token route is registered (outside auth guards) in main.tsx', () => {
    const main = readFileSync(join(__dirname, '..', '..', 'src/entries/main.tsx'), 'utf8');
    expect(main).toMatch(/path="\/s\/:token"\s+element=\{<TripSharePage/);
  });
});
