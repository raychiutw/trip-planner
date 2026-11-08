/**
 * 頁面用的 typed client（#1481）：路徑、path／query／body、回應型別都從 contracts/openapi.json 推導，
 * 傳輸與錯誤語意則**原封沿用 `apiFetch`**（新 api 的 DPoP token）；
 * 非 2xx 丟 `ApiError`（含 `Retry-After`）、429／邊緣擋頁的重試、SYS_* 上報 Sentry、204 無 body 都照舊。
 *
 * 所以從 `apiFetch<T>(...)` 換成 `typedApi` 不改變任何使用者看得到的行為，只多了編譯期的契約檢查
 * （打錯路徑、少欄位、body 型別不符都會編譯失敗）。因為非 2xx 一律丟例外，實際上不會走到 `ok:false` 分支；
 * 用 `unwrap` 取 data（型別收斂成成功回應）。
 *
 * 與 `createApiWithAuth`（SSE ticket 專用，直接走 auth client、不經 apiFetch）不同：那條不重試、不轉 ApiError。
 */
import { apiFetch } from '../apiClient';
import { createApi, type Api, type ApiResult } from './client';

export const typedApi: Api = createApi({
  fetch: async (input, init) => {
    // apiFetch 以物件展開 header，Headers 實例要先攤平（鍵會變小寫）；Content-Type 還原成 apiFetch 認得的大小寫，
    // 否則它會再補一份，且 DELETE 不會補（帶 body 的 DELETE 要靠這裡帶過去）
    const headers = Object.fromEntries([...new Headers(init?.headers)].map(([k, v]) => [k === 'content-type' ? 'Content-Type' : k, v]));
    // redirect:'manual' 是通用 client 的預設，apiFetch 本來就沒設（跟隨導向）：這裡拿掉，行為與遷移前一致；
    // 沒有 header／signal 時也不帶空值，讓傳給 apiFetch 的參數與手寫呼叫同形
    const { redirect: _redirect, headers: _headers, signal, ...rest } = init ?? {};
    const data = await apiFetch<unknown>(input.replace(/^\/api/, ''), {
      ...rest,
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(signal ? { signal } : {}),
    });
    // 成功一律合成 200／204：呼叫端靠 data 判斷，不依賴確切的 2xx 狀態碼
    return data === undefined
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});

/** 取成功回應的 data。非 2xx 在 `typedApi` 內已丟 `ApiError`，這裡的 throw 只是讓型別收斂。 */
export function unwrap<R extends { ok: boolean }>(result: R): Extract<R, { ok: true }> extends { data: infer D } ? D : never {
  if (!result.ok) throw new Error('typedApi 非 2xx 應已丟 ApiError');
  return (result as unknown as { data: never }).data;
}

export type { ApiResult };
