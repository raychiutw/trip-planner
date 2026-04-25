/**
 * /api/dev/apps/:client_id — V2-P4 OAuth client_app detail / update / suspend
 *
 * GET /api/dev/apps/:client_id
 *   require: session + ownership
 *   return: full client_app row (no client_secret_hash)
 *
 * PATCH /api/dev/apps/:client_id
 *   require: session + ownership
 *   body: { app_name?, app_description?, app_logo_url?, homepage_url?,
 *           redirect_uris?, allowed_scopes? }
 *   cannot: change client_id / client_type / status / owner_user_id / secret hash
 *
 * DELETE /api/dev/apps/:client_id
 *   require: session + ownership
 *   soft-delete: UPDATE status='suspended'（保留 audit trail，server-authorize 會擋）
 */
import { parseJsonBody } from '../../_utils';
import { requireSessionUser } from '../../_session';
import { AppError } from '../../_errors';
import type { Env } from '../../_types';

interface ClientAppRow {
  client_id: string;
  client_type: string;
  app_name: string;
  app_description: string | null;
  app_logo_url: string | null;
  homepage_url: string | null;
  redirect_uris: string;
  allowed_scopes: string;
  owner_user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PatchAppBody {
  app_name?: string;
  app_description?: string | null;
  app_logo_url?: string | null;
  homepage_url?: string | null;
  redirect_uris?: string[];
  allowed_scopes?: string[];
}

const APP_NAME_MIN = 2;
const APP_NAME_MAX = 80;

function snakeJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function shapeAppRow(row: ClientAppRow): Record<string, unknown> {
  return {
    client_id: row.client_id,
    client_type: row.client_type,
    app_name: row.app_name,
    app_description: row.app_description,
    app_logo_url: row.app_logo_url,
    homepage_url: row.homepage_url,
    redirect_uris: JSON.parse(row.redirect_uris) as string[],
    allowed_scopes: JSON.parse(row.allowed_scopes) as string[],
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateRedirectUris(uris: unknown): string[] {
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new AppError('DATA_VALIDATION', 'redirect_uris 必填且至少 1 個');
  }
  if (uris.length > 10) {
    throw new AppError('DATA_VALIDATION', 'redirect_uris 最多 10 個');
  }
  return uris.map((u, i) => {
    if (typeof u !== 'string' || u.length === 0) {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 格式無效`);
    }
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 不是合法 URL`);
    }
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLocalhost) {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 必須是 HTTPS（localhost 例外）`);
    }
    return u;
  });
}

async function loadOwnedApp(
  db: Env['DB'],
  clientId: string,
  ownerUserId: string,
): Promise<ClientAppRow | null> {
  return db
    .prepare(
      `SELECT client_id, client_type, app_name, app_description, app_logo_url,
              homepage_url, redirect_uris, allowed_scopes, owner_user_id, status,
              created_at, updated_at
       FROM client_apps
       WHERE client_id = ? AND owner_user_id = ?`,
    )
    .bind(clientId, ownerUserId)
    .first<ClientAppRow>();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const clientId = (context.params as { client_id?: string }).client_id;
  if (!clientId) throw new AppError('DATA_VALIDATION', 'client_id 必填');

  const row = await loadOwnedApp(context.env.DB, clientId, session.uid);
  if (!row) {
    return snakeJson({ error: { code: 'APP_NOT_FOUND', message: '找不到此應用' } }, 404);
  }
  return snakeJson(shapeAppRow(row));
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const clientId = (context.params as { client_id?: string }).client_id;
  if (!clientId) throw new AppError('DATA_VALIDATION', 'client_id 必填');

  const existing = await loadOwnedApp(context.env.DB, clientId, session.uid);
  if (!existing) {
    return snakeJson({ error: { code: 'APP_NOT_FOUND', message: '找不到此應用' } }, 404);
  }

  const body = (await parseJsonBody<PatchAppBody>(context.request)) ?? {};

  // Build dynamic UPDATE based on provided fields
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.app_name !== undefined) {
    const name = body.app_name.trim();
    if (name.length < APP_NAME_MIN || name.length > APP_NAME_MAX) {
      throw new AppError('DATA_VALIDATION', `app_name 長度需 ${APP_NAME_MIN}-${APP_NAME_MAX} 字`);
    }
    updates.push('app_name = ?');
    values.push(name);
  }
  if (body.app_description !== undefined) {
    updates.push('app_description = ?');
    values.push(body.app_description);
  }
  if (body.app_logo_url !== undefined) {
    updates.push('app_logo_url = ?');
    values.push(body.app_logo_url);
  }
  if (body.homepage_url !== undefined) {
    updates.push('homepage_url = ?');
    values.push(body.homepage_url);
  }
  if (body.redirect_uris !== undefined) {
    const uris = validateRedirectUris(body.redirect_uris);
    updates.push('redirect_uris = ?');
    values.push(JSON.stringify(uris));
  }
  if (body.allowed_scopes !== undefined) {
    if (!Array.isArray(body.allowed_scopes) || body.allowed_scopes.length === 0) {
      throw new AppError('DATA_VALIDATION', 'allowed_scopes 必須是非空陣列');
    }
    const cleaned = body.allowed_scopes
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .map((s) => s.trim());
    if (cleaned.length === 0) {
      throw new AppError('DATA_VALIDATION', 'allowed_scopes 必須包含有效字串');
    }
    updates.push('allowed_scopes = ?');
    values.push(JSON.stringify(cleaned));
  }

  if (updates.length === 0) {
    throw new AppError('DATA_VALIDATION', '沒有可更新的欄位');
  }

  updates.push("updated_at = datetime('now')");

  await context.env.DB
    .prepare(
      `UPDATE client_apps SET ${updates.join(', ')} WHERE client_id = ? AND owner_user_id = ?`,
    )
    .bind(...values, clientId, session.uid)
    .run();

  // Return updated row
  const updated = await loadOwnedApp(context.env.DB, clientId, session.uid);
  if (!updated) {
    throw new AppError('SYS_INTERNAL', 'app 更新後讀取失敗');
  }
  return snakeJson(shapeAppRow(updated));
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const clientId = (context.params as { client_id?: string }).client_id;
  if (!clientId) throw new AppError('DATA_VALIDATION', 'client_id 必填');

  const existing = await loadOwnedApp(context.env.DB, clientId, session.uid);
  if (!existing) {
    return snakeJson({ error: { code: 'APP_NOT_FOUND', message: '找不到此應用' } }, 404);
  }

  // Soft-delete: status='suspended'。保留 audit trail；server-authorize.ts 會
  // 擋 status != 'active'，所以 effective immediately。
  await context.env.DB
    .prepare(
      `UPDATE client_apps
       SET status = 'suspended', updated_at = datetime('now')
       WHERE client_id = ? AND owner_user_id = ?`,
    )
    .bind(clientId, session.uid)
    .run();

  return snakeJson({ ok: true, suspended_client_id: clientId });
};
