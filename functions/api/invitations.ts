/**
 * GET /api/invitations?token=xxx — V2 共編邀請查詢
 *
 * Lookup by HMAC(SESSION_SECRET, raw_token) → trip_invitations row + JOIN trips
 * + JOIN users (inviter info)。三種失敗 case 共用 410 GONE：
 *   - INVITATION_INVALID  : token_hash 找不到 row
 *   - INVITATION_EXPIRED  : expires_at < now
 *   - INVITATION_ACCEPTED : accepted_at IS NOT NULL（避免重複觸發 / 防 replay）
 *
 * Public endpoint (不需 session) — 讓未登入者可預覽 invitation 內容後決定 login/signup。
 *
 * 為何 410 不是 404：被邀請者點 link 時收到「已過期」是正常 lifecycle 結尾，semantic 是
 * gone (was here, no longer)，不是 not found。
 */
import { hashInvitationToken } from '../../src/server/invitation-token';
import type { Env } from './_types';

interface InvitationRow {
  trip_id: string;
  trip_title: string;
  invited_email: string;
  inviter_display_name: string | null;
  inviter_email: string;
  expires_at: string;
  accepted_at: string | null;
}

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const rawToken = (url.searchParams.get('token') ?? '').trim();

  if (!rawToken) {
    return errorResponse('INVITATION_TOKEN_MISSING', '邀請連結缺少 token 參數', 400);
  }

  if (!context.env.SESSION_SECRET) {
    return errorResponse('SERVER_MISCONFIG', 'SESSION_SECRET 未設定', 500);
  }

  const tokenHash = await hashInvitationToken(rawToken, context.env.SESSION_SECRET);

  const row = await context.env.DB
    .prepare(
      `SELECT
         ti.trip_id,
         t.title AS trip_title,
         ti.invited_email,
         u.display_name AS inviter_display_name,
         u.email AS inviter_email,
         ti.expires_at,
         ti.accepted_at
       FROM trip_invitations ti
       JOIN trips t ON t.id = ti.trip_id
       JOIN users u ON u.id = ti.invited_by
       WHERE ti.token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<InvitationRow>();

  if (!row) {
    return errorResponse('INVITATION_INVALID', '邀請連結無效，請聯絡邀請者重寄', 410);
  }

  if (row.accepted_at) {
    return errorResponse('INVITATION_ACCEPTED', '此邀請已接受過，請直接登入', 410);
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return errorResponse('INVITATION_EXPIRED', '邀請已過期，請聯絡邀請者重寄', 410);
  }

  return new Response(
    JSON.stringify({
      tripId: row.trip_id,
      tripTitle: row.trip_title,
      invitedEmail: row.invited_email,
      inviterDisplayName: row.inviter_display_name,
      inviterEmail: row.inviter_email,
      expiresAt: row.expires_at,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};
