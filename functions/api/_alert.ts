/**
 * alertAdminTelegram — send admin notification via Telegram Bot API.
 *
 * Used for silent-fail recovery (email send failed, trigger fetch failed,
 * config missing, etc). Reuses the same TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * (admin chat) as scripts/daily-check.
 *
 * Behaviour:
 * - env missing → console.warn + return（不 throw，避免影響 caller）
 * - fetch throw / non-2xx → console.error + return（fire-and-forget alert）
 * - 5s abort timeout
 *
 * Q10 decision: only Bearer auth on mailer endpoint, no IP ACL.
 * Q12 decision: no rate limit per IP.
 *
 * Defined in 2026-05-02-email-and-trigger-silent-fail-fix proposal.
 */

interface AlertEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export async function alertAdminTelegram(env: AlertEnv, message: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[alert] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set; alert skipped');
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚨 [Tripline] ${message}`,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[alert] Telegram API non-2xx:', res.status, errText);
    }
  } catch (err) {
    console.error('[alert] Telegram alert failed:', err instanceof Error ? err.message : err);
  }
}
