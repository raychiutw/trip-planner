/**
 * Email service — V2-P3 transactional email send via Resend API
 *
 * 為何 Resend：Workers fetch-friendly、3k/月免費、developer-first docs（per
 * V2-OAuth design doc Open Question #1 + autoplan finding）。
 *
 * 為何不 Cloudflare Email Routing：forward-only (inbound)，outbound 仍 beta，
 * 不適合 production 主流程。
 *
 * Usage:
 *   import { sendEmail, type EmailEnv } from 'src/server/email';
 *   await sendEmail(env, {
 *     to: 'user@example.com',
 *     subject: '驗證您的 Tripline 帳號',
 *     html: ...,
 *     text: ...,
 *   });
 *
 * Best-effort：Resend API 失敗 → 拋 EmailError，caller 決定是否阻擋業務流程。
 *   - signup verify email failure → user 看 fallback 訊息「無法寄信，請使用重寄」
 *   - password reset failure → 同樣 fallback
 *   - 視為「不影響 user 帳號狀態」的 best-effort，但 audit log 仍記錄 failure
 */

export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string; // e.g. 'Tripline <no-reply@trip-planner-dby.pages.dev>'
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: true;
  /** Resend message id (for tracking) */
  id: string;
}

export class EmailError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail(
  env: EmailEnv,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    throw new EmailError('RESEND_API_KEY not configured', 500, null);
  }
  if (!env.EMAIL_FROM) {
    throw new EmailError('EMAIL_FROM not configured', 500, null);
  }

  const body = {
    from: env.EMAIL_FROM,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
  };

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let respBody: unknown = null;
  try {
    respBody = await res.json();
  } catch {
    /* non-json response — keep null */
  }

  if (!res.ok) {
    throw new EmailError(`Resend API ${res.status}`, res.status, respBody);
  }

  const idVal = (respBody as Record<string, unknown> | null)?.id;
  if (typeof idVal !== 'string') {
    throw new EmailError('Resend response missing id', res.status, respBody);
  }
  return { ok: true, id: idVal };
}
