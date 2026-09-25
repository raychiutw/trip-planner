import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePoiFavorites } from '../../src/hooks/usePoiFavorites';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([false, true])('離開後舊收藏請求不覆寫新來源（失敗=%s）', async (fail) => {
  const pending: Array<(response: Response) => void> = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => pending.push(resolve))));
  const {result, rerender, unmount} = renderHook(enabled => usePoiFavorites(enabled), {initialProps: true});
  expect(result.current.status).toBe('loading');
  rerender(false);
  expect(result.current.status).toBe('idle');
  rerender(true);
  await act(async () => pending[1](new Response(JSON.stringify([{id: 2, poiName: '目前收藏'}]))));
  await waitFor(() => expect(result.current.status).toBe('success'));
  await act(async () => pending[0](new Response(JSON.stringify([{id: 1, poiName: '舊收藏'}]), {status: fail ? 503 : 200})));
  expect(result.current.favorites).toEqual([{id: 2, poiName: '目前收藏'}]);
  expect(result.current.error).toBeNull();
  act(() => result.current.retry());
  unmount();
  await act(async () => pending[2](new Response('[]')));
});
