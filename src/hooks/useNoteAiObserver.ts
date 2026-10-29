import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '../components/shared/Toast';
import { apiFetch } from '../lib/apiClient';
import type { NoteAiDocType } from '../components/trip-notes/NoteAiExclusionsDialog';

export type NoteAiStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'timedOut';
export interface NoteAiJob {
  docType: NoteAiDocType;
  status: NoteAiStatus;
  jobId: number | null;
  requestId: number | null;
  generation: number;
  insertedCount: number;
  replacedCount: number;
  preservedManualCount: number;
  duplicateExcludedCount: number;
  suppressedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  startedAt: string | null;
  timeoutAt: string | null;
  completedAt: string | null;
  exclusionCount: number;
}

const TYPES: NoteAiDocType[] = ['lodging-tips', 'tips', 'emergency'];
const LABELS: Record<NoteAiDocType, string> = {
  'lodging-tips': '住宿在地建議',
  tips: '一般行前須知',
  emergency: '緊急聯絡',
};

function emptyJobs(): Record<NoteAiDocType, NoteAiJob> {
  return Object.fromEntries(TYPES.map((docType) => [docType, {
    docType, status: 'idle', jobId: null, requestId: null, generation: 0,
    insertedCount: 0, replacedCount: 0, preservedManualCount: 0,
    duplicateExcludedCount: 0, suppressedCount: 0, errorCode: null,
    errorMessage: null, createdAt: null, startedAt: null, timeoutAt: null,
    completedAt: null, exclusionCount: 0,
  }])) as Record<NoteAiDocType, NoteAiJob>;
}

export function isActiveAiJob(job: NoteAiJob): boolean {
  return job.status === 'pending' || job.status === 'processing';
}

type ReadStatus = 'loading' | 'fresh' | 'error';
interface Snapshot {
  tripId: string | undefined;
  jobs: Record<NoteAiDocType, NoteAiJob>;
  readStatus: ReadStatus;
  posting: NoteAiDocType[];
}

/** Trip-scoped note AI observer. Read failures never replace last-known jobs with idle. */
export function useNoteAiObserver(tripId: string | undefined, onCompleted: () => void) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    tripId, jobs: emptyJobs(), readStatus: 'loading', posting: [],
  }));
  const currentTripRef = useRef(tripId);
  currentTripRef.current = tripId;
  const requestRef = useRef(0);
  const tripEpochRef = useRef(0);
  const inFlightRef = useRef(false);
  const postingRef = useRef(new Set<NoteAiDocType>());
  const seenRef = useRef(false);
  const failedRef = useRef(false);
  const announcedRef = useRef(new Set<string>());
  const jobsRef = useRef(snapshot.jobs);

  useEffect(() => {
    const request = requestRef;
    requestRef.current++;
    tripEpochRef.current++;
    inFlightRef.current = false;
    postingRef.current.clear();
    seenRef.current = false;
    failedRef.current = false;
    announcedRef.current.clear();
    jobsRef.current = emptyJobs();
    setSnapshot({ tripId, jobs: jobsRef.current, readStatus: 'loading', posting: [] });
    return () => { request.current++; };
  }, [tripId]);

  const load = useCallback(async () => {
    if (!tripId || inFlightRef.current) return;
    inFlightRef.current = true;
    const token = ++requestRef.current;
    try {
      const response = await apiFetch<{ jobs?: Partial<NoteAiJob>[] }>(`/trips/${tripId}/notes/ai-state`);
      if (token !== requestRef.current || currentTripRef.current !== tripId) return;
      if (!Array.isArray(response.jobs) || response.jobs.length !== TYPES.length
        || new Set(response.jobs.map((job) => job.docType)).size !== TYPES.length
        || response.jobs.some((job) => !job.docType || !TYPES.includes(job.docType)
          || !['idle', 'pending', 'processing', 'completed', 'failed', 'timedOut'].includes(job.status ?? '')
          || typeof job.generation !== 'number')) {
        throw new Error('AI 狀態格式錯誤');
      }
      const next = emptyJobs();
      for (const raw of response.jobs) {
        if (!raw.docType || !TYPES.includes(raw.docType)) continue;
        next[raw.docType] = { ...next[raw.docType], ...raw };
      }
      let completedNow = false;
      for (const rawJob of Object.values(next)) {
        const previous = jobsRef.current[rawJob.docType];
        if (rawJob.generation < previous.generation) next[rawJob.docType] = previous;
        const job = next[rawJob.docType];
        if (!job.jobId || job.status !== 'completed') continue;
        const key = `${job.docType}:${job.jobId}`;
        if (!seenRef.current && !failedRef.current) {
          announcedRef.current.add(key);
        } else if (!announcedRef.current.has(key)) {
          announcedRef.current.add(key);
          completedNow = true;
          showToast(`${LABELS[job.docType]}生成完成`, 'success', 4000);
        }
      }
      if (completedNow) onCompleted();
      seenRef.current = true;
      failedRef.current = false;
      jobsRef.current = next;
      setSnapshot({ tripId, jobs: next, readStatus: 'fresh', posting: [...postingRef.current] });
    } catch {
      if (token !== requestRef.current || currentTripRef.current !== tripId) return;
      failedRef.current = true;
      setSnapshot((current) => ({ ...current, readStatus: 'error' }));
    } finally {
      if (token === requestRef.current) inFlightRef.current = false;
    }
  }, [tripId, onCompleted]);

  useEffect(() => { void load(); }, [load]);

  const active = Object.values(snapshot.jobs).some(isActiveAiJob);
  useEffect(() => {
    if (snapshot.tripId !== tripId || (!active && snapshot.readStatus !== 'error')) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [active, load, snapshot.readStatus, snapshot.tripId, tripId]);

  const trigger = useCallback(async (docType: NoteAiDocType) => {
    if (!tripId || snapshot.tripId !== tripId || snapshot.readStatus !== 'fresh'
      || isActiveAiJob(jobsRef.current[docType]) || postingRef.current.has(docType)) return;
    postingRef.current.add(docType);
    const tripEpoch = tripEpochRef.current;
    setSnapshot((current) => ({ ...current, posting: [...postingRef.current] }));
    try {
      const response = await apiFetch<Pick<NoteAiJob, 'jobId' | 'requestId' | 'status' | 'generation' | 'timeoutAt'>>(
        `/trips/${tripId}/notes/${docType}/generate`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (currentTripRef.current !== tripId || tripEpochRef.current !== tripEpoch) return;
      const jobs = {
        ...jobsRef.current,
        [docType]: {
          ...jobsRef.current[docType], ...response, createdAt: new Date().toISOString(),
          errorCode: null, errorMessage: null,
        },
      };
      if (response.generation >= jobsRef.current[docType].generation) {
        jobsRef.current = jobs;
        setSnapshot((current) => ({ ...current, jobs }));
      }
    } catch {
      if (currentTripRef.current !== tripId || tripEpochRef.current !== tripEpoch) return;
      // A rejected POST can still have started a job; only a fresh read can resolve it.
      failedRef.current = true;
      setSnapshot((current) => ({ ...current, readStatus: 'error' }));
    } finally {
      if (currentTripRef.current === tripId && tripEpochRef.current === tripEpoch) {
        postingRef.current.delete(docType);
        setSnapshot((current) => ({ ...current, posting: [...postingRef.current] }));
      }
    }
  }, [tripId, snapshot.readStatus, snapshot.tripId]);

  return {
    jobs: snapshot.tripId === tripId ? snapshot.jobs : emptyJobs(),
    readStatus: snapshot.tripId === tripId ? snapshot.readStatus : 'loading',
    posting: snapshot.tripId === tripId ? snapshot.posting : [],
    load,
    trigger,
  };
}
