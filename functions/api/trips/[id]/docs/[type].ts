import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';

const VALID_TYPES = new Set(['flights', 'checklist', 'backup', 'suggestions', 'emergency']);

// ---------------------------------------------------------------------------
// GET /api/trips/:id/docs/:type — 回傳 { doc_type, title, entries }
// ---------------------------------------------------------------------------
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, type } = context.params as { id: string; type: string };
  if (!VALID_TYPES.has(type)) throw new AppError('DATA_VALIDATION', '無效的文件類型');

  const db = context.env.DB;

  const doc = await db
    .prepare('SELECT id, doc_type, title, updated_at FROM trip_docs_v2 WHERE trip_id = ? AND doc_type = ?')
    .bind(id, type)
    .first<{ id: number; doc_type: string; title: string; updated_at: string }>();

  if (!doc) throw new AppError('DATA_NOT_FOUND');

  const entries = await db
    .prepare('SELECT id, sort_order, section, title, content FROM trip_doc_entries WHERE doc_id = ? ORDER BY sort_order')
    .bind(doc.id)
    .all();

  return json({
    doc_type: doc.doc_type,
    title: doc.title,
    updated_at: doc.updated_at,
    entries: entries.results,
  });
};

// ---------------------------------------------------------------------------
// PUT /api/trips/:id/docs/:type — 接收 { title, entries: [{section, title, content}] }
// ---------------------------------------------------------------------------
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, type } = context.params as { id: string; type: string };
  if (!VALID_TYPES.has(type)) throw new AppError('DATA_VALIDATION', '無效的文件類型');

  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const bodyOrError = await parseJsonBody<{
    title?: string;
    entries?: { sort_order?: number; section?: string; title?: string; content?: string }[];
    // 向舊格式相容：如果 body 有 content 字串，自動轉換
    content?: string;
  }>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  let docTitle = body.title ?? '';
  let entries = body.entries ?? [];

  // 相容舊格式：如果 body.content 是 JSON 字串（舊 tp-create 格式），自動 parse
  if (entries.length === 0 && typeof body.content === 'string') {
    try {
      const parsed = JSON.parse(body.content);
      docTitle = parsed.title || docTitle;
      // 舊格式無法自動轉 entries，存為單一 entry
      const inner = parsed.content || parsed;
      entries = [{ section: '', title: '', content: JSON.stringify(inner) }];
    } catch {
      entries = [{ section: '', title: '', content: body.content }];
    }
  }

  const changedBy = auth.email;

  // Upsert doc
  const docResult = await db
    .prepare('INSERT INTO trip_docs_v2 (trip_id, doc_type, title, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(trip_id, doc_type) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP RETURNING id')
    .bind(id, type, docTitle)
    .first<{ id: number }>();

  if (!docResult) throw new AppError('SYS_INTERNAL', 'doc upsert failed');
  const docId = docResult.id;

  // 刪除舊 entries + 插入新 entries
  const batch: D1PreparedStatement[] = [
    db.prepare('DELETE FROM trip_doc_entries WHERE doc_id = ?').bind(docId),
  ];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    batch.push(
      db.prepare('INSERT INTO trip_doc_entries (doc_id, sort_order, section, title, content) VALUES (?, ?, ?, ?, ?)')
        .bind(docId, e.sort_order ?? i, e.section ?? '', e.title ?? '', e.content ?? '')
    );
  }

  await db.batch(batch);

  await logAudit(db, {
    tripId: id,
    tableName: 'trip_docs_v2',
    recordId: docId,
    action: 'update',
    changedBy,
    diffJson: JSON.stringify({ doc_type: type, entries_count: entries.length }),
  });

  return json({ ok: true });
};
