/**
 * use-permissions.test.tsx — v2.33.40 round 4.5 test gap fill
 *
 * usePermissions race guard via currentTripIdRef — 快速切 trip 時舊 fetch
 * 回來不應寫到新 trip 的 state。此 hook 推 CollabSheet，race bug 已在
 * v2.31.16 timeline 上過一次。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/apiClient', () => ({
  apiFetchRaw: vi.fn(),
}));

import { usePermissions } from '../../src/hooks/usePermissions';
import { apiFetchRaw } from '../../src/lib/apiClient';
import { useRef } from 'react';

const mockApiFetchRaw = vi.mocked(apiFetchRaw);

function mkRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockApiFetchRaw.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

function setupHook(initialTripId: string) {
  return renderHook(() => {
    const ref = useRef<string>(initialTripId);
    const perm = usePermissions(ref);
    return { ...perm, ref };
  });
}

describe('usePermissions', () => {
  it('happy path: loads members + invitations', async () => {
    mockApiFetchRaw
      .mockResolvedValueOnce(
        mkRes(200, [{ user_id: '1', email: 'a@b.c', role: 'member' }]),
      )
      .mockResolvedValueOnce(mkRes(200, { items: [{ id: 'tok1', invitedEmail: 'x@y.z' }] }));

    const { result } = setupHook('trip-1');
    await act(async () => {
      await result.current.loadPermissions('trip-1');
    });
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(1);
      expect(result.current.pendingInvitations).toHaveLength(1);
      expect(result.current.permLoading).toBe(false);
      expect(result.current.permError).toBe('');
    });
  });

  it('empty tripId resets state without fetching', async () => {
    const { result } = setupHook('');
    await act(async () => {
      await result.current.loadPermissions('');
    });
    expect(mockApiFetchRaw).not.toHaveBeenCalled();
    expect(result.current.permissions).toEqual([]);
  });

  it('401 → 「未登入」 error message', async () => {
    mockApiFetchRaw
      .mockResolvedValueOnce(mkRes(401, { error: 'unauth' }))
      .mockResolvedValueOnce(mkRes(401, {}));
    const { result } = setupHook('trip-1');
    await act(async () => {
      await result.current.loadPermissions('trip-1');
    });
    expect(result.current.permError).toContain('未登入');
  });

  it('403 → 「僅管理者可操作」error message', async () => {
    mockApiFetchRaw
      .mockResolvedValueOnce(mkRes(403, { error: 'forbidden' }))
      .mockResolvedValueOnce(mkRes(403, {}));
    const { result } = setupHook('trip-1');
    await act(async () => {
      await result.current.loadPermissions('trip-1');
    });
    expect(result.current.permError).toContain('管理');
  });

  it('invitations fetch fail 不擋 members render (graceful)', async () => {
    mockApiFetchRaw
      .mockResolvedValueOnce(mkRes(200, [{ user_id: '1', email: 'a@b.c', role: 'owner' }]))
      .mockRejectedValueOnce(new Error('invitations down'));
    const { result } = setupHook('trip-1');
    await act(async () => {
      await result.current.loadPermissions('trip-1');
    });
    await waitFor(() => {
      expect(result.current.permissions).toHaveLength(1);
      expect(result.current.pendingInvitations).toEqual([]);
    });
  });

  it('race guard: stale response for old trip does NOT clobber new trip state', async () => {
    // First fetch (trip-1) hangs — promise we control
    let resolveFirstPerm!: (r: Response) => void;
    const firstPermP = new Promise<Response>((r) => { resolveFirstPerm = r; });
    let resolveFirstInv!: (r: Response | null) => void;
    const firstInvP = new Promise<Response | null>((r) => { resolveFirstInv = r; });
    mockApiFetchRaw.mockImplementationOnce(() => firstPermP);
    mockApiFetchRaw.mockImplementationOnce(() => firstInvP as unknown as Promise<Response>);

    const { result } = setupHook('trip-1');
    // Kick off trip-1 load (don't await)
    act(() => { void result.current.loadPermissions('trip-1'); });

    // Switch ref to trip-2 (simulating user clicking different trip)
    act(() => { result.current.ref.current = 'trip-2'; });

    // Late response for trip-1 arrives
    await act(async () => {
      resolveFirstPerm(mkRes(200, [{ user_id: 'old', email: 'old@x.y', role: 'member' }]));
      resolveFirstInv(mkRes(200, { items: [] }));
      // flush
      await new Promise((r) => setTimeout(r, 0));
    });

    // Race guard 應該擋住 — trip-1 的 perms 不寫到 state
    expect(result.current.permissions).toEqual([]);
  });
});
