import { describe, expect, it } from 'vitest';
import { createRequestWorker, ORPHAN_MAX_AGE_MS, type WorkerDeps } from '../../scripts/lib/request-worker';

function fakeHost() {
  let now = 1_700_000_000_000;
  let pending = true;
  const sessions = new Set<string>();
  let finishOnSubmit = true;
  let prompt = '❯ ';
  const effects: string[] = [];
  const deps: WorkerDeps = {
    apiBase: 'https://api.test', apiSecret: 'bootstrap', pid: 7,
    getServiceToken: async () => 'service', userTokenEnabled: (skill) => skill === '/tp-request',
    clock: { now: () => now }, sleep: async (ms) => { now += ms; },
    log: () => {}, logError: () => {}, alert: () => {}, containmentReady: () => true,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('mint-restricted')) return Response.json({ access_token: 'trip-token', restrict_trip: 't1' });
      if (url.pathname === '/api/requests') return Response.json({ items: pending && url.searchParams.get('status') === 'processing' ? [{ id: 1, tripId: 't1' }] : [] });
      if (init?.method === 'PATCH') { effects.push(`reap:${JSON.parse(String(init.body)).terminalReason}`); pending = false; return Response.json({}); }
      return Response.json({}, { status: 404 });
    },
    tmux: {
      list: (format) => [...sessions].map((name) => format.includes('created') ? `${name}|${Math.floor(now / 1000)}` : name).join('\n'),
      has: (name) => sessions.has(name),
      kill: (name) => { effects.push(`kill:${name}`); sessions.delete(name); },
    },
    createContainedSession: async (name) => { effects.push('create-contained'); sessions.add(name); return true; },
    createPlainSession: async (name) => { effects.push('create-plain'); sessions.add(name); return true; },
    attachLog: () => { effects.push('log-attached'); },
    pane: {
      capture: () => prompt,
      sendKeys: (_name, keys) => {
        effects.push(`keys:${keys}`);
        if (keys === 'Enter') { prompt = '❯ '; if (finishOnSubmit) pending = false; }
        else prompt = `❯ ${keys}`;
      },
    },
  };
  return { deps, effects, hasSession: () => sessions.size > 0, hasPending: () => pending,
    setPending: (value: boolean) => { pending = value; }, keepWorking: () => { finishOnSubmit = false; },
    elapsed: () => now - 1_700_000_000_000 };
}

describe('request worker complete lifecycle through the production interface', () => {
  it('plain skill startup failure releases its own lock without reaping trip requests', async () => {
    const host = fakeHost(); host.deps.pane.capture = () => '';
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job', '/tp-daily-check')).toBe('failed');
    expect(host.hasSession()).toBe(false);
    expect(host.hasPending()).toBe(true);
    expect(host.effects.some((effect) => effect.startsWith('reap:'))).toBe(false);
    expect(worker.status().runningSkills).toEqual([]);
  });

  it('unexpected monitoring errors close the session before cleanup and release the lock', async () => {
    const host = fakeHost(); host.keepWorking(); const sleep = host.deps.sleep;
    host.deps.sleep = (ms) => ms === 15_000 ? Promise.reject(new Error('watch transport failed')) : sleep(ms);
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.hasSession()).toBe(false);
    expect(host.effects.indexOf('reap:error')).toBeGreaterThan(host.effects.findIndex((effect) => effect.startsWith('kill:')));
    expect(worker.status().runningSkills).toEqual([]);
  });
  it('does not reap a request when the failed REPL session cannot actually be killed', async () => {
    const host = fakeHost(); host.deps.pane.capture = () => '';
    host.deps.tmux.kill = () => { host.effects.push('kill-failed'); };
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('api')).toBe('failed');
    expect(host.hasSession()).toBe(true);
    expect(host.hasPending()).toBe(true);
    expect(host.effects.some((effect) => effect.startsWith('reap:'))).toBe(false);
    expect(worker.status().running).toBe(false);
    expect(await worker.tick('job')).toBe('busy');
  });
  it('an unreadable queue response cannot be mistaken for a drained trip', async () => {
    const host = fakeHost(); host.keepWorking();
    const original = host.deps.fetch; let reads = 0;
    host.deps.fetch = (input, init) => {
      const url = new URL(String(input));
      if (url.searchParams.has('tripId') && url.searchParams.get('limit') === '1') {
        reads++;
        if (reads <= 2) return Promise.resolve(Response.json({ unavailable: true }));
        host.setPending(false);
      }
      return original(input, init);
    };
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('api')).toBe('spawned');
    expect(host.hasPending()).toBe(false);
    expect(host.elapsed()).toBeGreaterThanOrEqual(30_000);
    expect(host.effects.some((effect) => effect.startsWith('reap:'))).toBe(false);
  });
  it.each(['create', 'prepare-throw', 'repl', 'submit', 'enter'] as const)('cleans %s failure and releases the skill for a later retry', async (stage) => {
    const host = fakeHost(); const worker = createRequestWorker(host.deps);
    const original = { create: host.deps.createContainedSession, pane: { ...host.deps.pane } };
    if (stage === 'create') host.deps.createContainedSession = async () => false;
    if (stage === 'prepare-throw') host.deps.createContainedSession = async () => { throw new Error('files unavailable'); };
    if (stage === 'repl') host.deps.pane.capture = () => '';
    if (stage === 'submit') host.deps.pane.sendKeys = () => {};
    if (stage === 'enter') host.deps.pane.sendKeys = (name, keys) => { if (keys !== 'Enter') original.pane.sendKeys(name, keys); };
    expect(await worker.tick('api')).toBe('failed');
    expect(host.hasSession()).toBe(false);
    expect(host.hasPending()).toBe(false);
    const killed = host.effects.findIndex((effect) => effect.startsWith('kill:'));
    const reaped = host.effects.indexOf('reap:error');
    expect(reaped).toBeGreaterThanOrEqual(0);
    if (stage === 'create' || stage === 'prepare-throw') expect(killed).toBe(-1);
    else expect(killed).toBeLessThan(reaped);
    expect(worker.status().runningSkills).toEqual([]);
    host.deps.createContainedSession = original.create; host.deps.pane = original.pane; host.setPending(true);
    expect(await worker.tick('job')).toBe('spawned');
    expect(worker.status().runningSkills).toEqual([]);
  });

  it.each(['died', 'deadline'] as const)('reaps %s from the full startup flow with the 90 minute cap', async (outcome) => {
    const host = fakeHost(); host.keepWorking();
    if (outcome === 'died') host.deps.tmux.has = () => false;
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('spawned');
    expect(host.hasSession()).toBe(false);
    expect(host.hasPending()).toBe(false);
    const killed = host.effects.findIndex((effect) => effect.startsWith('kill:'));
    expect(host.effects.indexOf('reap:timed_out')).toBeGreaterThan(killed);
    expect(worker.status().running).toBe(false);
    if (outcome === 'deadline') {
      expect(host.elapsed()).toBeGreaterThanOrEqual(90 * 60_000);
      expect(host.elapsed()).toBeLessThan(100 * 60_000);
    }
  });

  it('a drained session does not reap a new request arriving as it closes', async () => {
    const host = fakeHost(); const kill = host.deps.tmux.kill;
    host.deps.tmux.kill = (name) => { kill(name); host.setPending(true); };
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('api')).toBe('spawned');
    expect(host.hasPending()).toBe(true);
    expect(host.effects.some((effect) => effect.startsWith('reap:'))).toBe(false);
    expect(worker.status().running).toBe(false);
  });

  it.each(['containment', 'token'] as const)('%s failure stays closed and retries without reaping pending work', async (stage) => {
    const host = fakeHost(); const originalFetch = host.deps.fetch;
    if (stage === 'containment') host.deps.containmentReady = () => false;
    else host.deps.fetch = (input, init) => String(input).endsWith('/mint-restricted') ? Promise.resolve(Response.json({}, { status: 403 })) : originalFetch(input, init);
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe(stage === 'containment' ? 'failed' : 'idle');
    expect(host.hasPending()).toBe(true);
    expect(host.effects).toEqual([]);
    expect(worker.status().running).toBe(false);
    host.deps.containmentReady = () => true; host.deps.fetch = originalFetch;
    expect(await worker.tick('api')).toBe('spawned');
  });

  it('keeps a per-skill lock throughout startup and monitoring while another allowed skill can start', async () => {
    const host = fakeHost(); const create = host.deps.createContainedSession;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    host.deps.createContainedSession = async (...args) => { await gate; return create(...args); };
    const worker = createRequestWorker(host.deps);
    const first = worker.tick('api');
    expect(await worker.tick('job')).toBe('busy');
    expect(await worker.tick('job', '/tp-daily-check')).toBe('spawned');
    release(); expect(await first).toBe('spawned');
    expect(host.effects.filter((effect) => effect === 'create-contained')).toHaveLength(1);
    expect(host.effects.filter((effect) => effect === 'create-plain')).toHaveLength(1);
    expect(worker.status().runningSkills).toEqual([]);
  });
  it('cleans a session which exists even when the creation transport throws after starting it', async () => {
    const host = fakeHost();
    const create = host.deps.createContainedSession;
    host.deps.createContainedSession = async (...args) => { await create(...args); throw new Error('transport lost after creation'); };
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('api')).toBe('failed');
    expect(host.hasSession()).toBe(false);
    const killed = host.effects.findIndex((effect) => effect.startsWith('kill:'));
    const reaped = host.effects.indexOf('reap:error');
    expect(killed).toBeGreaterThanOrEqual(0);
    expect(reaped).toBeGreaterThan(killed);
    expect(worker.status().running).toBe(false);
  });
  it('drives the real REPL protocol and closes a drained session without reaping', async () => {
    const host = fakeHost(); const worker = createRequestWorker(host.deps);
    expect(await worker.tick('api')).toBe('spawned');
    expect(host.hasPending()).toBe(false);
    expect(host.hasSession()).toBe(false);
    expect(host.effects).toContain('keys:/tp-request');
    expect(host.effects).toContain('keys:Enter');
    expect(host.effects.some((effect) => effect.startsWith('reap:'))).toBe(false);
    expect(worker.status()).toMatchObject({ running: false, processedCount: 1 });
    expect(host.elapsed()).toBeLessThan(ORPHAN_MAX_AGE_MS);
  });
});
