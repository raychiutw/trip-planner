/**
 * 行程層級的變更（src/lib/tripMutations.ts）：封存／取消封存、刪除行程、刪除某一天。
 *
 * 與 entryMutations 同一個慣例：呼叫 endpoint、把非 2xx 與網路例外轉成 Result（不 throw）、
 * 成功才 emit `tripUpdated`；不 toast、不導覽 —— 那是 UI 的決定。
 * 使用者看到的錯誤文字（哪個狀態碼對應哪句話）屬於這裡的行為，一併鎖住。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const apiFetchRaw = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: (...a: unknown[]) => apiFetchRaw(...a) }));

import { archiveTrip, deleteTrip, deleteDay } from '../../src/lib/tripMutations';
import { EVENT } from '../../src/lib/events';

let events: Array<{ tripId?: string }> = [];
const onUpdated = (e: Event) => { events.push((e as CustomEvent).detail); };
beforeEach(() => { apiFetchRaw.mockReset(); events = []; window.addEventListener(EVENT.tripUpdated, onUpdated); });
afterEach(() => window.removeEventListener(EVENT.tripUpdated, onUpdated));

const res = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => body,
});

describe('archiveTrip', () => {
  it('歸檔 = PUT，取消歸檔 = DELETE；成功 emit tripUpdated', async () => {
    apiFetchRaw.mockResolvedValue(res(200, {}));
    expect(await archiveTrip('t 1', false)).toEqual({ ok: true, data: undefined });
    expect(apiFetchRaw).toHaveBeenLastCalledWith('/trips/t%201/archive', { method: 'PUT' });
    await archiveTrip('t 1', true);
    expect(apiFetchRaw).toHaveBeenLastCalledWith('/trips/t%201/archive', { method: 'DELETE' });
    expect(events).toEqual([{ tripId: 't 1' }, { tripId: 't 1' }]);
  });

  it('403 → 只有擁有者能變更；其他失敗 → 通用訊息；失敗不 emit', async () => {
    apiFetchRaw.mockResolvedValueOnce(res(403, {}));
    expect(await archiveTrip('t', false)).toMatchObject({ ok: false, status: 403, message: '只有行程擁有者能變更歸檔狀態。' });
    apiFetchRaw.mockResolvedValueOnce(res(500, {}));
    expect(await archiveTrip('t', false)).toMatchObject({ ok: false, status: 500, message: '更新歸檔狀態失敗，請再試一次。' });
    expect(events).toEqual([]);
  });

  it('網路例外 → ok:false status 0，不丟錯、不 emit', async () => {
    apiFetchRaw.mockRejectedValue(new Error('offline'));
    expect(await archiveTrip('t', false)).toMatchObject({ ok: false, status: 0 });
    expect(events).toEqual([]);
  });
});

describe('deleteTrip', () => {
  it('DELETE /trips/:id；成功 emit tripUpdated', async () => {
    apiFetchRaw.mockResolvedValue(res(200, {}));
    expect(await deleteTrip('abc')).toMatchObject({ ok: true });
    expect(apiFetchRaw).toHaveBeenCalledWith('/trips/abc', { method: 'DELETE' });
    expect(events).toEqual([{ tripId: 'abc' }]);
  });

  it.each([
    [403, '僅行程擁有者或管理者可刪除'],
    [404, '行程不存在'],
    [500, '刪除失敗，請稍後再試'],
  ])('%i → %s，且不 emit', async (status, message) => {
    apiFetchRaw.mockResolvedValue(res(status, {}));
    expect(await deleteTrip('abc')).toMatchObject({ ok: false, status, message });
    expect(events).toEqual([]);
  });
});

describe('deleteDay', () => {
  it('DELETE /trips/:id/days/:n；回傳 removedEntryCount；成功 emit tripUpdated', async () => {
    apiFetchRaw.mockResolvedValue(res(200, { removedEntryCount: 3 }));
    const r = await deleteDay('abc', 2);
    expect(r).toEqual({ ok: true, data: { removedEntryCount: 3 } });
    expect(apiFetchRaw).toHaveBeenCalledWith('/trips/abc/days/2', { method: 'DELETE', credentials: 'same-origin' });
    expect(events).toEqual([{ tripId: 'abc' }]);
  });

  it('沒有 removedEntryCount 視為 0', async () => {
    apiFetchRaw.mockResolvedValue(res(200, {}));
    expect(await deleteDay('abc', 1)).toEqual({ ok: true, data: { removedEntryCount: 0 } });
  });

  it('失敗時優先用後端 error.message；非 JSON 用預設訊息；失敗不 emit', async () => {
    apiFetchRaw.mockResolvedValueOnce(res(409, { error: { message: '至少要保留一天' } }));
    expect(await deleteDay('abc', 1)).toMatchObject({ ok: false, status: 409, message: '至少要保留一天' });
    apiFetchRaw.mockResolvedValueOnce(res(500, '<html>oops</html>'));
    expect(await deleteDay('abc', 1)).toMatchObject({ ok: false, status: 500, message: '刪除天數失敗，請稍後再試。' });
    expect(events).toEqual([]);
  });
});

describe('結構：行程層級的 endpoint 只有 tripMutations 會打', () => {
  const ROOT = join(__dirname, '../..');
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  it('src/ 內其他檔案不得直接呼叫 /archive 或刪除行程／天數的 endpoint', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((p) => !p.endsWith('src/lib/tripMutations.ts'))
      .filter((p) => /\/trips\/\$\{[^}]*\}\/archive|\/trips\/\$\{[^}]*\}\/days\/\$\{[^}]*\}`,\s*\{\s*method: 'DELETE'/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});
