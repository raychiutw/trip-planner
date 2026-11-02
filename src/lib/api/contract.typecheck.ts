/**
 * 契約的編譯期守衛：這個檔只被 `npm run typecheck`（tsc）檢查，不會被執行、也不會進 bundle。
 *
 * - 「對的用法」必須通過型別檢查。
 * - 每個 `@ts-expect-error` 都是「這樣用必須是型別錯誤」；如果哪天不再報錯（契約或 client 型別鬆掉了），
 *   TS2578「Unused '@ts-expect-error' directive」會讓 typecheck 轉紅。
 * - 契約（contracts/openapi.json → src/api/schema.d.ts）改了欄位，下面讀取該欄位的地方就會報錯：這就是「契約改動在編譯期被發現」。
 */
import { createApi } from './client';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const assertType = <_T extends true>() => undefined;

export async function contractUsage(): Promise<void> {
  const api = createApi();

  // ---- 對的用法 ----
  const ticket = await api.post('/api/requests/{id}/sse-ticket', { path: { id: '1' } });
  if (ticket.ok) {
    const t: string = ticket.data.ticket;
    const n: number = ticket.data.expires_in;
    void [t, n];
  } else {
    if (ticket.status === 429 || ticket.status === 401 || ticket.status === 404) {
      const code: string = ticket.error.error.code;
      void code;
    }
  }

  const search = await api.get('/api/poi-search', { query: { q: '東京', limit: 5 } });
  void search;
  await api.get('/api/trips'); // 全部可省略
  await api.get('/api/trips', { query: { all: '1' } });
  await api.patch('/api/permissions/{id}', { path: { id: '5' }, body: { role: 'viewer' } });
  const logout = await api.post('/api/oauth/logout'); // 204：沒有 body、data 是 undefined
  if (logout.ok) assertType<Equal<typeof logout.data, undefined>>();

  // ---- 錯的用法：全部必須是型別錯誤 ----
  // @ts-expect-error 路徑不在契約裡
  await api.get('/api/no-such-path');

  // @ts-expect-error 這個路徑沒有 GET（只有 POST）
  await api.get('/api/requests/{id}/sse-ticket', { path: { id: '1' } });

  // @ts-expect-error 缺必填的 body 欄位（role）
  await api.patch('/api/permissions/{id}', { path: { id: '5' }, body: {} });

  // @ts-expect-error body 欄位型別錯誤
  await api.patch('/api/permissions/{id}', { path: { id: '5' }, body: { role: 123 } });

  // @ts-expect-error path 參數名稱錯誤（應為 id）
  await api.get('/api/requests/{id}', { path: { requestId: '1' } });

  // @ts-expect-error 缺 path 參數
  await api.get('/api/requests/{id}');

  // @ts-expect-error 缺必填的 query（q）
  await api.get('/api/poi-search', { query: { limit: 5 } });

  // @ts-expect-error query 欄位型別錯誤（limit 是 number）
  await api.get('/api/poi-search', { query: { q: 'x', limit: 'many' } });

  // @ts-expect-error 沒有 body 的端點不能傳 body
  await api.post('/api/requests/{id}/sse-ticket', { path: { id: '1' }, body: { a: 1 } });

  // @ts-expect-error 回應上不存在的欄位
  void ticket.ok && ticket.data.nope;

  // @ts-expect-error 沒先判別 ok 就讀 data
  void ticket.data;

  if (!ticket.ok && ticket.status === 404) {
    // @ts-expect-error 失敗分支沒有 data
    void ticket.data;
  }
}
