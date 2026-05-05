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
  // V2-P5 RS256 signing — PKCS8 private key (PEM or raw base64)
  OAUTH_SIGNING_PRIVATE_KEY?: string;
  // V2-P3 email service — kept for backward-compat during rollout, but
  // 2026-05-02 cutover routes sendEmail() through TRIPLINE_API_URL +
  // TRIPLINE_API_SECRET to mac mini Gmail SMTP via Tailscale Funnel.
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  // 2026-05-02 silent-fail observability — alertAdminTelegram fires here on
  // email send failure or trigger fetch failure (reuses scripts/daily-check creds).
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // 2026-05-02 OSM integration — POI enrich + travel routing.
  ORS_API_KEY?: string;          // OpenRouteService — POST /trips/:id/recompute-travel
  OPENTRIPMAP_API_KEY?: string;  // OpenTripMap — POST /pois/:id/enrich
  // poi-favorites-rename §5.7：companion gate 鎖定 mac mini cron OAuth client_id。
  // middleware 用此 env 比對 auth.clientId 作為 companion 啟用第三道 gate
  // （與 X-Request-Scope header + scopes 含 'companion' 同時成立才視為 companion）。
  TP_REQUEST_CLIENT_ID?: string;
}
