/**
 * POST /api/trips/import — create a NEW trip from an exported v1 JSON file.
 *
 * Security: body is attacker-controlled. We enforce the real body size (read
 * text, cap, then parse — never trust Content-Length), run the pure validator
 * (_import.ts: allowlist reads, enum coercion, array + TOTAL caps, sort_order
 * renumber, segment dedup, prototype-pollution rejection), cap trips-per-user,
 * then build only parameterized statements.
 *
 * _tripCreation owns chunked writes, ID mapping and compensation. The import
 * boundary keeps source validation, defaults and authorization. Shared POIs use
 * fill-null; compensation removes newly created POIs, not prior shared fills.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md (PR3)
 */
import type { Env } from '../_types';
import { requireAuth, assertNotTripRestricted } from '../_auth';
import { json } from '../_utils';
import { AppError } from '../_errors';
import { parseAndValidateImport, MAX_IMPORT_BYTES, importCreationPlan } from './_import';
import { assertTripCap, generateUniqueTripId } from './_tripWrite';
import { createTrip } from './_tripCreation';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  // v2.55.56: 受限 token 只做單一 trip 內容編輯 — 不可匯入（建立新 trip）。
  assertNotTripRestricted(auth);
  if (!auth.userId) throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能匯入行程');

  // Enforce the REAL body size (Content-Length is attacker-controllable / may be
  // absent) — read the text, cap, then parse.
  const text = await context.request.text();
  if (text.length > MAX_IMPORT_BYTES) {
    throw new AppError('DATA_VALIDATION', `匯入檔過大（上限 ${Math.floor(MAX_IMPORT_BYTES / 1024)}KB）`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('DATA_VALIDATION', '不是有效的 JSON');
  }

  const result = parseAndValidateImport(raw);
  if (!result.ok) throw new AppError('DATA_VALIDATION', result.error);
  const data = result.data;

  const db = context.env.DB;

  // Cap trips-per-user (anti import-spam DoS).
  await assertTripCap(db, auth.userId);

  const tripId = await generateUniqueTripId(db, data.name);
  try {
    const created = await createTrip(db, importCreationPlan(data, tripId, auth.userId, auth.email || auth.userId));
    return json({ ok: true, ...created }, 201);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('SYS_DB_ERROR', '匯入失敗，請稍後重試');
  }
};
