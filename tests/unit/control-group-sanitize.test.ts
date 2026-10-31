/**
 * 對照組的消毒（拆分 T6）：舊入口程式碼搭配「消毒過的 staging 資料副本」。
 *
 * 驗收只驗輸出：不管消毒怎麼寫，最終的 SQL 掃不到任何真實 email 與 token 樣式。
 * 另外有一條「結構性」守衛：資料庫裡每一張表都必須在政策裡明確表態（複製／整張不複製），
 * 之後新增資料表如果沒有表態，測試會紅，不會悄悄把新表的資料複製出去。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { POLICY, ALLOWED_SOURCE_DB, assertAllowedSource, tableOrder, type Row } from '../../scripts/control-group/policy';
import type { ForeignKey } from '../../scripts/control-group/sanitize';
import { sanitize } from '../../scripts/control-group/sanitize';
import { scan } from '../../scripts/control-group/scan';

const REAL_EMAIL = 'real.person@gmail.com';
const OTHER_EMAIL = 'friend.of.person@company.co.jp';
const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSIsImV4cCI6MTc5OTk5OTk5OX0.c2lnbmF0dXJlLXNpZ25hdHVyZQ';
const HEX = 'a3f5c9d1e7b24680fedcba9876543210a3f5c9d1';
const AIZA = 'AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY';

/** 一份小而齊全的假來源資料：把所有會洩漏的欄位都放上真實樣式的值。 */
function fixture(): Record<string, Row[]> {
  return {
    users: [
      { id: 'u-b', email: OTHER_EMAIL, display_name: 'Friend Name', avatar_url: 'https://x/y.png', status: 'active' },
      { id: 'u-a', email: REAL_EMAIL.toUpperCase(), display_name: 'Real Person', avatar_url: null, status: 'active' },
    ],
    trips: [{ id: 't1', name: 'okinawa', owner_user_id: 'u-a', title: `沖繩行 聯絡 ${REAL_EMAIL}`, description: null }],
    trip_pretrip_notes: [
      { id: 1, trip_id: 't1', content: `訂位請寄到 ${OTHER_EMAIL}，confirm ${HEX}`, title: 'n' },
    ],
    trip_entries: [{ id: 1, description: `token ${JWT}`, day_id: 1 }],
    pois: [{ id: 1, name: 'Shop', email: 'shop@business.example', note: `key ${AIZA}`, phone: '098-765-4321' }],
    trip_emergency_contacts: [
      { id: 1, trip_id: 't1', name: '王小明', phone: '0912-345-678', email: 'wang@example.org', relationship: 'family' },
    ],
    trip_lodgings: [{ id: 1, trip_id: 't1', name: 'Hotel', booking_no: 'BK9988776655', phone: '098-111-2222', address: 'Naha' }],
    trip_reservations: [
      { id: 1, trip_id: 't1', kind: 'restaurant', title: 'Dinner', reservation_no: 'RSV-20260726-77', phone: '098-333-4444' },
      { id: 2, trip_id: 't1', kind: 'restaurant', title: 'Lunch', reservation_no: 'RSV-20260727-88', phone: null },
    ],
    trip_requests: Array.from({ length: 60 }, (_, i) => ({
      id: i + 1, trip_id: 't1', message: `幫我改行程 ${REAL_EMAIL}`, reply: `好的，已更新 Bearer ${HEX}`,
      submitted_by: i % 2 ? REAL_EMAIL : 'service:tp-request', status: 'completed',
    })),
    api_logs: Array.from({ length: 300 }, (_, i) => ({
      id: i + 1, method: 'GET', path: i === 299 ? `/api/share/${HEX}` : `/api/trips/t1/days/${i}`,
      status: 200, error: i === 299 ? `bad token ${JWT}` : null, source: 'user',
    })),
    audit_log: Array.from({ length: 150 }, (_, i) => ({
      id: i + 1, trip_id: 't1', table_name: 'trips', record_id: '1', action: 'update',
      changed_by: i % 2 ? REAL_EMAIL : 'service:cli', diff_json: `{"email":"${OTHER_EMAIL}"}`, snapshot: `{"t":"${JWT}"}`,
    })),
    auth_audit_log: Array.from({ length: 80 }, (_, i) => ({
      id: i + 1, event_type: 'login', outcome: 'success', user_id: 'u-a', ip_hash: HEX, user_agent: 'Mozilla/5.0',
      metadata: `{"email":"${REAL_EMAIL}"}`,
    })),
    // 憑證類：即使被塞進來也不得出現在輸出
    oauth_models: [{ name: 'AccessToken', id: HEX, payload: `{"jti":"${HEX}","token":"${JWT}"}` }],
    auth_identities: [{ id: 'i1', user_id: 'u-a', provider: 'local', password_hash: 'pbkdf2$100000$abcdef$0123456789abcdef0123456789abcdef' }],
    client_apps: [{ client_id: 'x', client_secret_hash: HEX }],
    session_devices: [{ sid: HEX, user_id: 'u-a', ip_hash: HEX }],
    trip_invitations: [{ token_hash: HEX, invited_email: REAL_EMAIL }],
    trip_shares: [{ id: 's', token_hash: HEX }],
  };
}

describe('政策涵蓋所有資料表（結構性守衛）', () => {
  let tables: string[] = [];
  beforeAll(async () => {
    const db = await createTestDb();
    const { results } = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'")
      .all<{ name: string }>();
    tables = results.map((r) => r.name);
  }, 60000);
  afterAll(disposeMiniflare);

  it('每一張表都在 POLICY 裡明確表態', () => {
    const missing = tables.filter((t) => !(t in POLICY));
    expect(missing, `這些表沒有消毒政策：${missing.join(', ')}`).toEqual([]);
  });

  it('POLICY 沒有指向不存在的表', () => {
    // d1_migrations 是 wrangler 套用 migration 時才有的表，測試用的 D1 是逐條執行語句，所以沒有它
    expect(Object.keys(POLICY).filter((t) => t !== 'd1_migrations' && !tables.includes(t))).toEqual([]);
  });

  it('設成 null 規則的欄位在 schema 裡都允許 NULL（NOT NULL 欄位要用 mask）', async () => {
    const db = await createTestDb();
    const offenders: string[] = [];
    for (const [table, policy] of Object.entries(POLICY)) {
      if (policy.mode !== 'copy' || !policy.columns) continue;
      const { results } = await db.prepare(`PRAGMA table_info("${table}")`).all<{ name: string; notnull: number }>();
      for (const [col, rule] of Object.entries(policy.columns)) {
        const info = results.find((r) => r.name === col);
        if (!info) offenders.push(`${table}.${col}（欄位不存在）`);
        else if (rule === 'null' && info.notnull === 1) offenders.push(`${table}.${col}（NOT NULL）`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('憑證類與個資類的表整張不複製', () => {
    for (const t of ['oauth_models', 'client_apps', 'auth_identities', 'session_devices', 'trip_invitations', 'trip_shares', 'rate_limit_buckets', 'pois_search_cache', 'app_settings']) {
      expect(POLICY[t]?.mode, t).toBe('skip');
    }
  });
});

describe('來源限制：只讀 staging，絕不碰正式資料庫', () => {
  it('只允許 staging 資料庫名稱', () => {
    expect(ALLOWED_SOURCE_DB).toBe('trip-planner-db-staging');
    expect(() => assertAllowedSource('trip-planner-db-staging')).not.toThrow();
  });
  it('正式資料庫名稱與 id 一律拒絕', () => {
    expect(() => assertAllowedSource('trip-planner-db')).toThrow(/staging/);
    expect(() => assertAllowedSource('d61c42d5-8083-4e18-9b6c-70e133e37322')).toThrow();
    expect(() => assertAllowedSource('')).toThrow();
  });
});

describe('build.ts 的來源端（文字守衛）', () => {
  const build = fs.readFileSync(path.resolve(__dirname, '../../scripts/control-group/build.ts'), 'utf8');
  // 只看程式碼，不看註解（註解會提到「正式資料庫」這幾個字）
  const code = build.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('對 wrangler 下的資料庫名稱是 ALLOWED_SOURCE_DB（staging），且先過 assertAllowedSource', () => {
    expect(code).toMatch(/assertAllowedSource\(ALLOWED_SOURCE_DB\)/);
    expect(code).toMatch(/'execute',\s*ALLOWED_SOURCE_DB,\s*'--remote'/);
  });

  it('只允許 SELECT（query() 開頭就檢查）', () => {
    expect(code).toMatch(/\^\\s\*SELECT\\b/);
  });

  it('不出現正式資料庫的名稱、id，也沒有 --env production', () => {
    expect(code).not.toMatch(/d61c42d5/);
    expect(code).not.toMatch(/--env['"]?,?\s*['"]?production/);
    expect(code).not.toMatch(/trip-planner-db['"`]/);
  });

  it('只對 COPY_TABLES 下 SELECT（憑證類的表連讀都不讀）', () => {
    expect(code).toMatch(/for \(const table of COPY_TABLES\)/);
  });
});

describe('消毒的行為', () => {
  const out = () => sanitize(fixture());

  it('整張不複製的表，輸出裡不會有它們的 INSERT，也不會有它們的內容', () => {
    const { sql } = out();
    for (const t of ['oauth_models', 'auth_identities', 'client_apps', 'session_devices', 'trip_invitations', 'trip_shares']) {
      expect(sql, t).not.toMatch(new RegExp(`INSERT INTO "${t}"`));
    }
    expect(sql).not.toContain('pbkdf2$');
  });

  it('users：email 換成 control.invalid 流水號（大小寫視為同一人），顯示名稱與頭像一併處理', () => {
    const { sql } = out();
    expect(sql).toMatch(/user1@control\.invalid/);
    expect(sql).toMatch(/user2@control\.invalid/);
    expect(sql).not.toMatch(/user3@control\.invalid/);
    expect(sql).toMatch(/'User 1'/);
    expect(sql).not.toContain('Real Person');
    expect(sql).not.toContain('Friend Name');
    expect(sql).not.toContain('https://x/y.png');
  });

  it('同一個 email 在不同表裡對到同一個假位址', () => {
    const { sql } = out();
    const userRow = /INSERT INTO "users"[^\n]*u-a[^\n]*/.exec(sql)![0];
    const fake = /user\d+@control\.invalid/.exec(userRow)![0];
    expect(/INSERT INTO "trips"[^\n]*/.exec(sql)![0]).toContain(fake); // 行程標題裡的 email
  });

  it('自由文字裡的 email 與 token 樣式被洗掉', () => {
    const { sql } = out();
    expect(sql).not.toContain(OTHER_EMAIL);
    expect(sql).not.toContain(HEX);
    expect(sql).not.toContain(JWT);
    expect(sql).not.toContain(AIZA);
  });

  it('submitted_by／changed_by 的 email 換成假位址，service 主體保留', () => {
    const { sql } = out();
    expect(sql).toContain('service:tp-request');
    expect(sql).toContain('service:cli');
    expect(sql).not.toContain(REAL_EMAIL);
  });

  it('聊天截斷：只留最新 50 筆，內容換成佔位字', () => {
    const { sql } = out();
    const rows = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "trip_requests"'));
    expect(rows).toHaveLength(50);
    expect(rows.every((r) => r.includes('[truncated]'))).toBe(true);
    expect(rows.some((r) => /,\s*60,|\(60,/.test(r))).toBe(true); // 最新的（id 最大）保留
    expect(rows.some((r) => /\(1,/.test(r))).toBe(false); // 最舊的被截掉
  });

  it('api_logs：只留最新 200 筆，path 不帶可能是 token 的片段，error 清空', () => {
    const { sql } = out();
    const rows = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "api_logs"'));
    expect(rows).toHaveLength(200);
    expect(sql).not.toContain('/api/share/a3f5');
    expect(rows.join('\n')).toMatch(/\/api\/trips\/…/);
    // error 欄位整個清空，連「bad token」這種上下文文字都不留
    expect(rows.join('\n')).not.toContain('bad token');
  });

  it('audit_log 只留最新 100 筆且不含 diff／snapshot；auth_audit_log 只留 50 筆且無 ip／UA／metadata', () => {
    const { sql } = out();
    const audit = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "audit_log"'));
    const auth = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "auth_audit_log"'));
    expect(audit).toHaveLength(100);
    expect(auth).toHaveLength(50);
    // 欄位名稱仍在 INSERT 的欄位清單裡，要驗的是「值」被清掉
    expect(audit.join('\n')).not.toContain('"email":');
    expect(audit.join('\n')).not.toContain('"t":');
    expect(auth.join('\n')).not.toContain('Mozilla');
    expect(auth.join('\n')).not.toContain('"email":');
    // ip_hash 要是 NULL；不能靠「剛好是長十六進位而被 token 洗滌兜住」（真實的短雜湊不會被洗到）
    expect(auth.join('\n')).not.toContain('[token]');
    expect(auth.join('\n')).toContain('[masked]'); // ip_hash 是 NOT NULL，所以是遮蔽字串而非 NULL
  });

  it('緊急聯絡人與住宿／訂位的個人欄位遮蔽（姓名、電話、email、訂位編號）', () => {
    const { sql } = out();
    for (const secret of ['王小明', '0912-345-678', 'wang@example.org', 'BK9988776655', '098-111-2222']) {
      expect(sql, secret).not.toContain(secret);
    }
  });

  it('個人識別欄位有值就換成 [masked]，不是 NULL（NOT NULL 欄位如 reservation_no 才載得進去）；原本是 NULL 就維持 NULL', () => {
    const { sql } = out();
    const rows = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "trip_reservations"'));
    expect(rows).toHaveLength(2);
    expect(sql).not.toContain('RSV-2026');
    expect(sql).not.toContain('098-333-4444');
    // reservation_no 在兩列都是 '[masked]'；phone 第一列 '[masked]'、第二列 NULL
    expect(rows[0]).toMatch(/'\[masked\]'.*'\[masked\]'/);
    expect(rows[1]).toMatch(/'\[masked\]'.*NULL/);
  });

  it('SQL 字串的單引號正確跳脫；NULL 與數字不加引號', () => {
    const { sql } = sanitize({ trips: [{ id: "t'1", name: "O'Brien's", owner_user_id: null, title: 'x', description: null, published: 1 }] });
    expect(sql).toContain(`'t''1'`);
    expect(sql).toContain(`'O''Brien''s'`);
    expect(sql).toMatch(/NULL/);
    expect(sql).toMatch(/, 1\)/);
  });

  it('含換行的字串仍是單行 INSERT（用 char(10) 串接），數量不變', () => {
    const { sql } = sanitize({ trip_pretrip_notes: [{ id: 1, trip_id: 't', content: 'line1\nline2\r\nline3', title: 'n' }] });
    expect(sql.trimEnd().split('\n')).toHaveLength(1);
    expect(sql).toContain("'line1' || char(10) || 'line2' || char(13) || char(10) || 'line3'");
  });

  it('輸出是確定的（同樣輸入產生同樣的 SQL）', () => {
    expect(sanitize(fixture()).sql).toBe(sanitize(fixture()).sql);
  });
});

describe('驗收：只驗輸出，掃不到真實 email 與 token 樣式', () => {
  it('消毒後的 SQL 通過獨立的掃描器', () => {
    expect(scan(sanitize(fixture()).sql)).toEqual([]);
  });

  it('掃描器抓得到真實 email、JWT、長十六進位、Bearer、API key', () => {
    const kinds = (s: string) => scan(s).map((f) => f.kind);
    expect(kinds(`'${REAL_EMAIL}'`)).toContain('email');
    expect(kinds(`'${JWT}'`)).toContain('jwt');
    expect(kinds(`'${HEX}'`)).toContain('hex');
    expect(kinds("'Bearer abcdefghijklmnop1234'")).toContain('bearer');
    expect(kinds(`'${AIZA}'`)).toContain('apikey');
  });

  it('掃描器放行 control.invalid 的假 email，與一般文字', () => {
    expect(scan("'user1@control.invalid' '今天去海邊 ok' 12345")).toEqual([]);
  });

  it('只放行 @control.invalid：其他 .invalid 網域一樣算真實 email', () => {
    expect(scan("'x@other.invalid'").map((f) => f.kind)).toContain('email');
    expect(scan("'x@control.invalid.example.com'").map((f) => f.kind)).toContain('email');
  });

  it('把消毒後的輸出故意塞回一個真 email → 掃描器要抓到（不是恆真）', () => {
    const dirty = `${sanitize(fixture()).sql}\nINSERT INTO "x" VALUES ('${REAL_EMAIL}');`;
    expect(scan(dirty).map((f) => f.kind)).toContain('email');
  });
});

describe('截斷後修剪孤兒列（外鍵）', () => {
  const fks: ForeignKey[] = [
    { table: 'companion_request_actions', from: 'request_id', parent: 'trip_requests', to: 'id' },
    { table: 'trip_health_reports', from: 'request_id', parent: 'trip_requests', to: 'id' },
  ];
  const requests = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, trip_id: 't1', message: 'm', reply: 'r', submitted_by: 'u', status: 'completed' }));

  it('引用被截斷掉的父列（trip_requests 只留最新 50 筆）的子列被丟掉，引用保留列的子列保留', () => {
    const { sql, counts } = sanitize(
      {
        trip_requests: requests,
        companion_request_actions: [
          { id: 1, request_id: 5, action: 'favorite_create' }, // id 5 被截掉
          { id: 2, request_id: 55, action: 'favorite_create' }, // id 55 保留
        ],
      },
      undefined,
      fks,
    );
    expect(counts.companion_request_actions).toBe(1);
    const rows = sql.split('\n').filter((l) => l.startsWith('INSERT INTO "companion_request_actions"'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/\(2,/);
  });

  it('外鍵欄位是 NULL 的列保留（沒有父列可言）', () => {
    const { counts } = sanitize(
      { trip_requests: requests, trip_health_reports: [{ trip_id: 't1', user_id: 'u', status: 'done', request_id: null }] },
      undefined,
      fks,
    );
    expect(counts.trip_health_reports).toBe(1);
  });

  it('連鎖：孫列的父列被丟掉，孫列也跟著丟', () => {
    const chain: ForeignKey[] = [
      { table: 'trip_days', from: 'trip_id', parent: 'trips', to: 'id' },
      { table: 'trip_entries', from: 'day_id', parent: 'trip_days', to: 'id' },
    ];
    const { counts } = sanitize(
      {
        trips: [{ id: 't1', name: 'a' }],
        trip_days: [{ id: 1, trip_id: 't1' }, { id: 2, trip_id: 'missing' }],
        trip_entries: [{ id: 10, day_id: 1 }, { id: 11, day_id: 2 }],
      },
      ['trips', 'trip_days', 'trip_entries'],
      chain,
    );
    expect(counts).toMatchObject({ trips: 1, trip_days: 1, trip_entries: 1 });
  });

  it('沒給外鍵資訊時行為不變（向下相容）', () => {
    expect(sanitize({ trip_requests: requests.slice(0, 3) }).counts.trip_requests).toBe(3);
  });
});

describe('插入順序', () => {
  it('父表在子表之前', () => {
    const order = tableOrder([['trips', 'users'], ['trip_days', 'trips'], ['trip_entries', 'trip_days']], ['trip_entries', 'trip_days', 'trips', 'users']);
    expect(order.indexOf('users')).toBeLessThan(order.indexOf('trips'));
    expect(order.indexOf('trips')).toBeLessThan(order.indexOf('trip_days'));
    expect(order.indexOf('trip_days')).toBeLessThan(order.indexOf('trip_entries'));
  });
});
