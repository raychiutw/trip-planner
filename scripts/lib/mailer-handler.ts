/**
 * mailer-handler — POST /internal/mail/send 處理邏輯
 *
 * Pure function with DI（verifyAuth / transporter / emailFrom / log），方便 unit test
 * 不依賴 Bun.serve / process.env / nodemailer.createTransport 直接 wire。
 *
 * 由 scripts/tripline-api-server.ts 透過 makeMailHandler() 注入真實 deps 後使用。
 */

import type { Transporter } from 'nodemailer';

export interface MailRequestBody {
  to?: string;
  subject?: string;
  html?: string;
  template?: string;
}

export interface MailHandlerDeps {
  verifyAuth: (req: Request) => boolean;
  transporter: () => Transporter;
  emailFrom: string;
  log?: (msg: string) => void;
  logError?: (msg: string) => void;
}

export function makeMailHandler(deps: MailHandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (!deps.verifyAuth(req)) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    let body: MailRequestBody;
    try {
      body = (await req.json()) as MailRequestBody;
    } catch {
      return jsonResponse({ error: 'bad json' }, 400);
    }

    const { to, subject, html, template } = body;
    if (!to || !subject || !html) {
      return jsonResponse({ error: 'missing to/subject/html' }, 400);
    }

    try {
      const t0 = Date.now();
      const info = await deps.transporter().sendMail({
        from: deps.emailFrom,
        to,
        subject,
        html,
      });
      const elapsed = Date.now() - t0;
      deps.log?.(
        `mail sent: template=${template ?? '-'} to=${to} messageId=${info.messageId} ${elapsed}ms`,
      );
      return jsonResponse({
        ok: true,
        messageId: info.messageId,
        elapsed,
        template: template ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deps.logError?.(
        `mail send failed: template=${template ?? '-'} to=${to} error=${msg}`,
      );
      return jsonResponse({ error: msg }, 500);
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
