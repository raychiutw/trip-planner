/**
 * migrations/0097_mobile_oauth_callbacks.sql 及其 rollback、public/.well-known/* 的行為守門。
 *
 * Value: protects=0097 註冊精確的 mobile callback 且 rollback 能還原; fails_when=migration 覆蓋營運端 redirect、rollback 留下殘列、association 檔偏離 app id; why_new=mobile-oauth-callback.test.ts 只驗 runtime 政策不驗 migration 檔本身; seam=none; no_claim=association 檔內的 Team ID 與簽章指紋是否為真（需實機與 Apple/Google 驗證）
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { MOBILE_PROD_REDIRECT, MOBILE_UAT_REDIRECT } from '../../functions/api/_mobileOAuth';

const ROOT = path.join(__dirname, '../..');
const ROLLBACK = fs.readFileSync(path.join(ROOT, 'migrations/rollback/0097_mobile_oauth_callbacks_rollback.sql'), 'utf8');

const FORWARD = fs.readFileSync(path.join(ROOT, 'migrations/0097_mobile_oauth_callbacks.sql'), 'utf8');

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(disposeMiniflare);

const redirectsOf = async (clientId: string) => {
  const row = await db.prepare('SELECT redirect_uris FROM client_apps WHERE client_id = ?')
    .bind(clientId).first<{ redirect_uris: string }>();
  return row ? (JSON.parse(row.redirect_uris) as string[]) : null;
};

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

  it('rollback：移除新增的 client 與 callback、保留原本的 redirect，並撤銷綁定新 client 的 token', async () => {
    const before = (await redirectsOf('tripline-mobile'))!.filter(u => u !== MOBILE_PROD_REDIRECT);
    await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', 't-dev', ?, ?)")
      .bind(JSON.stringify({ clientId: 'tripline-mobile-dev' }), Number.MAX_SAFE_INTEGER).run();
    for (const stmt of ROLLBACK.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
    expect(await redirectsOf('tripline-mobile')).toEqual(before);
    expect(await redirectsOf('tripline-mobile-uat')).toBeNull();
    expect(await redirectsOf('tripline-mobile-dev')).toBeNull();
    const left = await db.prepare("SELECT COUNT(*) AS n FROM oauth_models WHERE id = 't-dev'").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});

describe('public/.well-known association files', () => {
  const aasa = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/.well-known/apple-app-site-association'), 'utf8'));
  const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/.well-known/assetlinks.json'), 'utf8'));

  it('iOS 與 Android 都指向已核實的 app id，且路徑只有註冊的兩條 callback', () => {
    const detail = aasa.applinks.details[0];
    expect(detail.appID.endsWith('.com.raychiu.tripline')).toBe(true);
    expect(detail.paths).toEqual(['/oauth/callback', '/uat/oauth/callback']);
    expect(links[0].target.package_name).toBe('com.raychiu.tripline');
    expect(links[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  });
});
