/**
 * migrations/0097_mobile_oauth_callbacks.sql 及其 rollback、public/.well-known/* 的行為守門。
 *
 * Value: protects=0097 註冊精確的 mobile callback、重跑不重複且不動營運端 redirect、rollback 能還原; fails_when=migration 覆蓋營運端 redirect、拿掉 NOT EXISTS 後重跑追加重複 URI、rollback 留下殘列、association 檔路徑偏離已註冊的 callback; why_new=mobile-oauth-callback.test.ts 只驗 runtime 政策不驗 migration 檔本身; seam=none; no_claim=association 檔內的 Team ID 與簽章指紋是否為真（需實機與 Apple/Google 驗證）
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { MOBILE_PROD_REDIRECT, MOBILE_UAT_REDIRECT } from '../../functions/api/_mobileOAuth';

const ROOT = path.join(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const FORWARD = read('migrations/0097_mobile_oauth_callbacks.sql');
const ROLLBACK = read('migrations/rollback/0097_mobile_oauth_callbacks_rollback.sql');
const NEW_CLIENTS = ['tripline-mobile-uat', 'tripline-mobile-dev'];

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(disposeMiniflare);

const runSql = async (sql: string) => {
  for (const stmt of sql.replace(/--[^\n]*/g, '').split(';').map(x => x.trim()).filter(Boolean)) await db.prepare(stmt).run();
};

const redirectsOf = async (clientId: string) => {
  const row = await db.prepare('SELECT redirect_uris FROM client_apps WHERE client_id = ?')
    .bind(clientId).first<{ redirect_uris: string }>();
  return row ? (JSON.parse(row.redirect_uris) as string[]) : null;
};
const setRedirects = (uris: string[]) =>
  db.prepare("UPDATE client_apps SET redirect_uris = ? WHERE client_id = 'tripline-mobile'").bind(JSON.stringify(uris)).run();

describe('0097 mobile OAuth callback migration', () => {
  it('migration 檔註冊的是 runtime 政策使用的同一組精確 URI（兩邊不會各改各的）', () => {
    expect(FORWARD).toContain(MOBILE_PROD_REDIRECT);
    expect(FORWARD).toContain(MOBILE_UAT_REDIRECT);
    expect(FORWARD).not.toMatch(/\*/); // 不得有 wildcard
  });

  it('套用後：正式 client 保留既有 redirect 並加上 HTTPS callback，UAT / dev 各自獨立', async () => {
    const prod = await redirectsOf('tripline-mobile');
    expect(prod).toContain(MOBILE_PROD_REDIRECT);
    expect(prod!.length).toBeGreaterThan(1); // 沒有覆蓋既有註冊
    expect(await redirectsOf('tripline-mobile-uat')).toEqual([MOBILE_UAT_REDIRECT]);
    expect(await redirectsOf('tripline-mobile-dev')).toEqual(['http://127.0.0.1:8765']);
  });

  it('已套用的狀態下重跑：不追加重複 URI、不新增重複 client，營運端自己加的 URI 保留', async () => {
    const original = (await redirectsOf('tripline-mobile'))!;
    const operatorUri = 'https://operator.example/cb';
    try {
      await setRedirects([...original, operatorUri]);
      await runSql(FORWARD);
      const after = (await redirectsOf('tripline-mobile'))!;
      expect(after.filter(u => u === MOBILE_PROD_REDIRECT)).toHaveLength(1);
      expect(after).toContain(operatorUri);
      const n = await db.prepare("SELECT COUNT(*) AS n FROM client_apps WHERE client_id IN ('tripline-mobile-uat','tripline-mobile-dev')").first<{ n: number }>();
      expect(n?.n).toBe(2);
    } finally { await setRedirects(original); }
  });

  it('rollback：移除新增的 client 與 callback、保留營運端 URI，並撤銷綁定新 client 的 token', async () => {
    const original = (await redirectsOf('tripline-mobile'))!;
    const operatorUri = 'https://operator.example/cb';
    // 各測試檔共用同一份 D1：先保存會被 rollback 波及的既有 token 列，測完原樣放回
    const shared = (await db.prepare("SELECT name, id, payload, expires_at FROM oauth_models WHERE json_extract(payload, '$.client_id') IN (?, ?) OR json_extract(payload, '$.clientId') IN (?, ?)")
      .bind(...NEW_CLIENTS, ...NEW_CLIENTS).all<{ name: string; id: string; payload: string; expires_at: number }>()).results ?? [];
    // 真實 token 的 payload 是 snake_case（見 oauth/token.ts），刪帳號 challenge 是 camelCase：兩種形狀都要被 rollback 撤銷
    await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', 't-dev', ?, ?), ('AccountDeleteChallenge', 't-chal', ?, ?)")
      .bind(JSON.stringify({ client_id: 'tripline-mobile-dev', user_id: 'u', scopes: ['openid'], grantId: 'g' }), Number.MAX_SAFE_INTEGER,
        JSON.stringify({ clientId: 'tripline-mobile-uat', uid: 'u', grantId: 'g', status: 'pending' }), Number.MAX_SAFE_INTEGER).run();
    try {
      await setRedirects([...original, operatorUri]);
      await runSql(ROLLBACK);
      expect(await redirectsOf('tripline-mobile')).toEqual(original.filter(u => u !== MOBILE_PROD_REDIRECT).concat(operatorUri));
      expect(await redirectsOf('tripline-mobile-uat')).toBeNull();
      expect(await redirectsOf('tripline-mobile-dev')).toBeNull();
      const left = await db.prepare("SELECT COUNT(*) AS n FROM oauth_models WHERE id IN ('t-dev', 't-chal')").first<{ n: number }>();
      expect(left?.n).toBe(0);
    } finally {
      await runSql(FORWARD); // forward 冪等：重放會重建兩個 client 與 callback（updated_at 等時間戳會更新，沒有任何測試依賴它們）
      await setRedirects(original);
      for (const r of shared) {
        await db.prepare('INSERT OR IGNORE INTO oauth_models (name, id, payload, expires_at) VALUES (?, ?, ?, ?)').bind(r.name, r.id, r.payload, r.expires_at).run();
      }
      expect(await redirectsOf('tripline-mobile-uat')).toEqual([MOBILE_UAT_REDIRECT]); // 還原失敗要讓這個測試自己紅
    }
  });
});

describe('public/.well-known association files', () => {
  const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'));
  const links = JSON.parse(read('public/.well-known/assetlinks.json'));
  const headers = read('public/_headers');

  it('iOS 與 Android 都指向已核實的 app id，且路徑與實際註冊的 callback 一致（不是另寫一份常數）', () => {
    const detail = aasa.applinks.details[0];
    expect(detail.appID.endsWith('.com.raychiu.tripline')).toBe(true);
    expect(detail.paths).toEqual([new URL(MOBILE_PROD_REDIRECT).pathname, new URL(MOBILE_UAT_REDIRECT).pathname]);
    expect(links[0].target.package_name).toBe('com.raychiu.tripline');
    expect(links[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  });

  it('extensionless 的 apple-app-site-association 以 application/json 提供（否則 iOS 不認）', () => {
    const block = headers.split(/\n\s*\n/).find(b => b.startsWith('/.well-known/apple-app-site-association'));
    expect(block).toBeDefined();
    expect(block).toMatch(/Content-Type:\s*application\/json/);
  });
});
