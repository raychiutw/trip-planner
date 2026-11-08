/**
 * typedApi 的編譯期守衛（#1481）：只被 `npm run typecheck` 檢查，不執行、不進 bundle。
 * 每個 `@ts-expect-error` 都是「頁面這樣寫必須編譯失敗」；哪天不再報錯（契約或 client 型別鬆掉）就會出 TS2578 讓 typecheck 轉紅。
 * 契約改了路徑／欄位，頁面裡的 typedApi 呼叫會在編譯期就報錯，不必等 e2e。
 */
import { typedApi, typedApiRaw, unwrap } from './typed';

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

  // ---- typedApiRaw：型別與 typedApi 同一套，同樣的錯用都必須編譯失敗 ----
  const raw = await typedApiRaw.get('/api/account/ai-authorization');
  if (raw.ok) {
    const rawAuthorized: boolean = raw.data.authorized;
    void rawAuthorized;
  }
  await typedApiRaw.post('/api/poi-favorites', { body: { poiId: 1 } });
  await typedApiRaw.post('/api/trips/import', { rawBody: '{"schemaVersion":1}' });
  // @ts-expect-error 路徑不在契約
  await typedApiRaw.get('/api/no-such-path');
  // @ts-expect-error 該路徑沒有 PUT
  await typedApiRaw.put('/api/poi-favorites', { body: { poiId: 1 } });
  // @ts-expect-error 缺必填 body 欄位 poiId
  await typedApiRaw.post('/api/poi-favorites', { body: {} });
  // @ts-expect-error body 欄位型別不符（poiId 必須是 number）
  await typedApiRaw.post('/api/poi-favorites', { body: { poiId: 'x' } });
  // @ts-expect-error 缺 path 參數 id
  await typedApiRaw.get('/api/trips/{id}/days');
  // @ts-expect-error 回應型別來自契約：authorized 是 boolean，不是 string
  if (raw.ok) { const wrongRaw: string = raw.data.authorized; void wrongRaw; }
  // @ts-expect-error status 是契約狀態碼的聯集：200 之外的 data 不能直接取（未縮窄 ok）
  void raw.data;

  // ---- rawBody：必須是契約有 JSON requestBody 的端點，且不能與 body 並用 ----
  // @ts-expect-error 該端點契約沒有 requestBody
  await typedApiRaw.get('/api/account/ai-authorization', { rawBody: '{}' });
  // @ts-expect-error body 與 rawBody 不能並用
  await typedApiRaw.post('/api/poi-favorites', { body: { poiId: 1 }, rawBody: '{"poiId":1}' });
  // @ts-expect-error rawBody 必須是字串
  await typedApiRaw.post('/api/trips/import', { rawBody: { schemaVersion: 1 } });
  // 正向對照：body 與 rawBody 各自單獨用都合法（上面「不能並用」的錯誤只能來自並用本身）
  await typedApiRaw.post('/api/poi-favorites', { rawBody: '{"poiId":1}' });
  // @ts-expect-error 必填 body 的端點不能兩者都不給
  await typedApiRaw.post('/api/trips/import');
}
