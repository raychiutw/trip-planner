/**
 * TripDaysContext — lightweight day-list snapshot for descendants.
 *
 * Why separate from TripContext: TripContext carries the full `useTrip` return
 * (heavy — trip / days / currentDay / docs / loading / error). Many edit
 * affordances（V3 inline expand 的 ⎘ copy / ⇅ move popover）only need a tiny
 * `DayOption[]` slice — day picker source data. This context exposes the
 * minimal shape so RailRow can consume without prop-drill chains.
 *
 * Provider: TripPage（v2.10 Wave 1）。
 * Consumer: TimelineRail RailRow → EntryActionPopover。
 */

import { createContext, useContext } from 'react';
import type { DayOption } from '../components/trip/EntryActionPopover';

export const TripDaysContext = createContext<DayOption[] | null>(null);

export function useTripDays(): DayOption[] {
  return useContext(TripDaysContext) ?? [];
}
