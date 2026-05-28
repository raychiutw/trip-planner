/**
 * GET /api/trips/:id/notes/emergency — list trip_emergency_contacts
 * v2.34.x 行程筆記 PR2
 */
import type { Env } from '../../../_types';
import { listNotesSection } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) =>
  listNotesSection(context, 'trip_emergency_contacts');
