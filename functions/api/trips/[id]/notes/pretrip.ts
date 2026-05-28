/**
 * GET /api/trips/:id/notes/pretrip — list trip_pretrip_notes
 * v2.34.x 行程筆記 PR2
 */
import type { Env } from '../../../_types';
import { listNotesSection } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) =>
  listNotesSection(context, 'trip_pretrip_notes');
