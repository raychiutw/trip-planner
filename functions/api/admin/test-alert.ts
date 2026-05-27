/**
 * POST /api/admin/test-alert — admin-only test endpoint (v2.33.134)
 *
 * 觸發一次 alertAdminTelegram + 回完整 forensic info：env 是否設、token/chat
 * prefix 是否與 expected 一致、telegram API response 細節。
 *
 * 用途：CF Pages 端 Telegram alert 在 prod 為何 silent fail forensic。
 * wrangler pages deployment tail 跑時看 console output。
 */

import { requireAuth } from '../_auth';
import { AppError } from '../_errors';
import { json } from '../_utils';
import { alertAdminTelegram } from '../_alert';
import type { Env } from '../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.isAdmin) {
    throw new AppError('PERM_DENIED', 'admin only');
  }

  const env = context.env as unknown as Record<string, string | undefined>;
  const token = env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = env.TELEGRAM_CHAT_ID ?? '';

  const diag = {
    env: {
      hasToken: !!token,
      tokenPrefix: token ? token.slice(0, 10) : null,
      hasChatId: !!chatId,
      chatTail: chatId ? chatId.slice(-4) : null,
    },
    timestamp: new Date().toISOString(),
  };

  // alertAdminTelegram 本身 console.log 詳細狀態，wrangler tail 看
  await alertAdminTelegram(
    context.env,
    `🧪 test-alert from /api/admin/test-alert at ${new Date().toISOString()} by ${auth.email}`,
  );

  return json({ ok: true, ...diag });
};
