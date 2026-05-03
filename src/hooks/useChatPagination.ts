/**
 * useChatPagination — cursor-based chat history pagination.
 *
 * 對接 GET /api/requests?tripId=X&limit=N&sort=desc 與 before/beforeId cursor。
 * 初次 mount 載最新 CHAT_PAGE_SIZE 筆，user scroll 到頂後自動載更舊。
 *
 * 修正 race / leak：
 *   - loadingOlderRef 同步 gate 擋 iOS momentum scroll 同 tick 多次觸發
 *   - activeTripIdRef 比對防 trip switch 時舊 fetch 污染新 trip
 *   - prependScrollRef 在 trip switch 清空避免跨 trip stale value
 *   - auto-scroll 用 first/last message id diff 判斷 prepend vs 新訊息,
 *     避免 SSE / send 同 tick 干擾 scrollHeight delta 計算
 *
 * Backoff：連續 fetch 失敗有 ERROR_BACKOFF_MS gate 防 401/網路 storm。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

/** 初次載入 + 每次 scroll 到頂載 N 筆 tp-request row。每筆 = user + assistant 兩個 bubble。
 *  設小是手機 chat 風格：先看到最新對話、需要往上才載歷史。 */
export const CHAT_PAGE_SIZE = 5;
/** 距頂多少 px 觸發 load older。略大於 0 讓 user 有機會看到「載入中」狀態。 */
export const LOAD_OLDER_THRESHOLD_PX = 80;
/** 連續失敗最少間隔。401 / network error 時擋 storm fetch。 */
const ERROR_BACKOFF_MS = 2000;

/** Hook 不限定 raw row 形狀，由 caller 提供 rowToMessages 轉換器。
 *  只要 row 有 createdAt + id 即可作 cursor 鍵。 */
export interface PaginatedRow {
  id: number;
  createdAt?: string | null;
}

export interface UseChatPaginationArgs<TRow extends PaginatedRow, TMsg extends { id: number | string }> {
  activeTripId: string | null;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  messages: TMsg[];
  setMessages: React.Dispatch<React.SetStateAction<TMsg[]>>;
  rowToMessages: (row: TRow) => TMsg[];
  /** 從 raw row 抽出 inflight 狀態 (open / processing) 用以恢復 SSE。 */
  isInflightStatus?: (row: TRow) => boolean;
  /** 初次載入完成後若有 inflight row, 通知 caller resume SSE。 */
  onInitialResume?: (resumeId: number | null) => void;
  /** 載入中狀態同步給 caller (給 spinner / disabled state 用)。 */
  setHistoryLoading?: (loading: boolean) => void;
}

export interface UseChatPaginationResult {
  /** 還有更舊訊息可載 (server hasMore)。 */
  hasMoreOlder: boolean;
  /** Trigger load older — 通常由 hook 內部 scroll listener 自動呼叫,
   *  caller 用於 retry button 等場景。 */
  loadOlder: () => Promise<void>;
  /** Last error from initial fetch or loadOlder。Null = no error。 */
  loadError: Error | null;
  /** Caller 在 retry button 點按時呼叫,清 error + 重試 loadOlder。 */
  retryLoadOlder: () => void;
}

interface PageResponse<TRow extends PaginatedRow> {
  items?: TRow[];
  hasMore?: boolean;
}

/** sort=desc 回應 → reverse 成時間軸 asc + 抽出最舊一筆 cursor。 */
function parseRequestPage<TRow extends PaginatedRow>(
  res: PageResponse<TRow> | null | undefined,
): { rows: TRow[]; oldest: { createdAt: string; id: number } | null; hasMore: boolean } {
  const rows = (Array.isArray(res?.items) ? res.items : []).slice().reverse();
  const oldestRow = rows[0];
  const oldest =
    oldestRow && oldestRow.createdAt && typeof oldestRow.id === 'number'
      ? { createdAt: oldestRow.createdAt, id: oldestRow.id }
      : null;
  return { rows, oldest, hasMore: Boolean(res?.hasMore) };
}

export function useChatPagination<TRow extends PaginatedRow, TMsg extends { id: number | string }>(
  args: UseChatPaginationArgs<TRow, TMsg>,
): UseChatPaginationResult {
  const { activeTripId, bodyRef, messages, setMessages, rowToMessages, isInflightStatus, onInitialResume, setHistoryLoading } = args;

  const [oldestCursor, setOldestCursor] = useState<{ createdAt: string; id: number } | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  /** Prepend scroll 補位用：setMessages 前記下 scrollHeight + scrollTop,
   *  auto-scroll useEffect 觀察到 messages 變後算 delta 補回 scrollTop。 */
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);
  /** loadOlder 進行中時若 user 切換 trip,舊 fetch 回來會把舊 trip 訊息 prepend
   *  到新 trip 的空陣列。Ref 追當下 trip,await 後比對不一致就放棄套用 state。 */
  const activeTripIdRef = useRef<string | null>(activeTripId);
  /** loadingOlder 同步 gate：useState 不夠 (setLoadingOlder async batched),
   *  iOS momentum scroll 會在 tick 內觸發多次 onScroll 全看到 false 重複 fetch。
   *  Ref 同步寫入即時擋。 */
  const loadingOlderRef = useRef(false);
  /** Auto-scroll 用 prev first/last message id 判斷訊息變動類型。 */
  const prevFirstMsgIdRef = useRef<TMsg['id'] | null>(null);
  const prevLastMsgIdRef = useRef<TMsg['id'] | null>(null);
  /** 上次 loadOlder 失敗時間 (ms)。連續失敗時用於 backoff gate。 */
  const lastErrorAtRef = useRef<number>(0);

  // Initial load: 最新 CHAT_PAGE_SIZE 筆。sort=desc 拿最新,client reverse 成時間軸 asc。
  useEffect(() => {
    if (!activeTripId) {
      setMessages([]);
      setOldestCursor(null);
      setHasMoreOlder(false);
      setLoadError(null);
      prependScrollRef.current = null;
      return;
    }
    let cancelled = false;
    setHistoryLoading?.(true);
    setMessages([]);
    setOldestCursor(null);
    setHasMoreOlder(false);
    setLoadError(null);
    prependScrollRef.current = null;
    (async () => {
      try {
        const res = await apiFetch<PageResponse<TRow>>(
          `/requests?tripId=${encodeURIComponent(activeTripId)}&limit=${CHAT_PAGE_SIZE}&sort=desc`,
        );
        if (cancelled) return;
        const { rows, oldest, hasMore } = parseRequestPage(res);
        const next: TMsg[] = [];
        let resumeId: number | null = null;
        for (const row of rows) {
          for (const m of rowToMessages(row)) next.push(m);
          if (isInflightStatus?.(row)) resumeId = row.id;
        }
        setMessages(next);
        if (oldest) setOldestCursor(oldest);
        setHasMoreOlder(hasMore);
        if (resumeId != null) onInitialResume?.(resumeId);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setHistoryLoading?.(false);
      }
    })();
    return () => { cancelled = true; };
    // 故意 omit setMessages / rowToMessages / callbacks (caller 應傳穩定 ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripId]);

  // 同步 activeTripIdRef 給 loadOlder 用作 race guard
  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  // Load older — scroll 到頂時觸發。before/beforeId cursor 點對到目前最舊一筆,
  // 往前再撈 CHAT_PAGE_SIZE 筆。setMessages prepend 前記 scrollHeight,
  // auto-scroll useEffect 觀察到變動後補 scrollTop。
  const loadOlder = useCallback(async () => {
    if (!activeTripId || !oldestCursor || !hasMoreOlder || loadingOlderRef.current) return;
    // Backoff：連續失敗 < ERROR_BACKOFF_MS 內不重試,擋 storm fetch
    if (loadError && Date.now() - lastErrorAtRef.current < ERROR_BACKOFF_MS) return;
    const fetchTripId = activeTripId;
    // 同步寫 ref 擋住同 tick 多次 onScroll 觸發 (iOS momentum scroll)
    loadingOlderRef.current = true;
    try {
      const params = new URLSearchParams({
        tripId: fetchTripId,
        limit: String(CHAT_PAGE_SIZE),
        sort: 'desc',
        before: oldestCursor.createdAt,
        beforeId: String(oldestCursor.id),
      });
      const res = await apiFetch<PageResponse<TRow>>(`/requests?${params.toString()}`);
      // Trip 切換中不套用任何 state,避免舊 trip 訊息污染新 trip 列表
      if (activeTripIdRef.current !== fetchTripId) return;
      const { rows, oldest, hasMore } = parseRequestPage(res);
      // 後端回 hasMore=true 但 items=[] 的邊界 (未來 backend regression 防線):
      // flip hasMoreOlder=false 避免使用者繼續 scroll 觸發無限空 fetch loop
      if (rows.length === 0) {
        setHasMoreOlder(false);
        setLoadError(null);
        return;
      }
      const older: TMsg[] = [];
      for (const row of rows) {
        for (const m of rowToMessages(row)) older.push(m);
      }
      // 記下 prepend 前的 scrollHeight + scrollTop,autoscroll useEffect 用來補位
      const el = bodyRef.current;
      if (el) {
        prependScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
      }
      setMessages((prev) => [...older, ...prev]);
      if (oldest) setOldestCursor(oldest);
      setHasMoreOlder(hasMore);
      setLoadError(null);
    } catch (err) {
      lastErrorAtRef.current = Date.now();
      setLoadError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      loadingOlderRef.current = false;
    }
    // setMessages / rowToMessages 由 caller 提供,假設穩定 ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripId, oldestCursor, hasMoreOlder, loadError, bodyRef]);

  const retryLoadOlder = useCallback(() => {
    setLoadError(null);
    lastErrorAtRef.current = 0;
    void loadOlder();
  }, [loadOlder]);

  // Scroll-to-top trigger: 距頂 LOAD_OLDER_THRESHOLD_PX 內 + 還有更舊 + 沒在載 → 載
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      // 用 ref 而非 state 看 loadingOlder,擋同 tick 多次觸發 (iOS momentum scroll)
      if (el.scrollTop <= LOAD_OLDER_THRESHOLD_PX && hasMoreOlder && !loadingOlderRef.current) {
        void loadOlder();
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMoreOlder, loadOlder, bodyRef]);

  // Auto-scroll behavior — 用 first/last message id diff 判斷變動類型,避免 SSE
  // 中間替換 / send / loadOlder 同 tick 交錯時誤判 scrollHeight delta:
  //   - first id 變、last id 沒變    → prepend (load older) → 補 scrollTop 不跳
  //   - last id 變                  → 新訊息 (send / SSE / initial / trip switch) → 拉到底
  //   - 兩者皆同 (SSE bubble 取代)   → 不動 (避免 user 滾上去看舊訊息時被拉回底)
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const prevFirst = prevFirstMsgIdRef.current;
    const prevLast = prevLastMsgIdRef.current;
    prevFirstMsgIdRef.current = firstId;
    prevLastMsgIdRef.current = lastId;

    const firstChanged = firstId !== prevFirst;
    const lastChanged = lastId !== prevLast;

    // Prepend: first id 變 + last id 沒變 + 有 prepend ref
    if (firstChanged && !lastChanged && prependScrollRef.current) {
      const { height, top } = prependScrollRef.current;
      const delta = el.scrollHeight - height;
      el.scrollTop = top + delta;
      prependScrollRef.current = null;
      return;
    }

    // 新訊息 at bottom: last id 變 → 拉到底
    if (lastChanged) {
      el.scrollTop = el.scrollHeight;
    }
    // 兩者皆同 → SSE bubble 取代,user 已捲到他要的位置,不動
  }, [messages, bodyRef]);

  return { hasMoreOlder, loadOlder, loadError, retryLoadOlder };
}
