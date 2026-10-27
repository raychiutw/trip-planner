import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRequestWorker, type PrintRunResult, type WorkerDeps } from '../../scripts/lib/request-worker';

/** 每次 print 執行會讓 pending 減一（模擬 AI 處理掉一筆）；arrivals 在第 N 次執行當中補進新請求。 */
function fakeHost(opts: { pending: number; arrivals?: Record<number, number>; results?: PrintRunResult[] }) {
  let pending = opts.pending;
  let runs = 0;
  const effects: string[] = [];
  const tmuxSessions: string[] = [];
  const deps: WorkerDeps = {
    apiBase: 'https://api.test', apiSecret: 'bootstrap', pid: 7,
    getServiceToken: async () => 'service', userTokenEnabled: (skill) => skill === '/tp-request',
    clock: { now: () => 1_700_000_000_000 }, sleep: async () => {},
    log: () => {}, logError: () => {}, alert: () => {}, containmentReady: () => true,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('mint-restricted')) return Response.json({ access_token: 'trip-token', restrict_trip: 't1' });
      if (url.pathname === '/api/requests' && init?.method !== 'PATCH') {
        const status = url.searchParams.get('status');
        const items = status === 'open' && pending > 0 ? Array.from({ length: pending }, (_, i) => ({ id: i + 1, tripId: 't1' })) : [];
        return Response.json({ items });
      }
      if (init?.method === 'PATCH') { effects.push(`reap:${JSON.parse(String(init.body)).terminalReason}`); pending = 0; return Response.json({}); }
      return Response.json({}, { status: 404 });
    },
    tmux: { list: () => null, has: () => false, kill: () => {} },
    createContainedSession: async (name) => { tmuxSessions.push(name); return true; },
    createPlainSession: async (name) => { tmuxSessions.push(name); return true; },
    attachLog: () => {},
    pane: { capture: () => '', sendKeys: () => {} },
    runContainedPrint: async () => {
      runs++;
      pending = Math.max(0, pending - 1) + (opts.arrivals?.[runs] ?? 0);
      return opts.results?.[runs - 1] ?? { ok: true, timedOut: false };
    },
  };
  return { deps, effects, tmuxSessions, runs: () => runs, pending: () => pending };
}

describe('contained print mode（claude -p，不經 tmux）', () => {
  it('處理完就結束：只跑一次、不建任何 tmux session', async () => {
    const host = fakeHost({ pending: 1 });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('spawned');
    expect(host.runs()).toBe(1);
    expect(host.tmuxSessions).toEqual([]);
    expect(host.effects).toEqual([]);
    expect(worker.status().runningSkills).toEqual([]);
  });

  it('執行當中同一行程又進來新請求：再跑一輪直到清空（#287 回歸）', async () => {
    const host = fakeHost({ pending: 1, arrivals: { 1: 1 } });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('spawned');
    expect(host.runs()).toBe(2);
    expect(host.pending()).toBe(0);
    expect(host.effects).toEqual([]);
  });

  it('process 非 0 結束且仍有待處理：不再重試，就地收屍為 error', async () => {
    const host = fakeHost({ pending: 2, results: [{ ok: false, timedOut: false }] });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.runs()).toBe(1);
    expect(host.effects).toEqual(['reap:error']);
  });

  it('process 非 0 結束但待處理剛好清空：不收屍，但如實回報 failed（不計成成功）', async () => {
    const host = fakeHost({ pending: 1, results: [{ ok: false, timedOut: false }] });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.effects).toEqual([]);
    expect(worker.status().processedCount).toBe(0);
  });

  it('逾時被砍：收屍為 timed_out', async () => {
    const host = fakeHost({ pending: 2, results: [{ ok: false, timedOut: true }] });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.effects).toEqual(['reap:timed_out']);
  });

  it('連續有新請求超過輪數上限：停止並收屍，不會無限迴圈', async () => {
    const host = fakeHost({ pending: 1, arrivals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } });
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.runs()).toBe(3);
    expect(host.effects).toEqual(['reap:timed_out']);
    expect(worker.status().runningSkills).toEqual([]);
  });

  it('runContainedPrint 丟例外也釋放鎖並收屍為 error', async () => {
    const host = fakeHost({ pending: 1 });
    host.deps.runContainedPrint = async () => { throw new Error('spawn failed'); };
    const worker = createRequestWorker(host.deps);
    expect(await worker.tick('job')).toBe('failed');
    expect(host.effects).toEqual(['reap:error']);
    expect(worker.status().runningSkills).toEqual([]);
  });

  it('沒提供 runContainedPrint 時維持舊的 tmux REPL 路徑（flag OFF 的回退）', async () => {
    const host = fakeHost({ pending: 1 });
    delete host.deps.runContainedPrint;
    host.deps.pane.capture = () => '';
    const worker = createRequestWorker(host.deps);
    await worker.tick('job');
    expect(host.runs()).toBe(0);
    expect(host.tmuxSessions.length).toBe(1);
  });
});

describe('tripline-api-server 接線（print 模式預設 OFF）', () => {
  // 守衛讀原始碼要先剝註解，否則註解裡的字面值會讓斷言假綠
  const src = readFileSync('scripts/tripline-api-server.ts', 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('runContainedPrint 只在 TP_REQUEST_PRINT_MODE=1 時注入，否則 undefined', () => {
    expect(src).toMatch(/runContainedPrint:\s*process\.env\.TP_REQUEST_PRINT_MODE === '1' \? runContainedPrint : undefined/);
  });

  it('print 路徑與 REPL 路徑共用同一個 session 目錄準備（隔離佈置不分叉）', () => {
    expect(src.match(/prepareContainedSessionDir\(/g)?.length).toBe(3); // 定義 + 兩條路徑各呼叫一次
  });

  it('逾時先 SIGTERM（sudo 會轉發給 claude），寬限後才 SIGKILL；不可一上來就 SIGKILL（claude 會變孤兒）', () => {
    expect(src.indexOf("child.kill('SIGTERM')")).toBeGreaterThan(-1);
    expect(src.indexOf("child.kill('SIGTERM')")).toBeLessThan(src.indexOf("child.kill('SIGKILL')"));
  });

  it('卡住的 process 不能讓鎖永遠不釋放：聽 exit 並有硬性期限，finish 只會執行一次', () => {
    expect(src).toMatch(/child\.on\('exit'/);
    expect(src).toMatch(/PRINT_HARD_DEADLINE_MS/);
    expect(src).toMatch(/if \(done\) return;/);
  });

  it('輸出收完整段才脫敏（含精確字串 token 與上限），log 檔 0600', () => {
    expect(src).toMatch(/scrub\(Buffer\.concat\(chunks\)\.toString\(\)\)/);
    expect(src).toMatch(/split\(sec\)\.join\('<redacted>'\)/);
    expect(src).toMatch(/PRINT_LOG_MAX_BYTES/);
    expect(src).toMatch(/mode: 0o600/);
  });

  it('清理在最外層 finally：prepare 寫到一半失敗也會清；殘留子程序一併 pkill；rm 失敗要記 log', () => {
    expect(src).toMatch(/finally\s*\{[\s\S]*?runAsAgent\(\['pkill', '-KILL', '-f', sessionDir\]\);[\s\S]*?runAsAgent\(\['rm', '-rf', sessionDir\]\);[\s\S]*?logError\(/);
    expect(src.indexOf('const prepared = prepareContainedSessionDir(runName')).toBeGreaterThan(src.indexOf('async function runContainedPrint('));
  });
});
