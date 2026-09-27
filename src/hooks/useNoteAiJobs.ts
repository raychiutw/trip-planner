import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {apiFetch} from '../lib/apiClient';
import {ApiError} from '../lib/errors';
import type {NoteAiDocType} from '../components/trip-notes/NoteAiExclusionsDialog';

type NoteAiStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'timedOut';

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

const NOTE_AI_TYPES: NoteAiDocType[] = ['lodging-tips', 'tips', 'emergency'];
function emptyAiJobs(): Record<NoteAiDocType, NoteAiJob> {
  return Object.fromEntries(NOTE_AI_TYPES.map((docType) => [docType, {
    docType,
    status: 'idle',
    jobId: null,
    requestId: null,
    generation: 0,
    insertedCount: 0,
    replacedCount: 0,
    preservedManualCount: 0,
    duplicateExcludedCount: 0,
    suppressedCount: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: null,
    startedAt: null,
    timeoutAt: null,
    completedAt: null,
    exclusionCount: 0,
  }])) as Record<NoteAiDocType, NoteAiJob>;
}

export function isActiveAiJob(job: NoteAiJob): boolean {
  return job.status === 'pending' || job.status === 'processing';
}


/** Owns observation and generation for one trip visit; notes remain independently usable. */
export function useNoteAiJobs(tripId: string | undefined, onCompleted: (job: NoteAiJob, announce: boolean) => void) {
  const [jobs, setJobs] = useState(emptyAiJobs);
  const [readStatus, setReadStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [submitting, setSubmitting] = useState<Set<NoteAiDocType>>(new Set());
  const [triggerError, setTriggerError] = useState('');
  const currentJobs = useRef(jobs);
  const pending = useRef(new Set<NoteAiDocType>());
  const lifetime = useMemo(() => ({visit: 0, request: 0}), []);
  const inFlight = useRef(false);
  const loaded = useRef(false);
  const readFailed = useRef(false);
  const announced = useRef(new Set<string>());
  const completion = useRef(onCompleted);
  completion.current = onCompleted;

  const refresh = useCallback(async () => {
    if (!tripId || inFlight.current || pending.current.size) return;
    inFlight.current = true;
    const request = ++lifetime.request;
    setReadStatus('loading');
    try {
      const response = await apiFetch<{jobs?: Partial<NoteAiJob>[]}>(`/trips/${tripId}/notes/ai-state`);
      if (request !== lifetime.request) return;
      if (!Array.isArray(response.jobs)) throw new Error('Invalid AI state');
      const next = emptyAiJobs();
      for (const raw of response.jobs) {
        if (raw.docType && NOTE_AI_TYPES.includes(raw.docType)) next[raw.docType] = {...next[raw.docType], ...raw};
      }
      for (const type of NOTE_AI_TYPES) {
        // A read taken before an accepted generation must not replace that generation.
        if (next[type].generation < currentJobs.current[type].generation) next[type] = currentJobs.current[type];
        const job = next[type];
        if (!job.jobId || isActiveAiJob(job) || job.status === 'idle') continue;
        const key = `${job.jobId}:${job.generation}:${job.status}`;
        if (!announced.current.has(key)) {
          announced.current.add(key);
          if (job.status === 'completed' && (loaded.current || readFailed.current)) completion.current(job, loaded.current);
        }
      }
      loaded.current = true;
      currentJobs.current = next;
      setJobs(next); setReadStatus('success');
    } catch {
      if (request === lifetime.request) { readFailed.current = true; setReadStatus('error'); }
    } finally {
      if (request === lifetime.request) inFlight.current = false;
    }
  }, [tripId, lifetime]);

  useEffect(() => {
    void refresh();
    return () => { lifetime.visit++; lifetime.request++; inFlight.current = false; };
  }, [refresh, lifetime]);
  const active = Object.values(jobs).some(isActiveAiJob);
  useEffect(() => {
    if (!active && readStatus !== 'error') return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [active, readStatus, refresh]);

  const canGenerate = (type: NoteAiDocType) => readStatus === 'success' && !submitting.has(type) && !isActiveAiJob(jobs[type]);
  const generate = async (type: NoteAiDocType) => {
    if (!tripId || readStatus !== 'success' || pending.current.has(type) || isActiveAiJob(currentJobs.current[type])) return;
    const visit = lifetime.visit;
    pending.current.add(type); setSubmitting(new Set(pending.current)); setTriggerError('');
    let consentBlocked = false;
    // Invalidate a read begun before this mutation; reconcile after the POST settles.
    lifetime.request++; inFlight.current = false;
    try {
      const response = await apiFetch<Pick<NoteAiJob, 'jobId' | 'requestId' | 'status' | 'generation' | 'timeoutAt'>>(
        `/trips/${tripId}/notes/${type}/generate`, {method: 'POST', body: JSON.stringify({})},
      );
      if (visit !== lifetime.visit) return;
      currentJobs.current = {...currentJobs.current, [type]: {...currentJobs.current[type], ...response,
        createdAt: new Date().toISOString(), errorCode: null, errorMessage: null}};
      setJobs(currentJobs.current);
    } catch (error) {
      if (visit !== lifetime.visit) return;
      if (error instanceof ApiError && (error.code === 'AI_DATA_CONSENT_REQUIRED' || error.code === 'AI_DATA_CONSENT_OWNER_REQUIRED')) {
        consentBlocked = true;
        throw error;
      }
      setTriggerError(error instanceof Error ? error.message : '請確認任務狀態後再試');
      setReadStatus('error');
    } finally {
      if (visit === lifetime.visit) {
        pending.current.delete(type); setSubmitting(new Set(pending.current));
        if (!consentBlocked) void refresh();
      }
    }
  };
  return {jobs, readStatus, triggerError, canGenerate, generate, refresh};
}
