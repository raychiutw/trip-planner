/**
 * request worker（#1264）—— 行程 AI 聊天（requests pipeline）worker 的核心邏輯。
 *
 * api-server 以前把 peek → token → spawn → 收屍全寫成頂層函式，tmux / fetch / 時鐘在函式內部
 * 直接取用，測試只能 readFileSync + regex。這裡把「決策」收進一個接受依賴的 module：
 * 真實 adapter（tmux 指令、fetch、Date.now、contained 檔案佈置）由 api-server 組裝注入，
 * 測試用 fake 進同一個 interface。對外行為（session 命名、prefix、legacy 相容、log 訊息）不變。
 */

import { failPendingRequests, type ReapReason } from './fail-pending-requests';

export interface PendingRequest { requestId: string; tripId: string }
export type WatchOutcome = 'drained' | 'died' | 'deadline';
export interface AcquiredToken { token: string; restrictTrip?: string }
export type TickResult = 'spawned' | 'busy' | 'idle' | 'failed';

export interface WorkerDeps {
  fetch: typeof fetch;
  apiBase: string;
  /** mint-restricted 用的 API secret（非 owner Bearer）。 */
  apiSecret: string;
  getServiceToken: () => Promise<string>;
  /** TP_REQUEST_USER_TOKEN 開關（只有 /tp-request 走 owner-restricted token）。 */
  userTokenEnabled: (skillCommand: string) => boolean;
  tmux: {
    /** `tmux ls -F <format>` 的 stdout；tmux 不在／沒 server 回 null。 */
    list: (format: string) => string | null;
    kill: (sessionName: string) => void;
    /** `tmux has-session -t <name>`。 */
    has: (sessionName: string) => boolean;
  };
  clock: { now: () => number };
  sleep: (ms: number) => Promise<void>;
  pid: number;
  log: (msg: string) => void;
  logError: (msg: string) => void;
  alert: (key: string, state: 'healthy' | 'failed', message: string) => void;
  containmentReady: () => boolean;
  /** contained 路徑（tp-agent + MCP-only）：檔案佈置、tmux new-session、REPL 等真 adapter。 */
  spawnContained: (sessionName: string, skillCommand: string, token: string, restrictTrip: string) => Promise<boolean>;
  /** 未隔離路徑（/tp-daily-check 等信任 skill）。 */
  spawnPlain: (sessionName: string, skillCommand: string, token: string) => Promise<boolean>;
}

export const ALLOWED_SKILLS = new Set(['/tp-request', '/tp-daily-check']);
export const LEGACY_SESSION_PREFIX = 'tripline-request-';
export const ORPHAN_MAX_AGE_MS = 90 * 60 * 1000; // 90 minutes
/** contained session 看門狗輪詢間隔。 */
export const WATCH_INTERVAL_MS = 15_000;

export function assertAllowedSkill(skillCommand: string): string {
  if (!ALLOWED_SKILLS.has(skillCommand)) {
    throw new Error(`Disallowed skillCommand: ${skillCommand.slice(0, 40)} (allowlist: ${[...ALLOWED_SKILLS].join(', ')})`);
  }
  return skillCommand;
}

export function sessionPrefixForSkill(skillCommand: string): string {
  const verified = assertAllowedSkill(skillCommand);
  const slug = verified.replace(/^\//, '').toLowerCase();
  return `tripline-${slug}-`;
}

export function getKnownSessionPrefixes(): string[] {
  return [...Array.from(ALLOWED_SKILLS).map(sessionPrefixForSkill), LEGACY_SESSION_PREFIX];
}

export function createRequestWorker(deps: WorkerDeps) {
  const runningSkills = new Set<string>();
  let lastProcessed: string | null = null;
  let processedCount = 0;

  async function peekPendingRequest(): Promise<PendingRequest | null> {
    const svcToken = await deps.getServiceToken();
    for (const status of ['processing', 'open'] as const) {
      try {
        const res = await deps.fetch(`${deps.apiBase}/api/requests?status=${status}&sort=asc&limit=1`, {
          headers: { Authorization: `Bearer ${svcToken}` },
        });
        if (!res.ok) continue;
        const data = ((await res.json().catch(() => null)) ?? {}) as { items?: Array<{ id?: unknown; tripId?: unknown }> };
        const item = data.items?.[0];
        const rawId = item?.id;
        const tripId = item?.tripId;
        const requestId = typeof rawId === 'number' ? String(rawId) : typeof rawId === 'string' ? rawId : '';
        if (requestId && typeof tripId === 'string' && tripId) return { requestId, tripId };
      } catch {
        /* best-effort — try next status */
      }
    }
    return null;
  }

  async function mintRestricted(requestId: string): Promise<{ token: string; tripId: string }> {
    const res = await deps.fetch(`${deps.apiBase}/api/oauth/mint-restricted`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.apiSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ request_id: requestId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw Object.assign(new Error(`mint-restricted ${res.status}: ${detail.slice(0, 120)}`), { kind: 'MINT_FAILED' });
    }
    const data = ((await res.json().catch(() => null)) ?? {}) as { access_token?: unknown; restrict_trip?: unknown };
    if (typeof data.access_token !== 'string' || !data.access_token || typeof data.restrict_trip !== 'string' || !data.restrict_trip) {
      throw Object.assign(new Error('mint-restricted response missing access_token/restrict_trip'), { kind: 'MINT_FAILED' });
    }
    return { token: data.access_token, tripId: data.restrict_trip };
  }

  async function acquireToken(skillCommand: string): Promise<AcquiredToken | null> {
    if (deps.userTokenEnabled(skillCommand)) {
      try {
        const pending = await peekPendingRequest();
        if (!pending) {
          deps.log('無 pending request → 不 spawn /tp-request（Option E：只在有可處理請求時起 contained session）');
          return null;
        }
        const { token, tripId } = await mintRestricted(pending.requestId);
        deps.log(`minted owner-restricted token for request ${pending.requestId} (trip ${tripId})`);
        return { token, restrictTrip: tripId };
      } catch (err) {
        const e = err as { kind?: string; message?: string };
        deps.logError(`mint-restricted 失敗（/tp-request 不 spawn，避免未-contained session 外洩）：[${e.kind ?? '?'}] ${e.message ?? err}`);
        deps.alert(`mint-${e.kind ?? 'unknown'}`, 'failed',
          `tp-request mint-restricted 失效（${e.kind ?? '?'}）→ 不 spawn。查 /api/oauth/mint-restricted 或 owner Consent。`);
        return null; // 關鍵：不 fallback service token（不起未-contained session 處理不可信輸入）
      }
    }
    try {
      return { token: await deps.getServiceToken() };
    } catch (err) {
      deps.logError(`Token mint 失敗，tmux 不啟動：${(err as Error).message}`);
      return null;
    }
  }

  /** 清掉超過 maxAge 的自家 prefix session（含 legacy prefix）；回清掉幾個。 */
  function cleanupOrphans(maxAgeMs: number): number {
    try {
      const stdout = deps.tmux.list('#{session_name}|#{session_created}');
      if (stdout == null) return 0;
      const knownPrefixes = getKnownSessionPrefixes();
      const now = Math.floor(deps.clock.now() / 1000);
      let killed = 0;
      for (const line of stdout.split('\n')) {
        const parts = line.split('|');
        if (parts.length !== 2) continue;
        const [name, createdStr] = parts as [string, string];
        if (!knownPrefixes.some((p) => name.startsWith(p))) continue;
        const created = parseInt(createdStr, 10);
        if (!created) continue;
        if ((now - created) * 1000 > maxAgeMs) {
          deps.tmux.kill(name);
          deps.log(`Cleaned orphan tmux session: ${name} (age=${now - created}s)`);
          killed++;
        }
      }
      return killed;
    } catch (err) {
      deps.logError(`cleanupOrphans error: ${(err as Error).message}`);
      return 0;
    }
  }

  function hasActiveSession(skillCommand: string): string | null {
    const stdout = deps.tmux.list('#{session_name}');
    if (stdout == null) return null;
    const filter = sessionPrefixForSkill(skillCommand);
    for (const line of stdout.split('\n')) {
      if (line.startsWith(filter)) return line;
      if (skillCommand === '/tp-request' && line.startsWith(LEGACY_SESSION_PREFIX)) return line;
    }
    return null;
  }

  /**
   * 一次 process loop：清 orphan → 同 skill 有 session 就 busy → 取 token / spawn。
   * 同 skill 併發呼叫時第二個直接 busy（per-skill 鎖，取代舊 global isRunning）。
   */
  async function tick(source: 'api' | 'job', skillCommand: string = '/tp-request'): Promise<TickResult> {
    assertAllowedSkill(skillCommand);
    if (runningSkills.has(skillCommand)) {
      deps.log(`processLoop: already running, skip (source=${source}, skill=${skillCommand})`);
      return 'busy';
    }
    runningSkills.add(skillCommand);
    deps.log(`Process loop started (source: ${source}, skill: ${skillCommand})`);
    try {
      const cleaned = cleanupOrphans(ORPHAN_MAX_AGE_MS);
      if (cleaned > 0) deps.log(`Cleaned ${cleaned} orphan session(s)`);
      const active = hasActiveSession(skillCommand);
      if (active) {
        deps.log(`Active ${skillCommand} session ${active} still running, skip new spawn`);
        return 'busy';
      }
      const acquired = await acquireToken(skillCommand);
      if (acquired === null) return 'idle';
      const ok = await spawnWith(skillCommand, acquired);
      if (ok) {
        lastProcessed = new Date(deps.clock.now()).toISOString();
        processedCount++;
        return 'spawned';
      }
      return 'failed';
    } catch (err) {
      deps.logError(`Process loop error: ${err instanceof Error ? err.message : String(err)}`);
      return 'failed';
    } finally {
      runningSkills.delete(skillCommand);
      deps.log(`Process loop ended (skill=${skillCommand})`);
    }
  }

  async function spawnWith(skillCommand: string, acquired: AcquiredToken): Promise<boolean> {
    const sessionName = `${sessionPrefixForSkill(skillCommand)}${deps.clock.now()}-${deps.pid}`;
    if (acquired.restrictTrip) {
      if (deps.containmentReady()) {
        return deps.spawnContained(sessionName, skillCommand, acquired.token, acquired.restrictTrip);
      }
      deps.logError('containment infra 未就緒（tp-agent/sudo/settings/self-probe）→ /tp-request 不 spawn（拒絕未隔離 session 處理不可信輸入）');
      deps.alert('containment-not-ready', 'failed',
        'tp-request 需隔離但 containment (0a) 未就緒 → 不 spawn。設定見 scripts/tp-request-contained/README.md');
      return false;
    }
    if (skillCommand === '/tp-request') {
      deps.logError('/tp-request 走到未-contained 路徑（flag OFF？無 restrict token）→ 拒絕 spawn（不可信輸入不進未隔離 session）');
      deps.alert('tp-request-uncontained-refused', 'failed',
        '/tp-request 落到未-contained 路徑 → 不 spawn。要跑請開 TP_REQUEST_USER_TOKEN=1 走 Option E contained 路徑。');
      return false;
    }
    return deps.spawnPlain(sessionName, skillCommand, acquired.token);
  }

  /** 該 trip 是否仍有 open/processing 請求；查不到一律當「有」（保守：不誤殺）。 */
  async function tripHasPending(tripId: string): Promise<boolean> {
    try {
      const svc = await deps.getServiceToken();
      for (const status of ['processing', 'open'] as const) {
        const res = await deps.fetch(
          `${deps.apiBase}/api/requests?status=${status}&tripId=${encodeURIComponent(tripId)}&limit=1`,
          { headers: { Authorization: `Bearer ${svc}` } },
        );
        if (!res.ok) return true;
        const data = (await res.json().catch(() => null)) as { items?: unknown[] } | null;
        if (data == null) return true;
        if ((data.items?.length ?? 0) > 0) return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  /** ADR-0007 第一層：確定沒人會再處理時，把該 trip 的 open/processing 請求就地標終結。 */
  function reap(tripId: string, reason: ReapReason): Promise<number> {
    return failPendingRequests(
      { fetch: deps.fetch, apiBase: deps.apiBase, getToken: deps.getServiceToken, log: deps.log, logError: deps.logError },
      tripId,
      reason,
    );
  }

  /**
   * contained session 看門狗：每 WATCH_INTERVAL_MS 看一次，直到 session 自行結束（died）、
   * trip 無待處理（drained）或到 orphan cap（deadline）。三種都 kill session；
   * died / deadline 表示請求還沒處理完卻不會再有人處理 → 就地收屍 timed_out；
   * drained 走正常收尾不收（那條路上沒有殭屍，硬收會誤殺剛進來的新請求）。
   */
  async function watchContainedSession(sessionName: string, restrictTrip: string): Promise<WatchOutcome> {
    const deadline = deps.clock.now() + ORPHAN_MAX_AGE_MS;
    let outcome: WatchOutcome = 'deadline';
    while (deps.clock.now() < deadline) {
      await deps.sleep(WATCH_INTERVAL_MS);
      if (!deps.tmux.has(sessionName)) {
        deps.log(`contained: session ${sessionName} 已自行結束`);
        outcome = 'died';
        break;
      }
      if (!(await tripHasPending(restrictTrip))) {
        deps.log(`contained: trip ${restrictTrip} 無待處理 → 收尾 ${sessionName}`);
        outcome = 'drained';
        break;
      }
    }
    deps.tmux.kill(sessionName);
    if (outcome !== 'drained') await reap(restrictTrip, 'timed_out');
    return outcome;
  }

  return {
    tick,
    cleanupOrphans,
    tripHasPending,
    reap,
    watchContainedSession,
    hasActiveSession,
    acquireToken,
    peekPendingRequest,
    /** /health 用：目前跑中的 skill 與統計。 */
    status: () => ({ running: runningSkills.size > 0, runningSkills: Array.from(runningSkills), lastProcessed, processedCount }),
    isRunning: (skillCommand: string) => runningSkills.has(skillCommand),
  };
}
