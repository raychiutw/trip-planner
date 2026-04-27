/**
 * IdeasTabContent — TripSheet Ideas tab real UI 測試（B-P5 / B-P6 task 4.1）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IdeasTabContent from '../../src/components/trip/IdeasTabContent';

vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: vi.fn(),
}));

import { apiFetchRaw } from '../../src/lib/apiClient';
const apiMock = vi.mocked(apiFetchRaw);

const SAMPLE_IDEA = {
  id: 1,
  tripId: 'test-trip',
  poiId: 100,
  title: '美麗海水族館',
  poiAddress: '沖繩縣國頭郡',
  poiType: 'sight',
  addedAt: '2026-04-25',
  promotedToEntryId: null,
  archivedAt: null,
};

const PROMOTED_IDEA = { ...SAMPLE_IDEA, id: 2, title: '已排入', promotedToEntryId: 999 };

function mockGet(ideas: typeof SAMPLE_IDEA[]) {
  apiMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ ideas }),
  } as Response);
}

beforeEach(() => {
  apiMock.mockReset();
});

describe('IdeasTabContent', () => {
  it('initial render shows loading state', () => {
    apiMock.mockImplementation(() => new Promise(() => {})); // never resolve
    render(<IdeasTabContent tripId="test-trip" />);
    expect(screen.getByTestId('ideas-loading')).toBeTruthy();
  });

  it('empty fetch shows 「還沒收藏任何想法」 empty state', async () => {
    mockGet([]);
    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => expect(screen.getByTestId('ideas-empty')).toBeTruthy());
    expect(screen.getByText('還沒收藏任何想法')).toBeTruthy();
  });

  it('non-empty fetch renders idea cards', async () => {
    mockGet([SAMPLE_IDEA]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => expect(screen.getByTestId('ideas-list')).toBeTruthy());
    expect(screen.getByText('美麗海水族館')).toBeTruthy();
    expect(screen.getByText('sight')).toBeTruthy();
  });

  it('promote button POST entries + PATCH idea promotedToEntryId', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 555 }),
    } as Response); // POST entry
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response); // PATCH idea
    apiMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ideas: [{ ...SAMPLE_IDEA, promotedToEntryId: 555 }] }),
    } as Response); // reload

    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => screen.getByTestId('ideas-promote-1-day-1'));
    fireEvent.click(screen.getByTestId('ideas-promote-1-day-1'));

    await waitFor(() => {
      const calls = apiMock.mock.calls.map((c) => c[0]);
      expect(calls).toContain('/api/trips/test-trip/days/1/entries');
      expect(calls).toContain('/api/trip-ideas/1');
    });
  });

  it('delete button calls DELETE then reload', async () => {
    mockGet([SAMPLE_IDEA]);
    apiMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) } as Response); // DELETE
    apiMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ideas: [] }) } as Response); // reload

    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => screen.getByTestId('ideas-delete-1'));
    fireEvent.click(screen.getByTestId('ideas-delete-1'));

    await waitFor(() => {
      const lastCall = apiMock.mock.calls.find((c) => c[0] === '/api/trip-ideas/1');
      expect(lastCall?.[1]?.method).toBe('DELETE');
    });
  });

  it('promoted idea shows 「已排入 entry #N」 instead of action buttons', async () => {
    mockGet([PROMOTED_IDEA]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1]} />);
    await waitFor(() => screen.getByText(/已排入 entry #999/));
    // 不該有 promote button
    expect(screen.queryByTestId('ideas-promote-2-day-1')).toBeNull();
  });

  it('fetch error renders error banner', async () => {
    apiMock.mockRejectedValueOnce(new Error('Network down'));
    render(<IdeasTabContent tripId="test-trip" />);
    await waitFor(() => expect(screen.getByTestId('ideas-error')).toBeTruthy());
    expect(screen.getByText(/Network down/)).toBeTruthy();
  });

  it('idea without poiId shows 「需先綁 POI」 hint, no promote buttons', async () => {
    mockGet([{ ...SAMPLE_IDEA, poiId: null, title: '自由文字 idea' }]);
    render(<IdeasTabContent tripId="test-trip" dayNumbers={[1, 2]} />);
    await waitFor(() => screen.getByText('自由文字 idea'));
    expect(screen.getByText(/需先綁 POI 才能 promote/)).toBeTruthy();
    expect(screen.queryByTestId('ideas-promote-1-day-1')).toBeNull();
  });
});
