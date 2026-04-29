/**
 * ChatPage — V2 AI 對話入口（mockup-chat-v2.html parity）
 *
 * Wire to existing tp-request pipeline:
 *   1. On trip switch: GET /api/requests?tripId=X&limit=20&sort=asc → render
 *      historical conversation (each row = user bubble + assistant bubble).
 *   2. POST /api/requests {tripId, message}  → row.id
 *      (mode no longer sent — tp-request skill on Mac Mini auto-classifies
 *      message intent: 改行程 vs 問建議)
 *   3. SSE GET /api/requests/:id/events tracks status open→processing→completed
 *   4. on completed: GET /api/requests/:id → row.reply (Mac Mini Claude CLI fills it)
 *
 * Why an active trip is required: tp-request rows are scoped to a trip
 * (permission gate + Mac Mini context). Cold-start (no trip yet) shows a
 * tripless empty state pointing user to `/trips` to create / pick one.
 *
 * Layout:
 *   - Desktop ≥1024px: 3-pane via AppShell (sidebar | chat main | sheet)
 *   - Mobile <1024px: 1-pane chat + bottom nav
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useRequestSSE } from '../hooks/useRequestSSE';
import { apiFetch } from '../lib/apiClient';
import { useActiveTrip } from '../contexts/ActiveTripContext';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import MarkdownText from '../components/shared/MarkdownText';

interface MyTripRow { tripId: string; }
interface TripSummary {
  tripId: string;
  name?: string;
  title?: string | null;
  countries?: string | null;
}

interface ChatMessage {
  id: number | string;
  /** Section 4.8 (terracotta-ui-parity-polish)：'day-divider' 是 synthetic
   *  separator message，由 buildMessagesWithDividers 注入跨日邊界。 */
  role: 'user' | 'assistant' | 'day-divider';
  text: string;
  /** When set, this assistant bubble is the placeholder waiting for SSE completion. */
  pendingRequestId?: number | null;
  /** When true, render text as markdown (assistant replies). */
  markdown?: boolean;
  /** When true, mark message as failed (red border). */
  failed?: boolean;
  /** ISO timestamp from tp-request `created_at` / `updated_at`. Rendered as
   *  bubble timestamp (HH:mm if today, MM/DD HH:mm 否則)。null when local
   *  optimistic message (will fill on next reload from API)。 */
  createdAt?: string | null;
  /** 2026-04-29:multi-user trip 共編 chat,user message 真正 sender(從 tp-request
   * `submittedBy` email 來)。Render bubble meta 時 split email local-part 當
   * displayName(避免歷史訊息全標當前登入者)。 */
  submittedBy?: string | null;
}

/** Section 4.8: format day-divider header — `2026/04/27（週六）`。 */
const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
function formatDayDivider(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WEEKDAY_LABELS[d.getDay()]}）`;
}

/** Section 4.8: Inject day-divider synthetic messages between consecutive
 *  messages whose createdAt date differs。Pure: 給定相同 input 回傳相同
 *  output，方便 unit test。 */
export function buildMessagesWithDividers(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let lastDateKey = '';
  for (const m of messages) {
    if (m.createdAt) {
      const d = new Date(m.createdAt);
      if (!Number.isNaN(d.getTime())) {
        const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dateKey !== lastDateKey) {
          out.push({
            id: `day-divider-${dateKey}`,
            role: 'day-divider',
            text: formatDayDivider(m.createdAt),
            createdAt: m.createdAt,
          });
          lastDateKey = dateKey;
        }
      }
    }
    out.push(m);
  }
  return out;
}

interface RawRequestRow {
  id: number;
  tripId: string;
  mode?: string;
  message?: string | null;
  reply?: string | null;
  status: 'open' | 'processing' | 'completed' | 'failed';
  submittedBy?: string | null;
  processedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** QA 2026-04-26 PR-K：format chat bubble timestamp。同日只顯示 HH:mm，
 *  跨日加 MM/DD prefix。tabular-nums 字體穩定 alignment。 */
function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const today = new Date();
  if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
    return `${hh}:${mm}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/**
 * F7 design-review: 偵測歷史訊息中的編碼錯誤（mojibake），對應 backend
 * functions/api/_validate.ts:detectGarbledText 的相同三條規則。Backend
 * middleware 會擋新訊息，但 D1 已有舊 row 仍會 render — 本 helper 讓
 * frontend 在 render 時 bail out 顯示 placeholder 而不是亂碼字元。
 */
export function isGarbledMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  // Rule 1: U+FFFD replacement char — browser 解 UTF-8 失敗的標記
  if (text.includes('�')) return true;
  if (/[-ÿ]{3,}/.test(text)) return true;
  if (/[\x80-\x9F]/.test(text)) return true;
  return false;
}

/** Build a message pair (user bubble + assistant bubble) from a tp-request row. */
function rowToMessages(row: RawRequestRow): ChatMessage[] {
  const out: ChatMessage[] = [];
  const baseId = row.id * 2;
  // 2026-04-29 design-review F-004:API 實際回 camelCase(`createdAt` / `updatedAt`)
  // 因此型別與 access 改齊;原 snake_case 拿不到 timestamp,bubble meta 渲染條件
  // 永不為真。user message 用 createdAt(送出時點),assistant reply 用 updatedAt
  // (AI 完成時點),fallback 互換。
  const userTs = row.createdAt ?? row.updatedAt ?? null;
  const assistantTs = row.updatedAt ?? row.createdAt ?? null;
  if (row.message) {
    out.push({ id: baseId, role: 'user', text: row.message, createdAt: userTs, submittedBy: row.submittedBy ?? null });
  }
  if (row.status === 'completed' && row.reply) {
    out.push({ id: baseId + 1, role: 'assistant', text: row.reply, markdown: true, createdAt: assistantTs });
  } else if (row.status === 'failed') {
    out.push({
      id: baseId + 1,
      role: 'assistant',
      text: row.reply?.trim() || 'AI 處理失敗。',
      failed: true,
      createdAt: assistantTs,
    });
  } else {
    // open / processing — still inflight from a prior session
    out.push({
      id: baseId + 1,
      role: 'assistant',
      text: '思考中…',
      pendingRequestId: row.id,
      createdAt: assistantTs,
    });
  }
  return out;
}

const SCOPED_STYLES = `
.tp-chat-shell {
  height: 100%;
  display: flex; flex-direction: column;
  background: var(--color-secondary);
}
/* tp-chat-header 改用 <PageHeader>（standalone 預設）。.tp-chat-header CSS 已退役。
 * 桌機補 24px 水平 padding 因為 .tp-chat-shell 沒有 page-level padding；
 * 手機 (≤760px) 用 PageHeader 內建 16px canonical 規格，避免覆寫。 */
@media (min-width: 761px) {
  .tp-chat-shell .tp-page-header[data-variant="standalone"] { padding-left: 24px; padding-right: 24px; }
}
.tp-chat-trip-picker {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-background);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground); cursor: pointer;
  min-height: 36px;
}
.tp-chat-trip-picker:hover { border-color: var(--color-accent); color: var(--color-accent); }
.tp-chat-trip-picker .pill {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
}

.tp-chat-trip-menu {
  position: relative;
}
.tp-chat-trip-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  min-width: 240px;
  max-height: 360px; overflow-y: auto;
  z-index: 20;
  padding: 4px;
}
.tp-chat-trip-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: none; background: transparent; text-align: left;
  font: inherit; cursor: pointer; width: 100%;
  color: var(--color-foreground);
}
.tp-chat-trip-row:hover { background: var(--color-hover); }
.tp-chat-trip-row.is-active { background: var(--color-accent-subtle); color: var(--color-accent); }
.tp-chat-trip-row .row-title { font-weight: 700; font-size: var(--font-size-callout); }
.tp-chat-trip-row .row-meta { font-size: var(--font-size-caption2); color: var(--color-muted); }

.tp-chat-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 12px;
}
@media (max-width: 760px) { .tp-chat-body { padding: 16px; } }

.tp-chat-empty {
  margin: auto;
  max-width: 520px; text-align: center;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
}
.tp-chat-empty-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
}
.tp-chat-empty h2 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0;
}
.tp-chat-empty p {
  color: var(--color-muted); font-size: var(--font-size-callout);
  line-height: 1.55; margin: 0;
}
.tp-chat-empty .cta {
  display: inline-flex; align-items: center; padding: 10px 18px;
  border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  text-decoration: none; font: inherit; font-weight: 700;
}
.tp-chat-suggestions {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px;
}
.tp-chat-suggestion {
  padding: 8px 14px; border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit; font-size: var(--font-size-footnote);
  cursor: pointer;
  transition: border-color 120ms, background 120ms;
}
.tp-chat-suggestion:hover { border-color: var(--color-accent); background: var(--color-hover); }
.tp-chat-suggestion:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-chat-msg {
  max-width: min(640px, 80%);
  padding: 10px 14px;
  border-radius: 16px;
  font-size: var(--font-size-footnote);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.tp-chat-msg-user {
  align-self: flex-end;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-bottom-right-radius: 4px;
}
.tp-chat-msg-assistant {
  align-self: flex-start;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  border-bottom-left-radius: 4px;
  white-space: normal;
}
/* Bubble meta：每則訊息下方時間 + AI agent 標籤(F-004,2026-04-29 對齊 mockup)
 * — user 對齊 right、assistant 對齊 left。font-size caption2 + muted color +
 * weight 500 + margin-top 4。 */
.tp-chat-msg-time {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  padding: 0 4px;
  font-weight: 500;
}
.tp-chat-msg-time-user { align-self: flex-end; }
.tp-chat-msg-time-assistant { align-self: flex-start; }
/* Section 4.8 (terracotta-ui-parity-polish)：assistant message 旁的 AI avatar
 * + bubble row wrapper，user message 不顯示 avatar 維持非對稱 visual。 */
.tp-chat-msg-row { display: flex; gap: 8px; align-items: flex-end; }
.tp-chat-msg-row.is-assistant { align-self: flex-start; max-width: min(680px, 85%); }
.tp-chat-msg-row.is-user { align-self: flex-end; max-width: min(680px, 85%); flex-direction: row-reverse; }
.tp-chat-msg-row .tp-chat-msg { max-width: 100%; }
.tp-chat-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: var(--font-size-footnote); font-weight: 700;
  flex-shrink: 0;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-chat-avatar.is-ai { background: var(--color-foreground); color: var(--color-accent-foreground); }
[data-theme="dark"] .tp-chat-avatar.is-ai { background: #0F0B08; }
.tp-chat-day-divider {
  text-align: center;
  margin: 12px 0 4px;
  font-size: var(--font-size-caption2); color: var(--color-muted);
  font-weight: 600;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}
.tp-chat-msg-assistant.is-pending {
  color: var(--color-muted);
  font-style: italic;
}
.tp-chat-msg-assistant.is-failed {
  border-color: var(--color-destructive);
  color: var(--color-destructive);
}

.tp-chat-typing {
  display: inline-flex; gap: 4px; align-items: center;
}
.tp-chat-typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-muted);
  animation: tp-chat-bounce 1.2s infinite ease-in-out;
}
.tp-chat-typing span:nth-child(2) { animation-delay: 0.15s; }
.tp-chat-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes tp-chat-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-4px); opacity: 1; }
}

.tp-chat-composer {
  position: sticky; inset-block-end: 0;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-background) 92%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--color-border);
  display: flex; gap: 8px; align-items: flex-end;
}
@media (max-width: 760px) {
  .tp-chat-composer { padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); }
}
.tp-chat-input {
  flex: 1;
  resize: none;
  font: inherit; font-size: var(--font-size-footnote);
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-background);
  color: var(--color-foreground);
  min-height: 44px; max-height: 160px;
  line-height: 1.5;
}
.tp-chat-input:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}
.tp-chat-input:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-chat-send {
  border: none; cursor: pointer;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-radius: 50%;
  width: 40px; height: 40px;
  padding: 0;
  display: grid; place-items: center;
  flex-shrink: 0;
  transition: background 150ms;
}
.tp-chat-send:hover:not(:disabled) {
  background: var(--color-accent-deep);
}
.tp-chat-send:disabled {
  background: var(--color-secondary);
  color: var(--color-muted);
  opacity: 0.6;
  cursor: not-allowed;
}
/* F7 design-review: mojibake placeholder — italic muted 不搶 healthy
 * message 視覺權重，title attribute 提供 hover hint。 */
.tp-chat-msg-garbled {
  font-style: italic;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
`;

const SUGGESTIONS = [
  '幫我規劃 Day 1 的早午餐',
  '推薦今天附近 30 分鐘車程內的景點',
  '把第二天的午餐改成沖繩麵',
  '加入適合親子的水族館行程',
];

export default function ChatPage() {
  useRequireAuth();
  const { user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  // Section 5 (E4)：active trip 從 ActiveTripContext 讀寫，跨頁同步
  const { activeTripId, setActiveTrip } = useActiveTrip();
  const setActiveTripId = setActiveTrip;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [input, setInput] = useState('');
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  const [inflightId, setInflightId] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tripMenuRef = useRef<HTMLDivElement>(null);

  // Deep-link prefill: /chat?tripId=...&prefill=... — DaySection 的「+ 加景點」
  // 入口會帶這兩個 param 過來，讓 user 落地就看到準備好的請求草稿。撐到 active
  // trip 設好後再 populate input + 聚焦，不直接 send 讓 user 還能微調。讀完即
  // 從 URL 拿掉，避免重新整理 / 返回又 re-prefill。
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const targetTripId = searchParams.get('tripId');
    if (!prefill && !targetTripId) return;
    if (targetTripId && trips) {
      const valid = trips.some((t) => t.tripId === targetTripId);
      if (valid) setActiveTripId(targetTripId);
    }
    if (prefill) {
      setInput(prefill);
      // 等 textarea mount 後 focus + cursor 移到尾端
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 50);
    }
    // 清掉 query 避免回來的時候又重 prefill
    const next = new URLSearchParams(searchParams);
    next.delete('prefill');
    next.delete('tripId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  // Subscribe to SSE for inflight request id; flips status to 'completed' / 'failed'.
  const { status, error: sseError } = useRequestSSE(inflightId);

  // Load trips list (mine + meta) once on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [myRes, allRes] = await Promise.all([
          fetch('/api/my-trips', { credentials: 'same-origin' }),
          fetch('/api/trips?all=1', { credentials: 'same-origin' }),
        ]);
        if (cancelled) return;
        if (!myRes.ok) return;
        const myJson = (await myRes.json()) as MyTripRow[];
        const allJson = allRes.ok ? ((await allRes.json()) as TripSummary[]) : [];
        const mine = new Set(myJson.map((r) => r.tripId));
        const myTrips = allJson.filter((t) => mine.has(t.tripId));
        setTrips(myTrips);

        // Section 5 (E4)：優先用 ActiveTripContext (cross-page persisted)，
        // fallback 第一個可見 trip
        const pref = activeTripId;
        const valid = pref && myTrips.some((t) => t.tripId === pref) ? pref : (myTrips[0]?.tripId ?? null);
        setActiveTripId(valid);
      } catch {
        // silent — empty state will guide user
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Close trip menu on outside click
  useEffect(() => {
    if (!tripMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (tripMenuRef.current && !tripMenuRef.current.contains(e.target as Node)) {
        setTripMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tripMenuOpen]);

  // Load historical chat for the active trip. Each tp-request row turns into
  // one user bubble + one assistant bubble (or pending/failed placeholder).
  // Re-runs whenever the user switches trips. Cancels in-flight fetches on
  // trip change so a stale trip's history can't land into the new trip view.
  useEffect(() => {
    if (!activeTripId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setMessages([]);
    (async () => {
      try {
        const res = await apiFetch<{ items: RawRequestRow[]; hasMore: boolean }>(
          `/requests?tripId=${encodeURIComponent(activeTripId)}&limit=20&sort=asc`,
        );
        if (cancelled) return;
        const rows = Array.isArray(res?.items) ? res.items : [];
        const next: ChatMessage[] = [];
        let resumeId: number | null = null;
        for (const row of rows) {
          for (const m of rowToMessages(row)) next.push(m);
          if (row.status === 'open' || row.status === 'processing') resumeId = row.id;
        }
        setMessages(next);
        // If a prior session left a request in-flight, resume the SSE so the
        // pending bubble fills in once the Mac Mini finishes.
        if (resumeId != null) setInflightId(resumeId);
      } catch {
        if (!cancelled) {
          // Silent on history load fail — page still works for new sends.
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTripId]);

  // Auto-scroll on new message
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  // React to SSE status: when inflight request completes, fetch reply + replace
  // pending bubble. On 'failed' (or transient SSE error after request landed),
  // mark the bubble as failed.
  useEffect(() => {
    if (!inflightId) return;

    if (status === 'completed') {
      let cancelled = false;
      (async () => {
        try {
          const row = await apiFetch<{ reply?: string | null; status?: string }>(`/requests/${inflightId}`);
          if (cancelled) return;
          const reply = (row.reply ?? '').trim() || '（沒有回覆內容）';
          setMessages((prev) =>
            prev.map((m) =>
              m.pendingRequestId === inflightId
                ? { ...m, text: reply, pendingRequestId: null, markdown: true }
                : m,
            ),
          );
        } catch {
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.pendingRequestId === inflightId
                ? { ...m, text: '無法取得 AI 回覆，請稍後再試。', pendingRequestId: null, failed: true }
                : m,
            ),
          );
        } finally {
          if (!cancelled) setInflightId(null);
        }
      })();
      return () => { cancelled = true; };
    }

    if (status === 'failed') {
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingRequestId === inflightId
            ? { ...m, text: 'AI 處理失敗，請換個說法或稍後再試。', pendingRequestId: null, failed: true }
            : m,
        ),
      );
      setInflightId(null);
    }
  }, [status, inflightId]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (!activeTripId) return;
    if (inflightId) return; // busy

    const now = Date.now();
    setInput('');

    // Optimistic: user bubble + assistant typing placeholder
    // 2026-04-29 fix:user message 之前用 `timestamp: now`(數字)+ `as unknown as
    // ChatMessage` cast 跳 type check,實際 ChatMessage interface 要 `createdAt`
    // ISO string。bug 導致 production 看不到 user 訊息時間戳記(meta render 條件
    // `{m.createdAt && ...}` 永不為真)。改用 createdAt + ISO 8601。
    setMessages((prev) => [
      ...prev,
      { id: now, role: 'user', text, createdAt: new Date(now).toISOString(), submittedBy: user?.email ?? null },
      { id: now + 1, role: 'assistant', text: '思考中…', pendingRequestId: -1 },
    ]);

    try {
      // mode no longer sent — tp-request skill auto-classifies intent
      // (改行程 vs 問建議). Server defaults to 'trip-plan' to satisfy the
      // CHECK constraint, the skill ignores it.
      const res = await fetch('/api/requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: activeTripId, message: text }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const row = (await res.json()) as { id: number };
      // Bind placeholder bubble to the real request id so the SSE effect can
      // replace it once Mac Mini fills the reply.
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingRequestId === -1 ? { ...m, pendingRequestId: row.id } : m,
        ),
      );
      setInflightId(row.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '網路錯誤';
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingRequestId === -1
            ? { ...m, text: `送出失敗：${msg}`, pendingRequestId: null, failed: true }
            : m,
        ),
      );
    }
  }, [activeTripId, inflightId]);

  function pickTrip(tripId: string) {
    // Section 5 (E4)：寫進 ActiveTripContext (內部已 persist localStorage)
    setActiveTripId(tripId);
    setTripMenuOpen(false);
  }

  const activeTrip = useMemo(
    () => (trips ?? []).find((t) => t.tripId === activeTripId) ?? null,
    [trips, activeTripId],
  );

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  const composerDisabled = !activeTripId || !!inflightId;

  const main = (
    <div className="tp-chat-shell" data-testid="chat-page">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title={activeTrip?.title || activeTrip?.name || '聊天'}
        actions={trips && trips.length > 0 && (
          <div className="tp-chat-trip-menu" ref={tripMenuRef}>
            <button
              type="button"
              className="tp-chat-trip-picker"
              onClick={() => setTripMenuOpen((o) => !o)}
              data-testid="chat-trip-picker"
              aria-haspopup="menu"
              aria-expanded={tripMenuOpen}
            >
              <span className="pill">行程</span>
              <span>{activeTrip?.title || activeTrip?.name || activeTripId || '選擇行程'}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {tripMenuOpen && (
              <div className="tp-chat-trip-dropdown" role="menu">
                {trips.map((t) => (
                  <button
                    key={t.tripId}
                    type="button"
                    className={`tp-chat-trip-row ${t.tripId === activeTripId ? 'is-active' : ''}`}
                    onClick={() => pickTrip(t.tripId)}
                    role="menuitem"
                    data-testid={`chat-trip-pick-${t.tripId}`}
                  >
                    <span className="row-title">{t.title || t.name || t.tripId}</span>
                    <span className="row-meta">{(t.countries ?? '').toUpperCase() || t.tripId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />

      <div className="tp-chat-body" ref={bodyRef} data-testid="chat-body">
        {!activeTripId && trips !== null && trips.length === 0 && (
          <div className="tp-chat-empty">
            <div className="tp-chat-empty-icon" aria-hidden="true"><Icon name="chat" /></div>
            <h2>還沒有行程可以聊</h2>
            <p>聊天會直接改你選定的行程時間軸。先去新增一個再回來。</p>
            <Link to="/trips" className="cta">去新增行程</Link>
          </div>
        )}

        {!activeTripId && trips === null && (
          <div className="tp-chat-empty"><p>載入中…</p></div>
        )}

        {activeTripId && historyLoading && messages.length === 0 && (
          <div className="tp-chat-empty" data-testid="chat-history-loading">
            <p>載入歷史對話…</p>
          </div>
        )}

        {activeTripId && !historyLoading && messages.length === 0 && (
          <div className="tp-chat-empty">
            <div className="tp-chat-empty-icon" aria-hidden="true"><Icon name="chat" /></div>
            <h2>從一個指令開始</h2>
            <p>有什麼要改、要加、要換，或者只是想問建議都可以。AI 會自動判斷是要動行程還是純對話。</p>
            <div className="tp-chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="tp-chat-suggestion"
                  onClick={() => void send(s)}
                  disabled={composerDisabled}
                  data-testid="chat-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTripId && buildMessagesWithDividers(messages).map((m) => {
          if (m.role === 'day-divider') {
            return (
              <div
                key={m.id}
                className="tp-chat-day-divider"
                role="separator"
                data-testid="chat-day-divider"
              >
                {m.text}
              </div>
            );
          }
          const isAssistant = m.role === 'assistant';
          return (
            <Fragment key={m.id}>
              <div className={`tp-chat-msg-row ${isAssistant ? 'is-assistant' : 'is-user'}`}>
                {isAssistant && (
                  <div className="tp-chat-avatar is-ai" aria-hidden="true" data-testid="chat-avatar-ai">AI</div>
                )}
                <div
                  className={`tp-chat-msg ${isAssistant ? 'tp-chat-msg-assistant' : 'tp-chat-msg-user'} ${m.pendingRequestId ? 'is-pending' : ''} ${m.failed ? 'is-failed' : ''}`}
                  data-testid={`chat-msg-${m.role}`}
                >
                  {m.pendingRequestId ? (
                    <span className="tp-chat-typing" aria-label="AI 思考中">
                      <span /><span /><span />
                    </span>
                  ) : isGarbledMessage(m.text) ? (
                    /* F7 design-review: detect mojibake → render placeholder
                     * 而不是 raw bytes，避免 trust signal 受損。 */
                    <span className="tp-chat-msg-garbled" aria-label="訊息含編碼錯誤" title="此訊息含編碼錯誤無法顯示">
                      訊息含編碼錯誤，無法顯示
                    </span>
                  ) : m.markdown ? (
                    <MarkdownText text={m.text} as="div" />
                  ) : (
                    /* F8 design-review: 把 user 打的 `\n` literal 轉真正換行，
                     * 配合 .tp-chat-msg 的 white-space: pre-wrap 顯示換行；
                     * 對真的就是 backslash-n 字面的 corner case 不影響 visual。 */
                    m.text.replace(/\\n/g, '\n')
                  )}
                </div>
              </div>
              {m.createdAt && !m.pendingRequestId && (
                <time
                  className={`tp-chat-msg-time tp-chat-msg-time-${m.role}`}
                  dateTime={m.createdAt}
                  data-testid={`chat-msg-time-${m.id}`}
                >
                  {isAssistant
                    ? `Tripline AI · ${formatChatTime(m.createdAt)}`
                    /* 2026-04-29:multi-user trip user message sender 從 m.submittedBy
                     * (email)取 local-part 當 displayName,而不是固定當前登入者
                     * displayName(歷史訊息可能是其他 collaborator 送)。fallback 順序:
                     *   m.submittedBy local-part → 當前登入者 displayName / email → 「我」 */
                    : `${m.submittedBy?.split('@')[0] || user?.displayName || user?.email?.split('@')[0] || '我'} · ${formatChatTime(m.createdAt)}`}
                </time>
              )}
            </Fragment>
          );
        })}

        {sseError && inflightId && (
          <div className="tp-chat-msg tp-chat-msg-assistant is-failed" role="alert">
            連線異常：{sseError.message}
          </div>
        )}
      </div>

      <form
        className="tp-chat-composer"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <label htmlFor="chat-input" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          輸入訊息
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          className="tp-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={activeTripId ? '輸入訊息或語音指令…' : '先選一個行程才能聊'}
          rows={1}
          aria-label="輸入訊息"
          disabled={composerDisabled}
          data-testid="chat-input"
        />
        {/* Section 4.8 (terracotta-ui-parity-polish): mockup icon-only send button
         * (line 7245-7247)，aria-label「送出」保留 a11y。inflight 顯示 hourglass icon
         * 取代「送出中…」文字。 */}
        <button
          type="submit"
          className="tp-chat-send"
          disabled={composerDisabled || !input.trim()}
          aria-label={inflightId ? '送出中' : '送出'}
          data-testid="chat-send"
        >
          <Icon name={inflightId ? 'hourglass' : 'send'} />
        </button>
      </form>
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
