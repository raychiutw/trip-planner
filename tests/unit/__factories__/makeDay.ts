/**
 * makeDay — Day fixture aligned with /api/trips/:id/days/:num response.
 */
import type { Day, Entry } from '../../../src/types/trip';
import { makeEntry } from './makeEntry';

export interface MakeDayInput extends Partial<Day> {
  entryCount?: number;
}

let dayCounter = 0;

export function makeDay(input: MakeDayInput = {}): Day {
  dayCounter += 1;
  const id = input.id ?? dayCounter;
  const dayNum = input.dayNum ?? dayCounter;
  const timeline: Entry[] =
    input.timeline ?? Array.from({ length: input.entryCount ?? 0 }, () => makeEntry({ dayId: id }));
  return {
    id,
    dayNum,
    date: `2026-07-${String(25 + dayNum).padStart(2, '0')}`,
    dayOfWeek: '六',
    label: `Day ${dayNum}`,
    title: null,
    updatedAt: '2026-05-24T00:00:00.000Z',
    hotel: null,
    timeline,
    ...input,
  };
}
