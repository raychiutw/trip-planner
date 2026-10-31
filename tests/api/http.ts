/**
 * API 的 HTTP 邊界 helper：Request 進、Response 出。
 *
 * 同一份測試可指向兩種目標：
 *   - 進程內（`env`）：依 functions/ 的檔案路由與 middleware 派送，行為和 Pages 一致；
 *   - 外部網址（`baseUrl`）：用 fetch 打出去，供對照組或新 api 使用。
 *
 * 認證走真實的 bearer token（D1 的 AccessToken 資料列），不再繞過 middleware 直接塞 auth。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from '../../functions/api/_types';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { issueSession } from '../../functions/api/_session';
import { verifySessionToken } from '../../src/server/session';
import { userIdFor } from './helpers';

type Handler = (ctx: unknown) => Response | Promise<Response>;
type Module = Record<string, Handler | undefined>;
type Route = { segments: string[]; load: () => Promise<Module> };

const METHOD_EXPORTS: Record<string, string> = {
  GET: 'onRequestGet',
  POST: 'onRequestPost',
  PUT: 'onRequestPut',
  PATCH: 'onRequestPatch',
  DELETE: 'onRequestDelete',
  HEAD: 'onRequestHead',
  OPTIONS: 'onRequestOptions',
};

// 延遲載入：只載入被請求到的路由，避免在 isolate:false 的單一 worker 裡把全部 handler 拉進共用的 module cache
// 第二個樣式涵蓋 .well-known 這類點開頭的目錄（glob 預設會略過）
const files = import.meta.glob(['../../functions/api/**/*.ts', '../../functions/api/**/.*/**/*.ts']) as Record<string, () => Promise<Module>>;

/** `../../functions/api/trips/[id]/days.ts` → ['api','trips',':id','days']；底線開頭的檔案不是路由。 */
function toSegments(file: string): string[] | null {
  const rel = file.replace('../../functions/', '').replace(/\.ts$/, '');
  const parts = rel.split('/');
  if (parts.some((p, i) => i === parts.length - 1 && p.startsWith('_'))) return null;
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts.map(p => (p.startsWith('[') && p.endsWith(']') ? `:${p.slice(1, -1)}` : p));
}

const routes: Route[] = [];
for (const [file, load] of Object.entries(files)) {
  const segments = toSegments(file);
  if (segments) routes.push({ segments, load });
}
const loadMiddleware = files['../../functions/api/_middleware.ts']!;

function matchRoute(pathname: string): { route: Route; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  let best: { route: Route; params: Record<string, string>; statics: number } | null = null;
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let statics = 0;
    const ok = route.segments.every((seg, i) => {
      if (seg.startsWith(':')) { params[seg.slice(1)] = parts[i]!; return true; }
      if (seg === parts[i]) { statics++; return true; }
      return false;
    });
    // 靜態段多者優先（Pages 的行為：具體路徑勝過動態路徑）
    if (ok && (!best || statics > best.statics)) best = { route, params, statics };
  }
  return best;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

async function dispatch(request: Request, env: Env): Promise<Response> {
  const matched = matchRoute(new URL(request.url).pathname);
  if (!matched) return jsonResponse(404, { error: { code: 'DATA_NOT_FOUND' } });

  const module = await matched.route.load();
  const method = request.method.toUpperCase();
  const handler = module[METHOD_EXPORTS[method] ?? ''] ?? module.onRequest;
  if (!handler) {
    const allow = Object.entries(METHOD_EXPORTS).filter(([, name]) => module[name]).map(([m]) => m).join(', ');
    return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED' } }, { Allow: allow });
  }

  const pending: Promise<unknown>[] = [];
  const ctx = {
    request,
    env,
    params: matched.params,
    data: {} as Record<string, unknown>,
    waitUntil: (p: Promise<unknown>) => { pending.push(p); },
    passThroughOnException: () => {},
    functionPath: new URL(request.url).pathname,
    next: () => Promise.resolve(handler(ctx)),
  };
  const middleware = (await loadMiddleware()).onRequest;
  const response = middleware ? await middleware(ctx) : await handler(ctx);
  // 讓 waitUntil 的寫入（api_logs 等）在回應回傳前落地，測試才不會有時序問題
  await Promise.allSettled(pending);
  return response;
}

export interface RequestOptions {
  /** 以此 email 的使用者身分呼叫（進程內會建立使用者與 access token）。 */
  as?: string;
  /** `as` 的 access token 帶的 scope；預設可讀寫行程。 */
  scopes?: string[];
  /** `as` 的 access token 帶 restrict_trip（行程範圍受限 token）。 */
  restrictTrip?: string;
  /** 直接帶一個既有的 bearer token（外部目標用）。 */
  bearer?: string;
  /**
   * 帶 session cookie（`sessionFor().cookie`）。會改變 middleware 的認證路徑：
   * 變更類請求沒帶 Origin 時，自動補上允許的 origin，等同瀏覽器同源送出的行為。
   */
  cookie?: string;
  json?: unknown;
  /** application/x-www-form-urlencoded 的表單內容（瀏覽器 form POST 用，例如 consent）。 */
  form?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface Api {
  request(method: string, path: string, options?: RequestOptions): Promise<Response>;
  get(path: string, options?: RequestOptions): Promise<Response>;
  /** 在進程內的 D1 建立使用者與 access token，回傳 token 字串。 */
  tokenFor(email: string, scopes?: string[], extra?: { restrictTrip?: string }): Promise<string>;
  /**
   * 在進程內以真實流程（issueSession）建立 session：寫入 session_devices 資料列並簽出 cookie。
   * env 必須含 SESSION_SECRET。`userId` 預設由 email 衍生。
   */
  sessionFor(email: string, userId?: string): Promise<{ cookie: string; sid: string | undefined; userId: string }>;
  fetch(request: Request): Promise<Response>;
}

export function createApi(target: { env: Env } | { baseUrl: string }): Api {
  const inProcess = 'env' in target ? target.env : null;
  const base = inProcess ? 'https://test.com' : (target as { baseUrl: string }).baseUrl;

  async function tokenFor(
    email: string,
    scopes = ['trips:read', 'trips:write'],
    extra: { restrictTrip?: string } = {},
  ): Promise<string> {
    if (!inProcess) throw new Error('tokenFor 只能用在進程內目標；外部目標請直接傳 bearer');
    const userId = userIdFor(email);
    await inProcess.DB
      .prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .bind(userId, email, email.split('@')[0])
      .run();
    const token = `http-test-${crypto.randomUUID()}`;
    await new D1Adapter(inProcess.DB, 'AccessToken').upsert(
      token,
      {
        jti: token, client_id: 'http-test', user_id: userId, scopes, grantId: `grant-${token}`,
        ...(extra.restrictTrip ? { restrict_trip: extra.restrictTrip } : {}),
      },
      300,
    );
    return token;
  }

  async function sessionFor(email: string, userId = userIdFor(email)) {
    if (!inProcess) throw new Error('sessionFor 只能用在進程內目標；外部目標請直接傳 cookie');
    await inProcess.DB
      .prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .bind(userId, email, email.split('@')[0])
      .run();
    const carrier = new Response(null);
    await issueSession(
      new Request('https://test.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
      carrier,
      userId,
      inProcess as never,
    );
    const cookie = (carrier.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
    const token = cookie.slice(cookie.indexOf('=') + 1);
    const payload = await verifySessionToken(token, inProcess.SESSION_SECRET as string);
    return { cookie, sid: payload?.sid, userId };
  }

  async function doFetch(request: Request): Promise<Response> {
    return inProcess ? dispatch(request, inProcess) : fetch(request);
  }

  async function request(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    const bearer = options.bearer
      ?? (options.as ? await tokenFor(options.as, options.scopes, { restrictTrip: options.restrictTrip }) : undefined);
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    if (options.cookie) {
      headers.set('Cookie', options.cookie);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && !headers.has('Origin')) {
        headers.set('Origin', 'https://trip-planner-dby.pages.dev');
      }
    }
    let body: string | undefined;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers.set('content-type', 'application/json');
    } else if (options.form) {
      body = new URLSearchParams(options.form).toString();
      headers.set('content-type', 'application/x-www-form-urlencoded');
    }
    // 不自動跟隨轉址：OAuth 流程要驗的就是 302 的 Location
    return doFetch(new Request(new URL(path, base), { method, headers, body, redirect: 'manual' }));
  }

  return { request, get: (path, options) => request('GET', path, options), tokenFor, sessionFor, fetch: doFetch };
}

/** 把 Api 包成 node:http 的 handler，測試「換目標」時用它起一個本機伺服器。 */
export function serveApi(api: Api) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const hasBody = chunks.length > 0 && req.method !== 'GET' && req.method !== 'HEAD';
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const response = await api.fetch(new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
