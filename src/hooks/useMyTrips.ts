/**
 * Accessible trip summaries from /my-trips for the chat and sidebar.
 * Account-keyed initial reads share one request; update events start fresh reads.
 * Only the newest response can publish. A failed read keeps the last known list
 * with error status, so selection never treats failure as a confirmed empty list.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from '../lib/apiClient';
import { EVENT } from '../lib/events';

export interface MyTrip {
  tripId: string;
  name: string;
  title?: string | null;
  countries?: string | null;
  totalDays?: number;
  startDate?: string | null;
  endDate?: string | null;
  dayCount?: number;
  owner?: string;
  ownerDisplayName?: string | null;
  memberCount?: number;
  archivedAt?: string | null;
  published?: number | boolean;
}

type ListStatus = 'loading' | 'success' | 'error';
type Snapshot = { trips: MyTrip[] | undefined; status: ListStatus; userId: string | null };
let snapshot: Snapshot = { trips: undefined, status: 'loading', userId: null };
let requestVersion = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  const userId = snapshot.userId;
  if (!userId) return Promise.resolve();
  const version = ++requestVersion;
  publish({ ...snapshot, status: 'loading' });
  const task = apiFetch<MyTrip[]>('/my-trips').then((result) => {
    if (version !== requestVersion || userId !== snapshot.userId) return;
    publish({ userId, status: 'success', trips: Array.isArray(result) ? result : [] });
  }).catch(() => {
    if (version !== requestVersion || userId !== snapshot.userId) return;
    publish({ ...snapshot, status: 'error' });
  }).finally(() => { if (pending === task) pending = null; });
  pending = task;
  return task;
}

function onTripsUpdated() { void refresh(); }
const refreshEvents = [EVENT.tripsUpdated, EVENT.tripCreated, EVENT.tripUpdated, EVENT.tripDeleted];
function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    refreshEvents.forEach((name) => window.addEventListener(name, onTripsUpdated));
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      refreshEvents.forEach((name) => window.removeEventListener(name, onTripsUpdated));
    }
  };
}

/** Clears the existing module cache between isolated browser tests. */
export function __clearMyTripsCache(): void {
  requestVersion++;
  pending = null;
  publish({ trips: undefined, status: 'loading', userId: null });
}

/** Unauthenticated consumers never receive a prior account's accessible summaries. */
export function useMyTrips(userId: string | null | undefined): { trips: MyTrip[] | undefined; status: ListStatus } {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    if (!userId) return;
    if (snapshot.userId !== userId) {
      requestVersion++;
      pending = null;
      publish({ userId, trips: undefined, status: 'loading' });
    }
    if (snapshot.trips === undefined && !pending) void refresh();
  }, [userId]);
  if (!userId || current.userId !== userId) return { trips: undefined, status: 'loading' };
  return { trips: current.trips, status: current.status };
}
