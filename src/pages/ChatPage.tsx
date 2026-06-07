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
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useRequestSSE } from '../hooks/useRequestSSE';
import { parseUtcDate } from '../lib/parseUtcDate';
import { useChatPagination } from '../hooks/useChatPagination';
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
  /** 2026-05-07：sender 的 users.display_name（後端 LEFT JOIN）給 avatar /
   *  sender label 顯示「帳號名稱」第一字母。null → fallback email local part。 */
  submittedByDisplayName?: string | null;
}

/** Section 4.8: format day-divider header — `2026/04/27（週六）`。 */
const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
function formatDayDivider(iso: string): string {
  const d = parseUtcDate(iso);
  if (!d) return iso;
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
      const d = parseUtcDate(m.createdAt);
      if (d) {
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

// Pagination 邏輯抽到 useChatPagination hook。CHAT_PAGE_SIZE 與 LOAD_OLDER_THRESHOLD_PX
// 從 hook 模組讀取以保持單一來源。

interface RawRequestRow {
  id: number;
  tripId: string;
  mode?: string;
  message?: string | null;
  reply?: string | null;
  status: 'open' | 'processing' | 'completed' | 'failed';
  submittedBy?: string | null;
  /** 2026-05-07：submitter 帳號 display_name（API LEFT JOIN users）給 chat
   *  avatar/sender label 顯示「帳號名稱」第一字母。null = users 表無對應。 */
  submittedByDisplayName?: string | null;
  processedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** QA 2026-04-26 PR-K：format chat bubble timestamp。同日只顯示 HH:mm，
 *  跨日加 MM/DD prefix。tabular-nums 字體穩定 alignment。 */
function formatChatTime(iso: string): string {
  const d = parseUtcDate(iso);
  if (!d) return '';
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
    // v2.31.27 fix #128: AI 健檢 message 是整個 HEALTH_CHECK_MESSAGE system
    // prompt (含 5 維度 + JSON schema + 範例)，user 看一大坨雜訊。改顯短摘要。
    // 完整 prompt 仍存 trip_requests.message → api-server 拿到完整 text 送 Claude。
    // v2.34.38 prod audit fix: trip-notes feature 3 個新 AI prefix 也是 long system
    //   prompt（JSON schema + 5-8 維度），同樣 raw 顯示 → 套同 pattern substitution。
    const displayText = row.message.startsWith('[AI 健檢]')
      ? '已觸發 AI 行程健檢'
      : row.message.startsWith('[行程筆記-lodging-tips]')
      ? '已觸發 AI 行程筆記生成（住宿在地建議）'
      : row.message.startsWith('[行程筆記-tips]')
      ? '已觸發 AI 行程筆記生成（行前須知）'
      : row.message.startsWith('[行程筆記-emergency]')
      ? '已觸發 AI 行程筆記生成（緊急聯絡）'
      : row.message;
    out.push({
      id: baseId,
      role: 'user',
      text: displayText,
      createdAt: userTs,
      submittedBy: row.submittedBy ?? null,
      submittedByDisplayName: row.submittedByDisplayName ?? null,
    });
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
/* tp-chat-header / .tp-page-header CSS 已退役。改用 <TitleBar>，自帶
 * padding 0 24px (desktop) / 0 16px (compact)，不需額外覆寫。 */

.tp-chat-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 12px;
}
@media (max-width: 760px) { .tp-chat-body { padding: 16px; } }

/* Load error banner — sticky-top inside chat body, 出現在 401/network/loadOlder
 * 失敗時。Retry button 重觸 loadOlder; hook 內 ERROR_BACKOFF_MS gate 防 storm。 */
.tp-chat-load-error {
  position: sticky; top: 0; z-index: 1;
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-error-soft, color-mix(in srgb, var(--color-error) 12%, var(--color-background)));
  color: var(--color-error, #b00020);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-footnote);
  margin-bottom: 8px;
}
.tp-chat-load-error-text { flex: 1; min-width: 0; }
.tp-chat-load-error-retry {
  height: 32px; padding: 0 12px;
  background: var(--color-error, #b00020);
  color: var(--color-on-error, #fff);
  border: none; border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-footnote); font-weight: 500; cursor: pointer;
}
.tp-chat-load-error-retry:hover { opacity: 0.92; }

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
  border-radius: var(--radius-xl);
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
/* 2026-04-29:其他 collaborator 訊息(LINE 群組對方 style)— bubble bg
 * 跟 AI 接近 secondary 但稍區隔(border-color 用 muted hint)。 */
.tp-chat-msg-other-user {
  align-self: flex-start;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  border-bottom-left-radius: 4px;
  white-space: normal;
}
.tp-chat-msg-time-other-user {
  align-self: flex-start;
  margin-left: calc(40px + 8px);
}
/* v2.31.91：markdown link 對齊 site terracotta 風格（取代 browser 預設藍/紫 underline）。
 * Assistant bubble: terracotta accent text + subtle underline，hover 變淺。
 * User bubble (accent bg): 文字用 accent-foreground (white)，underline 用 rgba(255,255,255,.5)。
 * AI 健檢 reply 內「前往健檢報告 →」link 是主要 trigger。 */
.tp-chat-msg a {
  color: var(--color-accent-deep, var(--color-accent));
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  font-weight: 500;
  transition: opacity 150ms;
}
.tp-chat-msg a:hover { opacity: 0.7; }
.tp-chat-msg-user a {
  color: var(--color-accent-foreground);
  text-decoration-color: rgba(255, 255, 255, 0.55);
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
/* 2026-04-29:multi-user trip 共編 — 其他 collaborator 訊息照 LINE 群組規則
 * 顯示左側 + avatar + sender 名上方。bubble visual 跟 AI 接近(secondary bg)
 * 但 sender 名突出區隔。 */
.tp-chat-msg-row.is-other-user { align-self: flex-start; max-width: min(680px, 85%); }
.tp-chat-msg-bubble-wrap { display: flex; flex-direction: column; min-width: 0; }
.tp-chat-msg-sender-name {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  margin: 0 0 3px 4px;
}
.tp-chat-avatar.is-other-user {
  background: var(--color-secondary);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
[data-theme="dark"] .tp-chat-avatar.is-other-user {
  background: var(--color-tertiary);
  border-color: var(--color-border);
}
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
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  min-height: 44px; max-height: 160px;
  line-height: 1.5;
}
/* iOS Safari 對 input/textarea font-size < 16px 自動 zoom（讓字 16px 可讀），
   把 viewport 放大造成破版。mobile 一律 16px 防 auto-zoom；desktop 維持 14px 設計感。 */
@media (max-width: 760px) {
  .tp-chat-input { font-size: var(--font-size-body); }
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

export interface ChatPageProps {
  /** v2.31.86：embedded mode — skip AppShell + DesktopSidebar + GlobalBottomNav，
   *  讓 ChatPage 可嵌進 TripSheet chat tab。預設 false (standalone page mode)。 */
  embedded?: boolean;
  /** v2.31.86：lock active trip 到指定 tripId（embedded mode 在 TripPage 內，
   *  trip context 已 fixed；不允 user 從 chat picker 切到別 trip 改 TripPage 行為）。 */
  lockTripId?: string;
}

export default function ChatPage({ embedded = false, lockTripId }: ChatPageProps = {}) {
  useRequireAuth();
  const { user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  // Section 5 (E4)：active trip 從 ActiveTripContext 讀寫，跨頁同步
  const { activeTripId, setActiveTrip } = useActiveTrip();
  const setActiveTripId = setActiveTrip;

  // v2.31.86 embedded mode：lockTripId given → 強制 active trip 對齊 prop，
  // 避免 user 進 TripSheet chat tab 後 active trip context 不一致。
  useEffect(() => {
    if (lockTripId && lockTripId !== activeTripId) {
      setActiveTripId(lockTripId);
    }
  }, [lockTripId, activeTripId, setActiveTripId]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [input, setInput] = useState('');
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  const [inflightId, setInflightId] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tripMenuRef = useRef<HTMLDivElement>(null);

  // Cursor pagination + scroll behavior 抽到 useChatPagination hook。
  // Hook owns: 初次載入、scroll-to-top loadOlder、prepend scrollTop 補位、
  // race guards (loadingOlderRef / activeTripIdRef)、auto-scroll 訊息類型判斷。
  // hasMoreOlder + loadOlder 由 hook 內部 scroll listener 自動處理,caller 只用
  // loadError 顯示 banner、retryLoadOlder 給按鈕點按。
  const { loadError, retryLoadOlder } = useChatPagination<RawRequestRow, ChatMessage>({
    activeTripId,
    bodyRef,
    messages,
    setMessages,
    rowToMessages,
    isInflightStatus: (row) => row.status === 'open' || row.status === 'processing',
    onInitialResume: (resumeId) => setInflightId(resumeId),
    setHistoryLoading,
  });

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
  // v2.31.6: useRequestSSE 改成 polling-always-on + SSE optimization；errorReason
  // 區分 'auth_expired' / 'sse_failed' / 'network'；elapsedMs 給 UI 顯示等待時間。
  const { status, error: sseError, errorReason, elapsedMs } = useRequestSSE(inflightId);

  // v2.33.47 round 7b LOW: memoize buildMessagesWithDividers — 之前每 keystroke
  // 都 O(n) walk messages list。1000-msg trip 在打字時明顯卡。
  const messagesWithDividers = useMemo(
    () => buildMessagesWithDividers(messages),
    [messages],
  );

  // v2.33.47 round 7b: activeTripId 改用 ref 抓 latest value — 之前 useEffect
  // 內讀 activeTripId 但 dep 是 [] (intentional, mount-only)；strict-mode
  // double-mount 時第二 pass 還抓 initial closure，可能 clobber 已 persisted 的
  // ActiveTripContext 值。
  const activeTripIdRef = useRef(activeTripId);
  useEffect(() => { activeTripIdRef.current = activeTripId; }, [activeTripId]);

  // Load trips list (mine + meta) once on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [myRes, allRes] = await Promise.allSettled([
          apiFetch<MyTripRow[]>('/my-trips'),
          apiFetch<TripSummary[]>('/trips?all=1'),
        ]);
        if (cancelled) return;
        if (myRes.status === 'rejected') return;
        const myJson = myRes.value;
        const allJson = allRes.status === 'fulfilled' ? allRes.value : [];
        const mine = new Set(myJson.map((r) => r.tripId));
        const myTrips = allJson.filter((t) => mine.has(t.tripId));
        setTrips(myTrips);

        // Section 5 (E4)：優先用 ActiveTripContext (cross-page persisted)，
        // fallback 第一個可見 trip。v2.33.47: 讀 ref 而非 closure capture。
        const pref = activeTripIdRef.current;
        const valid = pref && myTrips.some((t) => t.tripId === pref) ? pref : (myTrips[0]?.tripId ?? null);
        setActiveTripId(valid);
      } catch {
        // silent — empty state will guide user
      }
    }
    void load();
    return () => { cancelled = true; };
    // setActiveTripId 是 context setter（穩定）；effect 讀 activeTripIdRef.current
    // 而非 activeTripId，故維持 mount-only 不需要把 activeTripId 列入。
  }, [setActiveTripId]);

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
      { id: now, role: 'user', text, createdAt: new Date(now).toISOString(), submittedBy: user?.email ?? null, submittedByDisplayName: user?.displayName ?? null },
      { id: now + 1, role: 'assistant', text: '思考中…', pendingRequestId: -1 },
    ]);

    try {
      // mode rip-out (migration 0048): tp-request skill auto-classifies intent.
      const row = await apiFetch<{ id: number }>('/requests', {
        method: 'POST',
        body: JSON.stringify({ tripId: activeTripId, message: text }),
      });
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
  }, [activeTripId, inflightId, user]);

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
    <div className="tp-chat-shell" data-testid="chat-page" data-embedded={embedded ? 'true' : undefined}>
      <style>{SCOPED_STYLES}</style>
      {/* v2.31.86 embedded mode：TripSheet 已有 trip name + tab header，skip TitleBar repeat。 */}
      {!embedded && <TitleBar
        title={activeTrip?.title || activeTrip?.name || '聊天'}
        actions={trips && trips.length > 0 && (
          <div className="tp-titlebar-trip-menu" ref={tripMenuRef}>
            <button
              type="button"
              className="tp-titlebar-trip-picker"
              onClick={() => setTripMenuOpen((o) => !o)}
              data-testid="chat-trip-picker"
              aria-haspopup="menu"
              aria-expanded={tripMenuOpen}
              aria-label="切換行程"
              title="切換行程"
            >
              {/* v2.31.47：拔掉 picker button 內的 trip name span（TitleBar title
                  已顯 trip name；button 重複顯示視覺冗餘）。只留 ⇄ icon + ▾
                  affordance，user click 開 dropdown 看完整 trip list。 */}
              <Icon name="swap-horiz" />
              <span className="tp-titlebar-trip-picker-chevron" aria-hidden="true">▾</span>
            </button>
            {tripMenuOpen && (
              <div className="tp-titlebar-trip-dropdown" role="menu">
                {trips.map((t) => (
                  <button
                    key={t.tripId}
                    type="button"
                    className={`tp-titlebar-trip-row ${t.tripId === activeTripId ? 'is-active' : ''}`}
                    onClick={() => pickTrip(t.tripId)}
                    role="menuitem"
                    data-testid={`chat-trip-pick-${t.tripId}`}
                  >
                    <span className="tp-titlebar-trip-row-title">{t.title || t.name || t.tripId}</span>
                    <span className="tp-titlebar-trip-row-meta">{(t.countries ?? '').toUpperCase() || t.tripId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      />}

      <div className="tp-chat-body" ref={bodyRef} data-testid="chat-body">
        {loadError && activeTripId && (
          <div className="tp-chat-load-error" role="alert" data-testid="chat-load-error">
            <span className="tp-chat-load-error-text">載入訊息失敗</span>
            <button
              type="button"
              className="tp-chat-load-error-retry"
              onClick={retryLoadOlder}
              data-testid="chat-load-error-retry"
            >
              重試
            </button>
          </div>
        )}
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

        {activeTripId && messagesWithDividers.map((m) => {
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
          /* 2026-04-29:LINE 群組規則 — user message 分自己 vs 其他 collaborator。
           * 自己:右側 accent bubble(現狀)。
           * 其他人:左側 + avatar(首字)+ sender 名在 bubble 上方(LINE 對方 style)。
           * AI:左側 + AI avatar(現狀)。
           *
           * isOtherUser:user role 且 submittedBy 不等於當前登入者 email。
           * Legacy 訊息沒 submittedBy 視為自己(避免老資料全變對方 view)。 */
          const senderLocalPart = m.submittedBy?.split('@')[0];
          const isOtherUser = !isAssistant && !!m.submittedBy && m.submittedBy !== user?.email;
          // 2026-05-07：sender label 與 avatar initial 用「帳號名稱」(displayName)
          // 第一字母 — 不是 email。
          //   - 自己（is-user）：current user displayName
          //   - 他人（is-other-user）：API LEFT JOIN users 帶 submittedByDisplayName，
          //     fallback email local part（users 表查無對應的 legacy 帳號）
          const otherDisplayName = m.submittedByDisplayName || senderLocalPart || '?';
          const selfDisplayName = user?.displayName || user?.email?.split('@')[0] || '我';
          const senderDisplay = isOtherUser ? otherDisplayName : selfDisplayName;
          const senderInitial = senderDisplay.charAt(0).toUpperCase();
          // v2.33.93 simplify: 兩個 ternary 同時依 isAssistant/isOtherUser/user 分支，
          // 抽 byRole 一次決定。clsx 已在其他 component 用，這裡也採用。
          const byRole = <A, O, U>(a: A, o: O, u: U): A | O | U => (isAssistant ? a : isOtherUser ? o : u);
          return (
            <Fragment key={m.id}>
              <div className={clsx('tp-chat-msg-row', byRole('is-assistant', 'is-other-user', 'is-user'))}>
                {isAssistant && (
                  <div className="tp-chat-avatar is-ai" aria-hidden="true" data-testid="chat-avatar-ai">AI</div>
                )}
                {isOtherUser && (
                  <div className="tp-chat-avatar is-other-user" aria-hidden="true" data-testid={`chat-avatar-other-${m.id}`}>
                    {senderInitial}
                  </div>
                )}
                {!isAssistant && !isOtherUser && (
                  <div className="tp-chat-avatar is-user" aria-hidden="true" data-testid={`chat-avatar-self-${m.id}`}>
                    {senderInitial}
                  </div>
                )}
                <div className="tp-chat-msg-bubble-wrap">
                  {isOtherUser && (
                    <div className="tp-chat-msg-sender-name" data-testid={`chat-sender-${m.id}`}>{senderDisplay}</div>
                  )}
                  <div
                    className={clsx(
                      'tp-chat-msg',
                      byRole('tp-chat-msg-assistant', 'tp-chat-msg-other-user', 'tp-chat-msg-user'),
                      m.pendingRequestId && 'is-pending',
                      m.failed && 'is-failed',
                    )}
                    data-testid={`chat-msg-${isOtherUser ? 'other-user' : m.role}`}
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
                    ) : m.markdown && m.role === 'assistant' ? (
                      /* v2.33.46 round 7a security audit: 只給 assistant role 渲
                       * markdown — 即使 backend 對 user message column 寫 markdown=1，
                       * 也不 trust。collaborative trip 內 co-editor 訊息變相經
                       * sanitize.ts pipeline 不增風險，但 defense in depth：user
                       * 內容不應走 markdown render path。 */
                      <MarkdownText text={m.text} as="div" />
                    ) : (
                      /* F8 design-review: 把 user 打的 `\n` literal 轉真正換行，
                       * 配合 .tp-chat-msg 的 white-space: pre-wrap 顯示換行；
                       * 對真的就是 backslash-n 字面的 corner case 不影響 visual。 */
                      m.text.replace(/\\n/g, '\n')
                    )}
                  </div>
                </div>
              </div>
              {m.createdAt && !m.pendingRequestId && (
                <time
                  className={`tp-chat-msg-time tp-chat-msg-time-${isOtherUser ? 'other-user' : m.role}`}
                  dateTime={m.createdAt}
                  data-testid={`chat-msg-time-${m.id}`}
                >
                  {isAssistant
                    ? `Tripline AI · ${formatChatTime(m.createdAt)}`
                    : `${senderDisplay} · ${formatChatTime(m.createdAt)}`}
                </time>
              )}
            </Fragment>
          );
        })}

        {errorReason === 'auth_expired' && inflightId && (
          <div className="tp-chat-msg tp-chat-msg-assistant is-failed" role="alert">
            登入已過期。<button type="button" onClick={() => window.location.reload()} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>重新整理</button>後再試。
          </div>
        )}
        {inflightId && elapsedMs >= 3 * 60 * 1000 && errorReason !== 'auth_expired' && (
          <div className="tp-chat-msg tp-chat-msg-assistant is-pending" role="status" aria-live="polite">
            AI 還在處理（已等候 {Math.floor(elapsedMs / 60_000)} 分鐘）— 較大的請求例如 AI 健檢可能需要 5–15 分鐘。
          </div>
        )}
        {sseError && inflightId && errorReason !== 'auth_expired' && errorReason !== 'sse_failed' && (
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

  // v2.31.86 embedded mode：skip AppShell（TripSheet 已是 nested context，重複會 broken layout）。
  if (embedded) return main;

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
