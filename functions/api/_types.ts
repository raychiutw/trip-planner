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
  ALLOWED_ORIGIN?: string;
  /** v2.33.62 round 14c: 'production' / 'preview' / 'development'。靠 wrangler.toml
   * [env.X.vars]。Used by isAllowedOrigin (preview origin gate) + middleware
   * DEV_MOCK_EMAIL guard。 */
  ENVIRONMENT?: 'production' | 'preview' | 'development';
  /**
   * v2.33.59 round 13: 取代 `new URL(request.url).origin` 拾 outbound email
   * link / OIDC issuer。Defense — 不再信任 attacker-spoofable Host header。
   * Pages prod 用 `https://trip-planner-dby.pages.dev`；dev 用
   * `http://localhost:8788`。Helper `getPublicOrigin(env, request)` 在
   * `_utils.ts`，fallback to request.url.origin 若 env 未設（dev 漸進採用）。
   */
  PUBLIC_ORIGIN?: string;
  DEV_MOCK_EMAIL?: string;
  TRIPLINE_API_URL?: string;
  TRIPLINE_API_SECRET?: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // V2-P1 OAuth (optional during staged rollout)
  SESSION_SECRET?: string;
  /**
   * v2.33.62 round 14c: HMAC key for IP hash in auth_audit_log / session_devices.
   * 未設 → fallback unsalted SHA-256 (backward compat)。設了之後新 audit row HMAC，
   * 防 DB dump + rainbow-table reverse 一次 enable。建議 32-byte base64url random。
   * 部署: wrangler env set SESSION_IP_HASH_SECRET <value>。
   */
  SESSION_IP_HASH_SECRET?: string;
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
  // v2.23.0 Google Maps Platform — server-side single key (Places + Routes + Geocoding + Place Details).
  // Frontend Maps JS 用獨立 GOOGLE_MAPS_BROWSER_KEY (referrer-restricted) — 不在此 Env，是 import.meta.env
  GOOGLE_MAPS_API_KEY?: string;
  // Cloud Monitoring API auth (quota check) — service account JSON string
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_CLOUD_SA_KEY?: string;
  // poi-favorites-rename §5.7：companion gate 鎖定 mac mini cron OAuth client_id。
  // middleware 用此 env 比對 auth.clientId 作為 companion 啟用第三道 gate
  // （與 X-Request-Scope header + scopes 含 'companion' 同時成立才視為 companion）。
  TP_REQUEST_CLIENT_ID?: string;
}
