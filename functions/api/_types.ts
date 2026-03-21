/**
 * API 共用型別定義
 */

export interface Env {
  DB: D1Database;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ACCESS_APP_ID: string;
  CF_ACCESS_POLICY_ID: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
}

export interface AuthData {
  email: string;
  isAdmin: boolean;
  isServiceToken: boolean;
}
