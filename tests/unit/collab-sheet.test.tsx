/**
 * CollabSheet — V2-P7 PR-O 共編 sheet smoke tests.
 *
 * 驗證：
 *   - tripId 為空 → 顯示「請先選擇行程」 placeholder
 *   - tripId 有值 → load + render 已授權成員 list（mock /api/permissions GET）
 *   - 新增 email POST 成功 → showToast 成功訊息 + 重新 load
 *   - 移除 perm DELETE 成功 → showToast 成功訊息 + 重新 load
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CollabSheet from '../../src/components/trip/CollabSheet';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: GET /api/permissions returns one row
  mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/permissions') && (!opts || opts.method === undefined || opts.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 1, email: 'collab@example.com', trip_id: 'trip-1', role: 'member' },
        ]),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  // confirm() returns true so handleRemove proceeds
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('CollabSheet — empty tripId', () => {
  it('shows placeholder when tripId is empty', () => {
    render(<CollabSheet tripId="" />);
    expect(screen.getByText('請先選擇行程')).toBeTruthy();
  });
});

describe('CollabSheet — populated', () => {
  it('renders existing perm rows after load', async () => {
    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('collab@example.com')).toBeTruthy());
    expect(screen.getByTestId('collab-row-1')).toBeTruthy();
  });

  it('add button POSTs to /api/permissions then reloads list', async () => {
    let postCount = 0;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/permissions') && opts?.method === 'POST') {
        postCount += 1;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 2, email: 'new@example.com', trip_id: 'trip-1', role: 'member' }),
        });
      }
      // GET returns empty initially, then includes the new entry on reload
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => (postCount === 0 ? [] : [
          { id: 2, email: 'new@example.com', trip_id: 'trip-1', role: 'member' },
        ]),
      });
    });

    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText(/尚未授權任何成員/)).toBeTruthy());
    fireEvent.change(screen.getByTestId('collab-add-email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByTestId('collab-add-submit'));
    await waitFor(() => expect(postCount).toBe(1));
    await waitFor(() => expect(screen.getByText('new@example.com')).toBeTruthy());
  });
});

describe('CollabSheet — pending invitations (V2 共編)', () => {
  it('renders pending section with invitedEmail + days remaining + revoke button', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/invitations?tripId=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'hash-abc',
                invitedEmail: 'pending@example.com',
                createdAt: '2026-04-26T10:00:00Z',
                expiresAt: '2026-05-03T10:00:00Z',
                daysRemaining: 6,
                isExpired: false,
              },
            ],
          }),
        });
      }
      // permissions returns one member
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ([
          { id: 1, email: 'member@example.com', trip_id: 'trip-1', role: 'member' },
        ]),
      });
    });

    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => screen.getByTestId('collab-pending-section'));
    expect(screen.getByText('pending@example.com')).toBeTruthy();
    expect(screen.getByText(/剩 6 天/)).toBeTruthy();
    expect(screen.getByTestId('pending-revoke-pending@example.com')).toBeTruthy();
  });

  it('expired invitation shows 已過期 badge', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/invitations?tripId=')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'hash-old',
                invitedEmail: 'expired@example.com',
                createdAt: '2026-04-10T10:00:00Z',
                expiresAt: '2026-04-17T10:00:00Z',
                daysRemaining: 0,
                isExpired: true,
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ([]) });
    });

    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => screen.getByTestId('collab-pending-section'));
    expect(screen.getByText('已過期')).toBeTruthy();
  });

  it('revoke button POSTs to /invitations/revoke + reloads', async () => {
    let revokeCount = 0;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/invitations/revoke') && opts?.method === 'POST') {
        revokeCount += 1;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, revoked: 1 }) });
      }
      if (typeof url === 'string' && url.includes('/invitations?tripId=')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({
            items: revokeCount === 0
              ? [{ id: 'h', invitedEmail: 'p@x.com', createdAt: '', expiresAt: '', daysRemaining: 5, isExpired: false }]
              : [],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ([]) });
    });

    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => screen.getByTestId('pending-revoke-p@x.com'));
    fireEvent.click(screen.getByTestId('pending-revoke-p@x.com'));
    await waitFor(() => expect(revokeCount).toBe(1));
    // Verify body has tripId + email
    const revokeCall = mockFetch.mock.calls.find(
      ([u, o]) => typeof u === 'string' && (u as string).includes('/invitations/revoke') && (o as RequestInit | undefined)?.method === 'POST',
    );
    expect(revokeCall).toBeTruthy();
    const body = JSON.parse((revokeCall![1] as RequestInit).body as string) as { tripId: string; email: string };
    expect(body.tripId).toBe('trip-1');
    expect(body.email).toBe('p@x.com');
  });

  it('does NOT render pending section when no pending invitations', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/invitations?tripId=')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ([]) });
    });

    render(<CollabSheet tripId="trip-1" />);
    await waitFor(() => expect(screen.queryByText(/尚未授權任何成員/)).toBeTruthy());
    expect(screen.queryByTestId('collab-pending-section')).toBeNull();
  });
});
