/**
 * typedApi 的編譯期守衛（#1481）：只被 `npm run typecheck` 檢查，不執行、不進 bundle。
 * 每個 `@ts-expect-error` 都是「頁面這樣寫必須編譯失敗」；哪天不再報錯（契約或 client 型別鬆掉）就會出 TS2578 讓 typecheck 轉紅。
 * 契約改了路徑／欄位，頁面裡的 typedApi 呼叫會在編譯期就報錯，不必等 e2e。
 */
import { typedApi, unwrap } from './typed';

export async function typedApiUsage(): Promise<void> {
  // ---- 對的用法：必須通過 ----
  await typedApi.post('/api/poi-favorites', { body: { poiId: 1 } });
  const consent = unwrap(await typedApi.get('/api/account/ai-authorization'));
  const authorized: boolean = consent.authorized;
  void authorized;
  await typedApi.get('/api/trips/{id}/days', { path: { id: 't' }, query: { all: '1' } });

  // ---- 錯的用法：全部必須是型別錯誤 ----
  // @ts-expect-error 路徑不在契約
  await typedApi.get('/api/no-such-path');
  // @ts-expect-error 該路徑沒有 PUT
  await typedApi.put('/api/poi-favorites', { body: { poiId: 1 } });
  // @ts-expect-error 缺必填 body 欄位 poiId
  await typedApi.post('/api/poi-favorites', { body: {} });
  // @ts-expect-error body 欄位型別不符（poiId 必須是 number）
  await typedApi.post('/api/poi-favorites', { body: { poiId: 'x' } });
  // @ts-expect-error 缺 path 參數 id
  await typedApi.get('/api/trips/{id}/days');
  // @ts-expect-error path 參數名稱錯（契約是 id）
  await typedApi.get('/api/trips/{id}/days', { path: { tripId: 't' } });
  // @ts-expect-error 回應型別來自契約：authorized 是 boolean，不是 string
  const wrong: string = unwrap(await typedApi.get('/api/account/ai-authorization')).authorized;
  void wrong;
}
