/**
 * GET /api/requests/:id
 * PATCH /api/requests/:id  { reply, status, processed_by }
 */

import { logAudit, computeDiff } from '../../_audit';
import { hasPermission, requireAuth, requireScope } from '../../_auth';
import { AppError } from '../../_errors';
import { sanitizeReply } from '../../_validate';
import { json, parseJsonBody } from '../../_utils';
import type { Env } from '../../_types';

// GET /api/requests/:id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = requireAuth(context);
  const id = params.id as string;

  // 2026-05-07：LEFT JOIN users 取 display_name 給 chat avatar / sender label。
  const row = await env.DB
    .prepare('SELECT r.*, u.display_name AS submitted_by_display_name FROM trip_requests r LEFT JOIN users u ON u.email = r.submitted_by WHERE r.id = ?')
    .bind(id)
    .first();
  if (!row) throw new AppError('DATA_NOT_FOUND');

  const tripId = (row as Record<string, unknown>).trip_id as string;
  if (!await hasPermission(env.DB, auth, tripId)) {
    throw new AppError('PERM_DENIED');
  }

  return json(row);
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  // Phase 3（移除全域 admin）：只有帶 companion scope 的 service token 可 PATCH —
  // Claude CLI 回覆 chat + 標記完成/失敗是 companion 身份的核心職能。最小權限：
  // 純維運 token（如僅 ops:maps）無法誤觸發 chat 回覆 / notes hook。
  const auth = requireScope(context, 'companion');
  const id = params.id as string;

  const body = await parseJsonBody<{ reply?: string; status?: string; processed_by?: string }>(context.request);

  const updates: string[] = [];
  const values: string[] = [];

  if (body.reply !== undefined) {
    updates.push('reply = ?');
    values.push(sanitizeReply(body.reply));
  }
  // Fetch once for both status validation and audit diff
  const oldRow = await env.DB.prepare('SELECT * FROM trip_requests WHERE id = ?').bind(id).first() as Record<string, unknown> | null;

  if (body.status !== undefined) {
    const STATUS_ORDER = ['open', 'processing', 'completed', 'failed'] as const;
    if (!STATUS_ORDER.includes(body.status as typeof STATUS_ORDER[number])) {
      throw new AppError('DATA_VALIDATION', 'status 必須是 open、processing、completed 或 failed');
    }

    // 驗證 status 只能往前推進，不可回退（failed 例外：任何狀態都可標記失敗）
    if (oldRow && body.status !== 'failed') {
      const oldIdx = STATUS_ORDER.indexOf((oldRow.status as string) as typeof STATUS_ORDER[number]);
      const newIdx = STATUS_ORDER.indexOf(body.status as typeof STATUS_ORDER[number]);
      if (newIdx >= 0 && oldIdx >= 0 && newIdx < oldIdx) {
        throw new AppError('DATA_VALIDATION', `status 不可從 ${oldRow.status} 退回 ${body.status}`);
      }
    }

    updates.push('status = ?');
    values.push(body.status);
  }

  if (body.processed_by !== undefined) {
    const VALID_PROCESSORS = ['api', 'job'] as const;
    if (!VALID_PROCESSORS.includes(body.processed_by as typeof VALID_PROCESSORS[number])) {
      throw new AppError('DATA_VALIDATION', 'processed_by 必須是 api 或 job');
    }
    updates.push('processed_by = ?');
    values.push(body.processed_by);
  }

  if (updates.length === 0) {
    throw new AppError('DATA_VALIDATION', '沒有要更新的欄位');
  }

  // 每次 PATCH 自動更新 updated_at
  updates.push("updated_at = datetime('now')");

  values.push(id);
  const result = await env.DB
    .prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!result) {
    throw new AppError('DATA_NOT_FOUND', '找不到該請求');
  }

  const tripId = (result as Record<string, unknown>).trip_id as string;
  const newFields = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  );
  await logAudit(env.DB, {
    tripId,
    tableName: 'trip_requests',
    recordId: Number(id),
    action: 'update',
    changedBy: auth.email,
    diffJson: oldRow ? computeDiff(oldRow, newFields) : JSON.stringify(newFields),
  });

  // 行程筆記 PR10: notes generation linkage hook（唯一的 completion hook；AI 健檢功能移除時同步拔除其 hook）。
  // CR-8 confused-deputy fix — SELECT linkage row 是 authoritative signal
  // (POST /trips/:id/notes/:type/generate 唯一寫入點，service token 不會誤觸發)。
  const newStatus = (result as Record<string, unknown>).status as string;
  if (newStatus === 'completed' || newStatus === 'failed') {
    const notesJob = await env.DB
      .prepare('SELECT id, doc_type FROM trip_note_ai_jobs WHERE request_id = ? AND trip_id = ? LIMIT 1')
      .bind(Number(id), tripId)
      .first<{ id: number; doc_type: string }>();
    if (notesJob) {
      try {
        await applyNotesGenerationCompletion(env.DB, tripId, Number(id), notesJob.id, notesJob.doc_type, result as Record<string, unknown>);
      } catch (hookErr) {
        console.error('[requests] notes-generation completion hook failed:', hookErr);
      }
    }
  }

  return json(result);
};

async function rewriteRequestReply(db: D1Database, requestId: number, newReply: string): Promise<void> {
  await db
    .prepare(`UPDATE trip_requests SET reply = ? WHERE id = ?`)
    .bind(newReply, requestId)
    .run();
}

// ============================================================================
// v2.34.x 行程筆記 PR10: notes generation completion hook
// ============================================================================

const PRETRIP_AI_SOURCES: Record<string, string> = {
  'lodging-tips': 'lodging-tips',
  'tips': 'general-tips',
};

// notes items 是 title/content/name/phone 結構（非 severity findings），用獨立寬鬆 parser
function parseNotesItems(reply: string): unknown[] {
  if (!reply.trim()) return [];
  try {
    const parsed = JSON.parse(reply);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  const match = reply.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* give up */
    }
  }
  return [];
}

async function applyNotesGenerationCompletion(
  db: D1Database,
  tripId: string,
  requestId: number,
  jobId: number,
  docType: string,
  request: Record<string, unknown>,
) {
  const status = request.status as string;
  if (status === 'failed') {
    const errMsg = (request.reply as string) || 'AI 生成失敗';
    await db
      .prepare(
        `UPDATE trip_note_ai_jobs SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`,
      )
      .bind(errMsg.slice(0, 500), jobId)
      .run();
    await rewriteRequestReply(db, requestId, `AI 生成失敗 — ${errMsg.slice(0, 200)}\n\n可重試：[前往行程筆記 →](/trip/${tripId}/notes)`);
    return;
  }

  const reply = (request.reply as string) || '';
  const items = parseNotesItems(reply); // notes 不需 severity，獨立 parser
  let insertedCount = 0;
  const validItems = items.filter((it): it is Record<string, unknown> => it !== null && typeof it === 'object');

  // PR27: AI 觸發人 → audit changedBy（fallback 'system:ai' 處理舊資料 submitted_by NULL）
  const aiActor = (typeof request.submitted_by === 'string' && request.submitted_by.length > 0)
    ? `ai:${request.submitted_by}`
    : 'system:ai';

  // Dedup against existing rows for this trip/type — case-insensitive title compare
  if (docType === 'lodging-tips' || docType === 'tips') {
    const aiSource = PRETRIP_AI_SOURCES[docType];
    const existing = await db
      .prepare(
        // Scope dedup to the same ai_source — lodging-tips and tips are distinct
        // prompts; a trip-wide title set cross-contaminates them.
        `SELECT LOWER(TRIM(title)) AS k FROM trip_pretrip_notes WHERE trip_id = ? AND ai_source = ?`,
      )
      .bind(tripId, aiSource)
      .all<{ k: string }>();
    const seen = new Set((existing.results ?? []).map((r) => r.k));
    const maxOrder = await db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM trip_pretrip_notes WHERE trip_id = ?`)
      .bind(tripId)
      .first<{ m: number }>();
    let nextOrder = (maxOrder?.m ?? -1) + 1;
    for (const it of validItems) {
      const title = typeof it.title === 'string' ? it.title.trim().slice(0, 100) : '';
      const content = typeof it.content === 'string' ? it.content.slice(0, 1000) : '';
      const section = typeof it.section === 'string' ? it.section.trim().slice(0, 50) : '';
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const inserted = await db
        .prepare(
          `INSERT INTO trip_pretrip_notes (trip_id, sort_order, section, title, content, ai_generated, ai_source) VALUES (?, ?, ?, ?, ?, 1, ?) RETURNING *`,
        )
        .bind(tripId, nextOrder++, section, title, content, aiSource)
        .first<Record<string, unknown>>();
      insertedCount++;

      // PR27: AI 寫入 audit_log（user_email → ai:<email>，submitted_by NULL → system:ai）
      if (inserted) {
        await logAudit(db, {
          tripId,
          tableName: 'trip_pretrip_notes',
          recordId: inserted.id as number,
          action: 'insert',
          changedBy: aiActor,
          requestId,
          diffJson: JSON.stringify(inserted),
        });
      }
    }
  } else if (docType === 'emergency') {
    const existing = await db
      .prepare(`SELECT LOWER(TRIM(name)) AS k FROM trip_emergency_contacts WHERE trip_id = ?`)
      .bind(tripId)
      .all<{ k: string }>();
    const seen = new Set((existing.results ?? []).map((r) => r.k));
    const maxOrder = await db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM trip_emergency_contacts WHERE trip_id = ?`)
      .bind(tripId)
      .first<{ m: number }>();
    let nextOrder = (maxOrder?.m ?? -1) + 1;
    const VALID_KINDS = ['personal', 'embassy', 'police', 'medical', 'insurance', 'hotel', 'other'];
    for (const it of validItems) {
      const name = typeof it.name === 'string' ? it.name.trim().slice(0, 100) : '';
      const phone = typeof it.phone === 'string' ? it.phone.trim().slice(0, 50) : '';
      const relationship = typeof it.relationship === 'string' ? it.relationship.trim().slice(0, 100) : '';
      const kindRaw = typeof it.kind === 'string' ? it.kind.toLowerCase().trim() : 'other';
      const kind = VALID_KINDS.includes(kindRaw) ? kindRaw : 'other';
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const inserted = await db
        .prepare(
          `INSERT INTO trip_emergency_contacts (trip_id, sort_order, name, relationship, phone, kind, ai_generated) VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING *`,
        )
        .bind(tripId, nextOrder++, name, relationship, phone, kind)
        .first<Record<string, unknown>>();
      insertedCount++;

      // PR27: AI 寫入 audit_log
      if (inserted) {
        await logAudit(db, {
          tripId,
          tableName: 'trip_emergency_contacts',
          recordId: inserted.id as number,
          action: 'insert',
          changedBy: aiActor,
          requestId,
          diffJson: JSON.stringify(inserted),
        });
      }
    }
  }

  await db
    .prepare(
      `UPDATE trip_note_ai_jobs SET status = 'completed', inserted_count = ?, error_message = NULL, completed_at = datetime('now') WHERE id = ?`,
    )
    .bind(insertedCount, jobId)
    .run();

  // Rewrite trip_requests.reply 為 user-friendly summary
  const summary = insertedCount > 0
    ? `AI 生成完成 — 已新增 ${insertedCount} 個項目（${docType}）。\n\n[前往行程筆記 →](/trip/${tripId}/notes)`
    : `AI 生成完成 — 沒有新項目可加（既有資料已涵蓋）。\n\n[前往行程筆記 →](/trip/${tripId}/notes)`;
  await rewriteRequestReply(db, requestId, summary);
}
