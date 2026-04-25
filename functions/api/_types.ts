/**
 * API 共用型別定義
 */

export type { AuthData } from '../../src/types/api';

export interface Env {
  DB: D1Database;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ACCESS_APP_ID: string;
  CF_ACCESS_POLICY_ID: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
  DEV_MOCK_EMAIL?: string;
  TRIPLINE_API_URL?: string;
  TRIPLINE_API_SECRET?: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // V2-P1 OAuth (optional during staged rollout)
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
