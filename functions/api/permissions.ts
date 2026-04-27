/**
 * GET  /api/permissions?tripId=xxx  — 列出行程權限
 * POST /api/permissions { email, tripId, role? } — 新增權限 / 寄邀請
 *
 * V2-P7 PR-O: 從「admin only」放寬為「admin OR trip owner」。
 * V2 共編分享信改寫（task 5/9, 2026-04-27）：拔 CF Access 死代碼（V2-P6 cutover 後
 * Access 已拆），改成兩條分支：
 *   - existing user (users.email match)：INSERT trip_permissions + 寄通知信「[Inviter]
 *     邀請你加入 [Trip]」（isExistingUser=true → CTA「登入並加入」）
 *   - new email：產 invitation token + INSERT trip_invitations + 寄含 signup link 的
 *     邀請信（isExistingUser=false → CTA「註冊並加入」）
 *
 * 兩條分支 response shape 對齊 anti-enumeration（status 區分但 201 + email 一致）。
 * Email 寄送 best-effort（失敗不 rollback）。
 */

import { logAudit } from './_audit';
import { AppError } from './_errors';
import { json, getAuth, parseJsonBody } from './_utils';
import { sendEmail, EmailError } from '../../src/server/email';
import { tripInvitation } from '../../src/server/email-templates';
import {
  generateInvitationToken,
  invitationExpiresAt,
} from '../../src/server/invitation-token';
import type { Env } from './_types';

/** 檢查 auth user 是否為該 trip 的 owner（admin 自動 pass）。 */
export async function ensureCanManageTripPerms(
  context: { env: Env },
  auth: { email: string; isAdmin: boolean },
  tripId: string,
): Promise<void> {
  if (auth.isAdmin) return;
  const owner = await context.env.DB
    .prepare('SELECT owner FROM trips WHERE id = ?')
    .bind(tripId)
    .first<{ owner: string | null }>();
  if (!owner) throw new AppError('DATA_NOT_FOUND', '找不到該行程');
  if ((owner.owner ?? '').toLowerCase() !== auth.email.toLowerCase()) {
    throw new AppError('PERM_ADMIN_ONLY', '僅行程擁有者或管理者可操作共編');
  }
}

// GET /api/permissions?tripId=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const url = new URL(context.request.url);
  const tripId = url.searchParams.get('tripId');

  if (!tripId) {
    throw new AppError('DATA_VALIDATION', '缺少 tripId 參數');
  }

  await ensureCanManageTripPerms(context, auth, tripId);

  const { results } = await context.env.DB
    .prepare(
      'SELECT id, email, trip_id, role, user_id FROM trip_permissions WHERE trip_id = ? ORDER BY email',
    )
    .bind(tripId)
    .all();

  return json(results);
};

/** Best-effort send invitation email — 兩條分支共用，失敗 console.error 但不擋業務流程。 */
async function sendInvitationEmailBestEffort(
  env: Env,
  params: {
    to: string;
    inviteUrl: string;
    inviterDisplayName: string | null;
    inviterEmail: string;
    tripTitle: string;
    isExistingUser: boolean;
  },
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return;
  const tpl = tripInvitation({
    inviteUrl: params.inviteUrl,
    inviterDisplayName: params.inviterDisplayName,
    inviterEmail: params.inviterEmail,
    tripTitle: params.tripTitle,
    isExistingUser: params.isExistingUser,
  });
  try {
    await sendEmail(env, {
      to: params.to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
  } catch (emailErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[permissions] invitation email send failed:',
      emailErr instanceof EmailError
        ? `${emailErr.status} ${emailErr.message}`
        : (emailErr as Error).message,
    );
  }
}

// POST /api/permissions { email, tripId, role? }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const body = await parseJsonBody<{ email?: string; tripId?: string; role?: string }>(
    context.request,
  );

  const { email, tripId, role = 'member' } = body;
  if (!email || !tripId) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：email, tripId');
  }

  if (role !== 'member' && role !== 'admin') {
    throw new AppError('DATA_VALIDATION', "role 必須為 'member' 或 'admin'");
  }

  await ensureCanManageTripPerms(context, auth, tripId);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('DATA_VALIDATION', 'email 格式不正確');
  }

  const lowerEmail = email.toLowerCase();

  // Lookup invited user — 決定走 existing-user vs new-email 分支
  const invitedUser = await context.env.DB
    .prepare('SELECT id, display_name FROM users WHERE email = ? LIMIT 1')
    .bind(lowerEmail)
    .first<{ id: string; display_name: string | null }>();

  // Trip title + inviter info 兩條分支共用（寄信都需要）
  const [trip, inviter] = await Promise.all([
    context.env.DB
      .prepare('SELECT title FROM trips WHERE id = ?')
      .bind(tripId)
      .first<{ title: string }>(),
    context.env.DB
      .prepare('SELECT display_name, email FROM users WHERE email = ? LIMIT 1')
      .bind(auth.email.toLowerCase())
      .first<{ display_name: string | null; email: string }>(),
  ]);
  const tripTitle = trip?.title ?? tripId;
  const inviterDisplayName = inviter?.display_name ?? null;
  const inviterEmail = inviter?.email ?? auth.email;

  if (invitedUser) {
    // ===== Branch A: invited email 已註冊 =====
    let permRow: { id: number };
    try {
      const row = await context.env.DB
        .prepare(
          `INSERT INTO trip_permissions (email, trip_id, role, user_id)
           VALUES (?, ?, ?, ?) RETURNING *`,
        )
        .bind(lowerEmail, tripId, role, invitedUser.id)
        .first<{ id: number }>();
      if (!row) throw new AppError('SYS_INTERNAL', 'INSERT RETURNING 未回傳資料');
      permRow = row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        throw new AppError('DATA_CONFLICT', '此 email 已有此行程的權限');
      }
      throw err;
    }

    await logAudit(context.env.DB, {
      tripId,
      tableName: 'trip_permissions',
      recordId: permRow.id,
      action: 'insert',
      changedBy: auth.email,
      diffJson: JSON.stringify({ email: lowerEmail, role, source: 'direct_add' }),
    });

    // Best-effort send notification email（isExistingUser=true → CTA「登入並加入」）
    // 已註冊者直接 redirect /trips?selected=tripId（不需 token）
    await sendInvitationEmailBestEffort(context.env, {
      to: lowerEmail,
      inviteUrl: `${new URL(context.request.url).origin}/trips?selected=${encodeURIComponent(tripId)}`,
      inviterDisplayName,
      inviterEmail,
      tripTitle,
      isExistingUser: true,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'permission_added',
        email: lowerEmail,
        id: permRow.id,
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  }

  // ===== Branch B: invited email 未註冊 → 產 invitation token =====
  if (!context.env.SESSION_SECRET) {
    throw new AppError('SYS_INTERNAL', 'SESSION_SECRET 未設定');
  }

  // Need inviter user_id for invited_by FK
  const inviterRow = await context.env.DB
    .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .bind(auth.email.toLowerCase())
    .first<{ id: string }>();
  if (!inviterRow) {
    throw new AppError('SYS_INTERNAL', '邀請者帳號不存在');
  }

  const { rawToken, tokenHash } = await generateInvitationToken(context.env.SESSION_SECRET);
  const expiresAt = invitationExpiresAt(7);

  try {
    await context.env.DB
      .prepare(
        `INSERT INTO trip_invitations (token_hash, trip_id, invited_email, role, invited_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(tokenHash, tripId, lowerEmail, role, inviterRow.id, expiresAt)
      .run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new AppError('DATA_CONFLICT', '此 email 已有 pending 邀請（請改用重寄）');
    }
    throw err;
  }

  await logAudit(context.env.DB, {
    tripId,
    tableName: 'trip_invitations',
    recordId: null,
    action: 'insert',
    changedBy: auth.email,
    diffJson: JSON.stringify({ invited_email: lowerEmail, role, expires_at: expiresAt }),
  });

  // Best-effort send invitation email（含 raw token in URL）
  await sendInvitationEmailBestEffort(context.env, {
    to: lowerEmail,
    inviteUrl: `${new URL(context.request.url).origin}/invite?token=${encodeURIComponent(rawToken)}`,
    inviterDisplayName,
    inviterEmail,
    tripTitle,
    isExistingUser: false,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      status: 'invitation_sent',
      email: lowerEmail,
      expiresAt,
    }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
};
