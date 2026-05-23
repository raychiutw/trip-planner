/**
 * GET /api/trips/:id/docs — batch fetch 全部 trip docs (v2.33.35 simplify PR-8).
 *
 * 取代 useTrip 啟動時對 5 個 doc_type 的 5 個 sequential CF Function calls
 * (10 D1 queries) → 1 個 CF Function call + 2 D1 queries (docs + entries IN)。
 *
 * Response shape:
 *   { docs: { flights: { doc_type, title, entries, updated_at } | null, ... } }
 *
 * doc 不存在 → key value 為 null（caller 不需 catch DATA_NOT_FOUND per doc）。
 */
import { requireTripReadAccess } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth } from '../../../_utils';
import type { Env } from '../../../_types';

const VALID_TYPES = ['flights', 'checklist', 'backup', 'suggestions', 'emergency'] as const;
type DocType = (typeof VALID_TYPES)[number];

interface DocRow {
  id: number;
  doc_type: string;
  title: string;
  updated_at: string;
}

interface EntryRow {
  doc_id: number;
  id: number;
  sort_order: number;
  section: string;
  title: string;
  content: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  if (!id) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;

  // v2.33.41 security: gate anonymous read — published trips allow, otherwise
  // owner/member only。
  await requireTripReadAccess(db, getAuth(context), id);

  // 1) 拿全部 docs for this trip
  const docsRes = await db
    .prepare('SELECT id, doc_type, title, updated_at FROM trip_docs WHERE trip_id = ?')
    .bind(id)
    .all<DocRow>();

  const docs = docsRes.results ?? [];

  // 2) 一次 IN query 拿全部 entries
  const docIds = docs.map((d) => d.id);
  const entriesByDocId = new Map<number, Array<Omit<EntryRow, 'doc_id'>>>();
  if (docIds.length > 0) {
    const placeholders = docIds.map(() => '?').join(',');
    const entriesRes = await db
      .prepare(
        `SELECT doc_id, id, sort_order, section, title, content
         FROM trip_doc_entries
         WHERE doc_id IN (${placeholders})
         ORDER BY doc_id ASC, sort_order ASC`,
      )
      .bind(...docIds)
      .all<EntryRow>();
    for (const e of entriesRes.results ?? []) {
      const arr = entriesByDocId.get(e.doc_id) ?? [];
      arr.push({ id: e.id, sort_order: e.sort_order, section: e.section, title: e.title, content: e.content });
      entriesByDocId.set(e.doc_id, arr);
    }
  }

  // 3) Shape response — 每個 doc_type key 永遠 present，doc 不存在 = null
  const out: Record<DocType, unknown> = {
    flights: null,
    checklist: null,
    backup: null,
    suggestions: null,
    emergency: null,
  };
  for (const doc of docs) {
    if (!VALID_TYPES.includes(doc.doc_type as DocType)) continue;
    out[doc.doc_type as DocType] = {
      doc_type: doc.doc_type,
      title: doc.title,
      updated_at: doc.updated_at,
      entries: entriesByDocId.get(doc.id) ?? [],
    };
  }

  return json({ docs: out });
};
