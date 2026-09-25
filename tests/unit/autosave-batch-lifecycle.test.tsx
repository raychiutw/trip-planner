// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../../src/hooks/useAutosave';
import { ApiError } from '../../src/lib/errors';
const network = vi.hoisted(() => ({offline: () => {}, online: () => {}}));
vi.mock('../../src/lib/networkBus', () => ({ registerNetworkCallbacks: (offline: () => void, online: () => void) => { network.offline = offline; network.online = online; return () => {}; } }));
it('retains a new edit made while OCC retry is pending', async () => {
  vi.useFakeTimers();
  let finish!: (v: Record<string, unknown>) => void;
  const retry = new Promise<Record<string, unknown>>(r => { finish = r; });
  const save = vi.fn().mockRejectedValueOnce(new ApiError('STALE_ENTRY',409)).mockReturnValueOnce(retry).mockResolvedValue({version: 4});
  const { result, unmount } = renderHook(() => useAutosave<{note:string}>({save, onStale: async () => 2}));
  try {
    act(() => result.current.patch({note:'A'}));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(save).toHaveBeenCalledTimes(2);
    act(() => result.current.patch({note:'B'}));
    await act(async () => { finish({version:3}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(save).toHaveBeenLastCalledWith({note:'B'},3);
  } finally { unmount(); vi.useRealTimers(); }
});

it('flush drains edits accepted during an in-flight batch before reporting saved', async () => {
  let finish!: (value: Record<string, unknown>) => void;
  const save = vi.fn().mockReturnValueOnce(new Promise(r => { finish = r; })).mockResolvedValue({version:3});
  const {result, unmount} = renderHook(() => useAutosave<{note:string}>({save, initialVersion:1}));
  try {
    act(() => result.current.patch({note:'A'}));
    let first!: ReturnType<typeof result.current.flush>;
    act(() => { first = result.current.flush(); });
    act(() => result.current.patch({note:'B'}));
    let outcome: unknown;
    await act(async () => {
      const second = result.current.flush();
      finish({version:2});
      outcome = await second;
      await first;
    });
    expect(save).toHaveBeenLastCalledWith({note:'B'},2);
    expect(save).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({status:'saved'});
    expect(result.current.hasPending).toBe(false);
  } finally { unmount(); }
});

it('flush reports failure and manual retry preserves the latest accepted fields', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({version:2});
  const {result,unmount} = renderHook(() => useAutosave<{note:string; title:string}>({save}));
  try {
    act(() => result.current.patch({note:'A',title:'Trip'}));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.flush(); });
    expect(outcome).toEqual({status:'error',error:'unavailable'});
    expect(result.current.hasPending).toBe(true);
    act(() => result.current.patch({note:'B'}));
    await act(async () => { outcome = await result.current.retry(); });
    expect(save).toHaveBeenLastCalledWith({note:'B',title:'Trip'},undefined);
    expect(outcome).toEqual({status:'saved'});
  } finally { unmount(); }
});

it('late completion from an old entity cannot consume the new entity batch or version', async () => {
  let finish!: (value: Record<string, unknown>) => void;
  const oldSave = vi.fn().mockReturnValue(new Promise(r => { finish = r; }));
  const newSave = vi.fn().mockResolvedValue({version:11});
  const {result,rerender,unmount} = renderHook(({key,save,version}) => useAutosave<{note:string}>({entityKey:key,save,initialVersion:version}),
    {initialProps:{key:'A',save:oldSave,version:1}});
  try {
    act(() => result.current.patch({note:'old'}));
    let first!: ReturnType<typeof result.current.flush>;
    act(() => { first = result.current.flush(); });
    rerender({key:'B',save:newSave,version:10});
    act(() => result.current.patch({note:'new'}));
    await act(async () => { finish({version:2}); await first; });
    await act(async () => { await result.current.flush(); });
    expect(oldSave).toHaveBeenCalledTimes(1);
    expect(newSave).toHaveBeenCalledWith({note:'new'},10);
    expect(result.current.hasPending).toBe(false);
  } finally { unmount(); }
});


it('offline flush retains edits and reconnect saves them once', async () => {
  const save = vi.fn().mockResolvedValue({version:2});
  const {result,unmount} = renderHook(() => useAutosave<{note:string}>({save}));
  try {
    act(() => { network.offline(); result.current.patch({note:'Offline draft'}); });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.flush(); });
    expect(outcome).toEqual({status:'offline'});
    expect(result.current.hasPending).toBe(true);
    expect(save).not.toHaveBeenCalled();
    await act(async () => { network.online(); });
    expect(save).toHaveBeenCalledExactlyOnceWith({note:'Offline draft'},undefined);
    expect(result.current.hasPending).toBe(false);
  } finally { unmount(); }
});

it('failed OCC retry keeps newer same-field edits and untouched fields for manual retry', async () => {
  let fail!: (error: Error) => void;
  const rejected = new Promise<Record<string, unknown>>((_, reject) => { fail = reject; });
  const save = vi.fn().mockRejectedValueOnce(new ApiError('STALE_ENTRY',409)).mockReturnValueOnce(rejected).mockResolvedValue({version:4});
  const {result,unmount} = renderHook(() => useAutosave<{note:string; title:string}>({save,onStale:async () => 2}));
  try {
    act(() => result.current.patch({note:'A',title:'Trip'}));
    let pending!: ReturnType<typeof result.current.flush>;
    await act(async () => { pending = result.current.flush(); await Promise.resolve(); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(2);
    act(() => result.current.patch({note:'B'}));
    await act(async () => { fail(new Error('retry unavailable')); await pending; });
    expect(result.current.hasPending).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(save).toHaveBeenLastCalledWith({note:'B',title:'Trip'},2);
  } finally { unmount(); }
});
