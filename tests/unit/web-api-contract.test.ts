/**
 * 跨 repo 契約守衛（trip-planner#1626 追加）：web SPA 實際呼叫的 api 端點與請求必填欄位，必須存在於 contracts/openapi.json。
 *
 * 以原始碼為準，不是手列清單：掃 src 內所有 `apiFetch` / `apiFetchRaw`（含 `auth.apiFetch`）的字串／樣板路徑，
 *   1. 路徑（含 method，無 `method:` 視為 GET）必須在契約內；
 *   2. 若 body 是 `JSON.stringify({ ... })` 的行內物件字面量（無 spread），契約 requestBody 的 required 欄位必須都在其中。
 * 契約檔是 api repo 匯出的逐字複本（見 docs/api-contract.md）；api 改路徑／欄位後同步進來，web 若還在用舊的，這裡轉紅。
 * 換快照來源只要設環境變數 API_CONTRACT_FILE（預設 contracts/openapi.json）。
 *
 * 涵蓋不到：變數組成的路徑、非行內的 body、回應欄位（讀取端）、query 參數；那些仍靠 src/lib/api/contract.typecheck.ts 與 api 端測試。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(__dirname, '../..');
const SPEC_FILE = process.env.API_CONTRACT_FILE ?? join(ROOT, 'contracts/openapi.json');

type Schema = { required?: string[]; $ref?: string };
type Op = { requestBody?: { content?: Record<string, { schema?: Schema }> } };
const spec = JSON.parse(readFileSync(SPEC_FILE, 'utf8')) as { paths: Record<string, Record<string, Op>> };

// 已知且有理由的落差；每一筆都要寫清楚為何不算漂移。新增前先確認不是真漂移。
// 目前沒有：POST /api/oauth/login 原本因旗標關閉的舊入口帳密登入（不帶 PKCE 欄位）列在這裡，旗標移除後該分支已刪（帳密登入一律走 auth.login，
// 其 body 與契約必填欄位的對照見 tests/unit/new-api-login-contract.test.ts）。
const KNOWN_GAPS: Record<string, string> = {};

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return p === join(ROOT, 'src/api') ? [] : listSources(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') && p !== join(ROOT, 'src/lib/apiClient.ts') ? [p] : [];
  });
}

/** 取 `JSON.stringify(` 後行內物件字面量的最上層 key；有 spread 或無法解析回 null。 */
function bodyKeys(win: string): string[] | null {
  const i = win.indexOf('JSON.stringify(');
  if (i < 0 || win[i + 15] !== '{') return null;
  let depth = 0;
  let end = i + 15;
  for (; end < win.length; end++) {
    if ('{[('.includes(win[end]!)) depth++;
    else if ('}])'.includes(win[end]!) && --depth === 0) break;
  }
  const segs: string[] = [];
  let seg = '';
  depth = 0;
  for (const c of win.slice(i + 16, end)) {
    if ('{[('.includes(c)) depth++;
    if ('}])'.includes(c)) depth--;
    if (c === ',' && depth === 0) { segs.push(seg); seg = ''; } else seg += c;
  }
  segs.push(seg);
  const keys: string[] = [];
  for (const s of segs.map((x) => x.trim()).filter(Boolean)) {
    if (s.startsWith('...')) return null;
    const m = s.match(/^['"]?([\w-]+)['"]?\s*(:|$)/);
    if (!m) return null;
    keys.push(m[1]!);
  }
  return keys;
}

interface Call { file: string; method: string; path: string; keys: string[] | null }
const CALL = /apiFetch(?:Raw)?(?:<[^(]*?>)?\(\s*([`'"])((?:(?!\1).)*)\1/g;
const calls: Call[] = listSources(join(ROOT, 'src')).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(CALL)].map((m) => {
    const rest = text.slice(m.index! + m[0].length);
    const next = rest.search(/apiFetch/);
    const win = rest.slice(0, Math.min(next > 0 ? next : 600, 600));
    // 樣板的 ${...} 視為路徑參數；結尾緊貼的 ${...}（如 `?query` 後綴）不算一段
    let path = m[2]!.split('?')[0]!.replace(/\$\{[^}]*\}/g, '{}').replace(/([^/])\{\}$/, '$1');
    if (!path.startsWith('/api/')) path = '/api' + path;
    return { file: file.replace(ROOT + '/', ''), method: win.match(/method:\s*'(\w+)'/)?.[1] ?? 'GET', path, keys: bodyKeys(win) };
  });
});

/** 精確字串優先，其次參數最少的樣板（避免 /pois/find-or-create 被 /pois/{id} 吃掉）。 */
function matchSpecPath(path: string): string | undefined {
  if (spec.paths[path]) return path;
  return Object.keys(spec.paths)
    .filter((p) => new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path))
    .sort((a, b) => (a.match(/\{/g)?.length ?? 0) - (b.match(/\{/g)?.length ?? 0))[0];
}

function requiredOf(op: Op): string[] | null {
  const schema = op.requestBody?.content?.['application/json']?.schema;
  if (!schema) return null;
  const doc = spec as unknown as Record<string, unknown>;
  const resolved = schema.$ref ? (schema.$ref.split('/').slice(1).reduce((o, k) => (o as Record<string, unknown>)[k], doc) as Schema) : schema;
  return resolved.required ?? [];
}

describe('web 呼叫的 api 端點 ↔ contracts/openapi.json', () => {
  it('掃得到足夠的呼叫（掃描器失效時不會假綠）', () => {
    expect(calls.length).toBeGreaterThan(100);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(100);
  });

  it('每個呼叫的路徑與 method 都在契約內', () => {
    const missing = calls.flatMap((c) => {
      const sp = matchSpecPath(c.path);
      if (!sp) return [`${c.method} ${c.path}（路徑不在契約）  ${c.file}`];
      return spec.paths[sp]![c.method.toLowerCase()] ? [] : [`${c.method} ${sp}（method 不在契約）  ${c.file}`];
    });
    expect(missing, '契約已移除／改名 web 還在用的端點').toEqual([]);
  });

  it('行內 JSON body 涵蓋契約 requestBody 的必填欄位', () => {
    const bad = calls.flatMap((c) => {
      const sp = matchSpecPath(c.path);
      const op = sp && spec.paths[sp]![c.method.toLowerCase()];
      if (!op || !c.keys || KNOWN_GAPS[`${c.method} ${sp}`]) return [];
      const lacking = (requiredOf(op) ?? []).filter((k) => !c.keys!.includes(k));
      return lacking.length ? [`${c.method} ${sp} 缺 ${lacking.join(',')}  ${c.file}`] : [];
    });
    expect(bad, '契約新增了必填欄位，web 的 body 沒送').toEqual([]);
  });

  it('KNOWN_GAPS 每一筆仍真的是落差（否則該移除，避免白名單過期）', () => {
    for (const key of Object.keys(KNOWN_GAPS)) {
      const [method, path] = key.split(' ') as [string, string];
      const c = calls.find((x) => x.method === method && matchSpecPath(x.path) === path && x.keys);
      expect(c, `${key} 已不在 web 程式中`).toBeTruthy();
      const lacking = (requiredOf(spec.paths[path]![method.toLowerCase()]!) ?? []).filter((k) => !c!.keys!.includes(k));
      expect(lacking.length, `${key} 已無落差`).toBeGreaterThan(0);
    }
  });
});
