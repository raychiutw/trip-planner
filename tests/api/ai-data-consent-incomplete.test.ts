/**
 * 真實文案必須已填妥（不得殘留 {{...}} 占位符）；若有占位符，使用者無法同意、AI 入口一律被擋（fail closed）。
 * 不 mock 文案——占位符以就地加一段「待填」章節模擬，測完還原。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, seedEntry, getDayId, userIdFor } from './helpers';
import { createApi, type Api } from './http';
import { cleanupTrips } from './cleanup-trips';
import { CONSENT_TEXTS, CURRENT_CONSENT_VERSION } from '../../functions/api/_aiDataConsentText';
import { isConsentTextComplete } from '../../functions/api/_aiDataConsent';

const OWNER = 'aici-owner@test.com';
const TRIP = 'aici-trip';
const PLACEHOLDER_TEXT = '責任人：{{RESPONSIBLE_PARTY}}；聯絡信箱：{{CONTACT_EMAIL}}；條款：{{TERMS_URL}}';
const realSections = CONSENT_TEXTS[CURRENT_CONSENT_VERSION]!.sections;
const withPlaceholders = () => { CONSENT_TEXTS[CURRENT_CONSENT_VERSION]!.sections = [...realSections, { heading: '待填', items: [PLACEHOLDER_TEXT] }]; };
const restoreReal = () => { CONSENT_TEXTS[CURRENT_CONSENT_VERSION]!.sections = realSections; };
let db: D1Database;
let api: Api;
let cookie: string;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: 'test-secret-32-chars-long-enough' }) });
  await seedTrip(db, { id: TRIP, owner: OWNER });
  await seedEntry(db, await getDayId(db, TRIP, 1));
  await db.prepare('DELETE FROM ai_data_consent_events WHERE user_id = ?').bind(userIdFor(OWNER)).run(); // seedTrip 預設幫 owner 同意，這裡要測「沒有同意」
  cookie = (await api.sessionFor(OWNER, userIdFor(OWNER))).cookie; // 帳號端點走瀏覽器 session
});
afterAll(async () => {
  await db.prepare('DELETE FROM ai_data_consent_events WHERE user_id = ?').bind(userIdFor(OWNER)).run(); // DELETE 可能留下 withdrawn 事件
  await db.prepare('DELETE FROM trip_requests WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare('DELETE FROM trip_health_reports WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare('DELETE FROM trip_note_ai_jobs WHERE trip_id = ?').bind(TRIP).run();
  await cleanupTrips(db, [TRIP]);
  await disposeMiniflare();
});

const textOf = () => JSON.stringify(CONSENT_TEXTS[CURRENT_CONSENT_VERSION]);

describe('文案', () => {
  it('目前版本是 ai-data-v1，且已無任何待填占位符（isConsentTextComplete() 為 true）', () => {
    expect(CURRENT_CONSENT_VERSION).toBe('ai-data-v1');
    expect(textOf().match(/\{\{[A-Z_]+\}\}/g)).toBeNull();
    expect(isConsentTextComplete()).toBe(true);
  });
  it('isConsentTextComplete 只要任何一個占位符還在就是 false；全部填妥才 true', () => {
    const full = { version: 'x', title: 't', intro: 'i', sections: [{ heading: 'h', items: ['a'] }], withdrawal: ['w'] };
    expect(isConsentTextComplete(full)).toBe(true);
    for (const p of ['{{RESPONSIBLE_PARTY}}', '{{CONTACT_EMAIL}}', '{{TERMS_URL}}', '{{ANYTHING}}']) {
      expect(isConsentTextComplete({ ...full, sections: [{ heading: 'h', items: ['a', `聯絡 ${p}`] }] })).toBe(false);
      expect(isConsentTextComplete({ ...full, title: p })).toBe(false);
      expect(isConsentTextComplete({ ...full, withdrawal: [p] })).toBe(false);
    }
  });
  it('已定案的措辭：顯示名稱不含 email、每次修改留下紀錄、Anthropic（Claude）、依處理方條款；不寫可復原／不用於訓練／立即停止', () => {
    const t = textOf();
    expect(t).toContain('顯示名稱');
    expect(t).toContain('顯示名稱（不含 email）');
    expect(t).toMatch(/不會交給 AI：[^。"]*帳號 email/);
    expect(t).toContain('每次修改都會留下紀錄');
    expect(t).toContain('Anthropic（Claude）');
    expect(t).toContain('依處理方條款，詳見連結');
    expect(t).not.toMatch(/復原|不用於訓練|立即停止/);
    // 撤回語意照實寫
    expect(t).toContain('已經開始的工作');
    expect(t).toContain('無法收回');
  });
});

describe('文案未填妥：POST 不得記錄同意', () => {
  beforeAll(withPlaceholders);
  afterAll(restoreReal);
  it('POST → 409 AI_CONSENT_NOT_READY（帶 currentVersion），不寫入事件；GET 與 DELETE 不受影響', async () => {
    const res = await api.request('POST', '/api/account/ai-data-consent', { cookie, json: { version: 'ai-data-v1' } });
    expect(res.status).toBe(409);
    const b = await res.json() as any;
    expect(b.error.code).toBe('AI_CONSENT_NOT_READY');
    expect(b.error.currentVersion).toBe('ai-data-v1');
    const n = await db.prepare('SELECT COUNT(*) AS n FROM ai_data_consent_events WHERE user_id = ?').bind(userIdFor(OWNER)).first<{ n: number }>();
    expect(n!.n).toBe(0);
    expect((await api.get('/api/account/ai-data-consent', { cookie })).status).toBe(200);
    expect((await api.request('DELETE', '/api/account/ai-data-consent', { cookie })).status).toBe(200);
    // 版本不符仍優先回 MISMATCH（不因未就緒而改變）
    const mm = await api.request('POST', '/api/account/ai-data-consent', { cookie, json: { version: 'ai-data-v999' } });
    expect(((await mm.json()) as any).error.code).toBe('AI_CONSENT_VERSION_MISMATCH');
  });
});

describe('文案未完成：一律強制，所以 AI 被擋（fail closed）——上線前必須先填妥占位符', () => {
  beforeAll(withPlaceholders);
  afterAll(restoreReal);
  it('GET 狀態：enforced=true', async () => {
    const res = await api.get('/api/account/ai-data-consent', { cookie });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).enforced).toBe(true);
  });
  it('三個入口在沒有同意時回 403 AI_CONSENT_REQUIRED（而且使用者也無法同意，見上）', async () => {
    const calls = [
      api.request('POST', '/api/requests', { as: OWNER, json: { tripId: TRIP, message: '未完成文案' } }),
      api.request('POST', `/api/trips/${TRIP}/health-check`, { as: OWNER }),
      api.request('POST', `/api/trips/${TRIP}/notes/tips/generate`, { as: OWNER, json: {} }),
    ];
    for (const r of await Promise.all(calls)) {
      expect(r.status).toBe(403);
      expect(((await r.json()) as any).error.code).toBe('AI_CONSENT_REQUIRED');
    }
  });
});
