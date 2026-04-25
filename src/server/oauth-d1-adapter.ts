/**
 * D1 Adapter for Panva oidc-provider — V2-P1 (per docs/v2-oauth-server-plan.md)
 *
 * Implements the [Adapter interface](https://github.com/panva/node-oidc-provider/blob/main/lib/models/adapter.js)
 * over Cloudflare D1。Generic single-table key-value store (oauth_models)，
 * complex queries 用 SQLite json_extract() 索引。
 *
 * Lifecycle 模式：
 *   - upsert(id, payload, expiresIn): INSERT OR REPLACE，expires_at = now + ms
 *   - find(id): SELECT，過期 row 視為不存在（lazy delete on read）
 *   - destroy(id): DELETE
 *   - 過期 row cleanup 由 cron job 跑 `DELETE WHERE expires_at < now()`（V2-P6）
 *
 * 不做（留 next sprint）：
 *   - findByUserCode：device flow（V2-P5 排程）
 *   - 加密 payload at rest（敏感 token 已 short-lived，明文 acceptable）
 */
import type { D1Database } from '@cloudflare/workers-types';

/** Panva oidc-provider 的 AdapterPayload contract（subset，含常用欄位）。 */
export interface AdapterPayload {
  [key: string]: unknown;
  jti?: string;
  iat?: number;
  exp?: number;
  /** 用於 findByUid (Session model) */
  uid?: string;
  /** 用於 revokeByGrantId */
  grantId?: string;
  /** consume() 標記為 used（authorization_code one-shot） */
  consumed?: number;
}

export class D1Adapter {
  constructor(private db: D1Database, private name: string) {
    // name = 'Session' | 'AuthorizationCode' | 'AccessToken' | 'RefreshToken' | ...
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    await this.db
      .prepare(
        'INSERT OR REPLACE INTO oauth_models (name, id, payload, expires_at) VALUES (?, ?, ?, ?)',
      )
      .bind(this.name, id, JSON.stringify(payload), Date.now() + expiresIn * 1000)
      .run();
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const row = await this.db
      .prepare('SELECT payload, expires_at FROM oauth_models WHERE name = ? AND id = ?')
      .bind(this.name, id)
      .first<{ payload: string; expires_at: number }>();
    if (!row) return undefined;
    if (row.expires_at < Date.now()) return undefined; // lazy delete
    return JSON.parse(row.payload) as AdapterPayload;
  }

  /**
   * Device flow lookup — V2-P5 才實作。throw 讓 oidc-provider 把 device flow
   * grant 全 disable（library 在 init 期 detect adapter capability）。
   */
  async findByUserCode(_userCode: string): Promise<AdapterPayload | undefined> {
    throw new Error('D1Adapter: device flow (findByUserCode) not implemented (V2-P5)');
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = await this.db
      .prepare(
        'SELECT payload, expires_at FROM oauth_models WHERE name = ? AND json_extract(payload, ?) = ?',
      )
      .bind(this.name, '$.uid', uid)
      .first<{ payload: string; expires_at: number }>();
    if (!row) return undefined;
    if (row.expires_at < Date.now()) return undefined;
    return JSON.parse(row.payload) as AdapterPayload;
  }

  async consume(id: string): Promise<void> {
    // Mark authorization_code as used (one-shot guard against replay)
    await this.db
      .prepare(
        'UPDATE oauth_models SET payload = json_set(payload, ?, ?) WHERE name = ? AND id = ?',
      )
      .bind('$.consumed', Date.now(), this.name, id)
      .run();
  }

  async destroy(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM oauth_models WHERE name = ? AND id = ?')
      .bind(this.name, id)
      .run();
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    // 跨所有 name 刪 — grantId 是跨 model 的 link key（一個 grant 含多個 access_token / refresh_token）
    await this.db
      .prepare('DELETE FROM oauth_models WHERE json_extract(payload, ?) = ?')
      .bind('$.grantId', grantId)
      .run();
  }

  /** Maintenance: 清掉過期 row，cron job 用。回傳清掉幾 row。 */
  static async sweepExpired(db: D1Database): Promise<number> {
    const result = await db
      .prepare('DELETE FROM oauth_models WHERE expires_at < ?')
      .bind(Date.now())
      .run();
    return (result.meta?.changes as number | undefined) ?? 0;
  }
}
