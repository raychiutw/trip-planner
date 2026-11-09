/**
 * 新 api 的 typed client（薄薄包一層 fetch，沒有額外依賴）。
 *
 * 型別全部從 `src/api/schema.d.ts`（由 contracts/openapi.json 產生）推導：
 *   - 第一個參數是 `paths` 的路徑樣板字面值（打錯路徑 = 編譯錯誤；方法不存在 = 編譯錯誤）
 *   - path 參數、query、JSON body、回應型別都跟著契約走；沒有 body 的端點不能傳 body
 *   - 回傳判別聯集 `{ ok: true, status, data } | { ok: false, status, error }`
 *
 * 刻意不做的事：
 *   - **不轉換 camelCase／snake_case**：回應多為 camelCase、請求 body 多為 snake_case 是 api 的現況，型別照文件。
 *   - **不轉換錯誤**：error 依文件可能是 `ApiError`（`{error:{code,message}}`）或 OAuth 扁平錯誤（`{error,error_description}`），原樣交給呼叫端。
 *   - **不吞網路錯誤**：fetch reject 會原樣往上丟（用 auth client 時是 `AuthError`）。
 *   - 文件沒列的狀態碼（例如閘道的 502 HTML）：執行期仍回 `ok:false`＋原始內容，只是型別上看不到。
 */
import type { paths } from '../../api/schema';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** 該方法在 `paths[P]` 上真的有定義（沒定義的在產生檔裡是 `?: never`）。 */
type OpOf<P extends keyof paths, M extends Method> = NonNullable<paths[P][M]>;
export type PathsWith<M extends Method> = {
  [P in keyof paths]: [NonNullable<paths[P][M]>] extends [never] ? never : P;
}[keyof paths];

type PathParamsOf<Op> = Op extends { parameters: { path: infer X } } ? X : never;
type QueryOf<Op> = Op extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type JsonBodyOf<Op> = Op extends { requestBody?: infer RB }
  ? [NonNullable<RB>] extends [never] ? never
    : NonNullable<RB> extends { content: { 'application/json': infer B } } ? B : never
  : never;
type BodyRequired<Op> = Op extends { requestBody: { content: unknown } } ? true : false;

type PathPart<Op> = [PathParamsOf<Op>] extends [never] ? { path?: never } : { path: PathParamsOf<Op> };
type QueryPart<Op> = [QueryOf<Op>] extends [never]
  ? { query?: never }
  : {} extends QueryOf<Op> ? { query?: QueryOf<Op> } : { query: QueryOf<Op> };
/**
 * `rawBody`：呼叫端已經有 JSON 原文（例如使用者上傳的檔案內容）時原樣送出，不重新序列化；
 * 路徑、method 仍由契約檢查，Content-Type 照契約（application/json）。與 `body` 二擇一；只有契約有 JSON requestBody 的端點才能用。
 */
type BodyPart<Op> = [JsonBodyOf<Op>] extends [never]
  ? { body?: never; rawBody?: never }
  : BodyRequired<Op> extends true
    ? { body: JsonBodyOf<Op>; rawBody?: never } | { body?: never; rawBody: string }
    : { body?: JsonBodyOf<Op>; rawBody?: never } | { body?: never; rawBody?: string };

export type RequestOptions<Op> = PathPart<Op> & QueryPart<Op> & BodyPart<Op> & {
  signal?: AbortSignal;
  headers?: HeadersInit;
};

type ArgsOf<Op> = {} extends RequestOptions<Op> ? [options?: RequestOptions<Op>] : [options: RequestOptions<Op>];

type ResponseBody<R> = R extends { content: infer C }
  ? C extends { 'application/json': infer J } ? J
    : C extends { 'text/event-stream': infer T } ? T
      : unknown
  : undefined;

type Responses<Op> = Op extends { responses: infer R } ? R : never;
type StatusOf<K> = K extends number ? K : never;
type IsSuccess<S extends number> = `${S}` extends `${2 | 3}${string}` ? true : false;

/** 依文件列出的狀態碼展開成判別聯集：2xx／3xx → ok:true，其餘 → ok:false。 */
export type ApiResult<Op> = {
  [K in keyof Responses<Op> as StatusOf<K> extends never ? never : K]:
    IsSuccess<StatusOf<K>> extends true
      ? { ok: true; status: StatusOf<K>; data: ResponseBody<Responses<Op>[K]> }
      : { ok: false; status: StatusOf<K>; error: ResponseBody<Responses<Op>[K]> };
}[keyof { [K in keyof Responses<Op> as StatusOf<K> extends never ? never : K]: 0 }];

export type ApiSuccess<Op> = Extract<ApiResult<Op>, { ok: true }>;
export type ApiFailure<Op> = Extract<ApiResult<Op>, { ok: false }>;

export interface ApiOptions {
  /** 網址前綴；用 auth client 的 apiFetch 時留空字串（apiFetch 自己解析 apiBase）。 */
  baseUrl?: string;
  /** 注入點：T18 的 `authClient.apiFetch` 可以直接接上。 */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** true：結果多帶 `headers`（原始回應標頭，例如 429 的 `Retry-After`）。預設不帶，結果形狀不變。 */
  includeHeaders?: boolean;
}

/** `X` 是每個結果額外帶的欄位（預設沒有；`includeHeaders` 時是 `{ headers: Headers }`）。 */
type Caller<M extends Method, X> = <P extends PathsWith<M>>(path: P, ...args: ArgsOf<OpOf<P, M>>) => Promise<ApiResult<OpOf<P, M>> & X>;

export interface Api<X = unknown> {
  get: Caller<'get', X>;
  post: Caller<'post', X>;
  put: Caller<'put', X>;
  patch: Caller<'patch', X>;
  delete: Caller<'delete', X>;
}

export type ApiWithHeaders = Api<{ headers: Headers }>;

// ---- 執行期 ----

interface RuntimeOptions {
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  rawBody?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

function fillPath(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) throw new Error(`缺少 path 參數 ${name}（${template}）`);
    return encodeURIComponent(String(v));
  });
}

function buildQuery(query: Record<string, unknown> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, String(item));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function readBody(res: Response): Promise<unknown> {
  // 3xx（不跟隨）、204／205 沒有可讀的內容
  if (res.status === 204 || res.status === 205 || (res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') return undefined;
  const text = await res.text();
  if (text === '') return undefined;
  if ((res.headers.get('content-type') ?? '').toLowerCase().includes('json')) {
    try { return JSON.parse(text) as unknown; } catch { return text; }
  }
  return text;
}

export function createApi(opts: ApiOptions & { includeHeaders: true }): ApiWithHeaders;
export function createApi(opts?: ApiOptions): Api;
export function createApi(opts: ApiOptions = {}): Api | ApiWithHeaders {
  const base = (opts.baseUrl ?? '').replace(/\/+$/, '');
  const doFetch = opts.fetch ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init));

  const call = (method: Method) => async (template: string, options: RuntimeOptions = {}) => {
    const url = base + fillPath(template, options.path) + buildQuery(options.query);
    const headers = new Headers(options.headers);
    const init: RequestInit = { method: method.toUpperCase(), headers, redirect: 'manual' };
    if (options.signal) init.signal = options.signal;
    if (options.rawBody !== undefined) {
      headers.set('Content-Type', 'application/json');
      init.body = options.rawBody;
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(options.body);
    }
    const res = await doFetch(url, init);
    const data = await readBody(res);
    // 瀏覽器的 redirect:'manual' 會給 opaqueredirect（status 0）：也是「伺服器回了導向」＝成功
    const success = res.type === 'opaqueredirect' || (res.status >= 200 && res.status < 400);
    const extra = opts.includeHeaders ? { headers: res.headers } : {};
    return success
      ? { ok: true as const, status: res.status, data, ...extra }
      : { ok: false as const, status: res.status, error: data, ...extra };
  };

  return {
    get: call('get'),
    post: call('post'),
    put: call('put'),
    patch: call('patch'),
    delete: call('delete'),
  } as unknown as Api;
}
