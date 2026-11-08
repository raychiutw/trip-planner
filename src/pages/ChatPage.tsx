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
import { useConversation } from '../hooks/useConversation';
import { useTripSelection } from '../hooks/useMyTrips';
import type { ChatMessage } from '../lib/conversation';
import { parseUtcDate } from '../lib/parseUtcDate';
import { typedApi, unwrap } from '../lib/api/typed';
import { LS_KEY_TRIP_PREF, LS_PREFIX } from '../lib/localStorage';
import AppShell from '../components/shell/AppShell';
import TripTitleSwitcher from '../components/shell/TripTitleSwitcher';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import AccountCircle from '../components/shell/AccountCircle';
import Icon from '../components/shared/Icon';
import AiConsentSheet from '../components/AiConsentSheet';
import AiDataConsentSheet from '../components/AiDataConsentSheet';
import { useAiDataConsent } from '../hooks/useAiDataConsent';
import MarkdownText from '../components/shared/MarkdownText';

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

const SCOPED_STYLES = `
.tp-chat-shell {
  height: 100%;
  /* 「跳到最新」箭頭是 absolute，需要這層當定位脈絡；沒有的話它會脫到更外層
     （AppShell / body），位置在桌機三欄版面會完全跑掉。 */
  position: relative;
  display: flex; flex-direction: column;
  background: var(--color-secondary);
  /* owner 2026-07-20「全版」：AppShell main 已不為透明 tab 保留空間（功能頁鋪到螢幕底）。
   * 聊天底部的輸入 dock（提示條＋composer）是互動元件，不能被浮在上面的 tab 蓋住，但玻璃要有東西可折射：
   * 所以訊息區延伸到螢幕底，dock 與 tab 膠囊「浮」在訊息上面，由訊息區自己的 padding-bottom 讓位
   * （曾用 padding 把訊息擋在 composer 上方，底下只剩純色，blur 數值都對卻看起來是實心）。
   * --chat-bottom-inset ＝ dock 要避開的空間：tab 膠囊（--nav-overlay-h，桌機／無 tab 的操作頁為 0）
   * ＋ iPhone home indicator（#1140 item 8）。--chat-composer-h 是 dock 高度，由 ResizeObserver 量測寫入。 */
  --chat-bottom-inset: calc(var(--nav-overlay-h, 0px) + env(safe-area-inset-bottom, 0px));
  /* 72px＝ResizeObserver 首次量測前的 dock 高度估值；12px＝最後一則訊息與 dock 之間的呼吸空間 */
  --chat-body-pad-b: calc(var(--chat-composer-h, 72px) + var(--chat-bottom-inset) + 12px);
}
/* tp-chat-header / .tp-page-header CSS 已退役。改用 <TitleBar>，自帶
 * padding 0 24px (desktop) / 0 16px (compact)，不需額外覆寫。 */

.tp-chat-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 20px 24px var(--chat-body-pad-b);
  display: flex; flex-direction: column; gap: 12px;
}
.tp-chat-history-status {
  position: sticky; top: 0; z-index: 2;
  height: 0; flex: 0 0 0; margin-bottom: -12px;
  display: flex; justify-content: center;
}
.tp-chat-history-status > span,
.tp-chat-history-status > button {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: 1px solid var(--color-border);
  border-radius: 999px; background: var(--color-background);
  color: var(--color-foreground); font: inherit;
  font-size: var(--font-size-footnote);
}
.tp-chat-history-status > button { cursor: pointer; }
.tp-chat-history-status > button:focus-visible {
  outline: 2px solid var(--color-focus-ring); outline-offset: 2px;
}
.tp-chat-spinner {
  width: 16px; height: 16px; border: 2px solid var(--color-border);
  border-top-color: var(--color-foreground); border-radius: 50%;
  animation: tp-chat-spin 0.7s linear infinite;
}
@keyframes tp-chat-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .tp-chat-spinner { animation: none; } }
@media (max-width: 760px) { .tp-chat-body { padding: 16px 16px var(--chat-body-pad-b); } }

/* Initial history load error stays visible while messages sent during the outage remain mounted. */
.tp-chat-load-error {
  position: sticky; top: 0; z-index: 1;
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  /* G8: 原用幽靈 token --color-error*（repo 不存在）→ 永遠 fallback 到寫死 #b00020，
   * dark 不 adapt（text 1.9:1 fail）。改真 token --color-destructive*（light/dark 自適應）。 */
  background: var(--color-destructive-bg);
  color: var(--color-destructive);
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-footnote);
  margin-bottom: 8px;
}
.tp-chat-load-error-text { flex: 1; min-width: 0; }
/* dock 內的提示條不吃左右 padding（dock 是貼邊的），自己留邊 */
.tp-chat-dock .tp-chat-load-error { margin: 0 12px 8px; }
.tp-chat-load-error-retry {
  height: 32px; padding: 0 12px;
  background: var(--color-destructive);
  color: #fff;
  border: none; border-radius: var(--radius-sm, 4px);
  font-size: var(--font-size-footnote); font-weight: 500; cursor: pointer;
}
/* dark destructive(#FF6B52) 偏亮 → 白字僅 2.8:1；dark 改深字(≈6:1)。light 維持白字(5.2:1)。 */
body.dark .tp-chat-load-error-retry { color: var(--color-background); }
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
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  text-decoration: none; font: inherit; font-weight: 700;
}
.tp-chat-suggestions {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px;
}
.tp-chat-suggestion {
  min-height: var(--spacing-tap-min);
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
  background: var(--color-accent-bg);
  color: var(--color-foreground);
  /* 透明邊框：一般模式看不見；forced-colors 會把背景拿掉，這圈邊框才是氣泡唯一的輪廓（WCAG 1.4.11） */
  border: 1px solid transparent;
  border-bottom-right-radius: 4px;
}
/* 比照 App（chat_screen.dart _MessageBubble）：不用頭像，每則上方一行名稱標籤；
 * 三種氣泡 自己＝accent 淡染、AI＝中性、協作者＝靛藍淡染疊在中性底上。
 * 三者色值不可相同，由 tests/unit/chat-role-colors-distinct.test.ts 把 token 解析成實際色值驗證。 */
.tp-chat-msg-assistant {
  align-self: flex-start;
  background: var(--color-chat-ai-bubble);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  border-bottom-left-radius: 4px;
  white-space: normal;
}
.tp-chat-msg-other-user {
  align-self: flex-start;
  background: color-mix(in srgb, var(--color-collaborator) var(--collab-bubble-mix), var(--color-chat-ai-bubble));
  color: var(--color-foreground);
  border: 1px solid transparent;
  border-bottom-left-radius: 4px;
  white-space: normal;
}
.tp-chat-msg-time-other-user { align-self: flex-start; }
/* v2.31.91：markdown link 對齊 site terracotta 風格（取代 browser 預設藍/紫 underline）。
 * Assistant bubble: terracotta accent text + subtle underline，hover 變淺。
 * User bubble (accent 淡染底): 文字用 --color-accent-text（與氣泡底對比足夠），underline 同色淡化。
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
  color: var(--color-accent-text);
  text-decoration-color: color-mix(in srgb, var(--color-accent-text) 55%, transparent);
}
/* Bubble meta：每則訊息下方只有時間（角色名稱在氣泡上方的 .tp-chat-msg-sender-name）
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
.tp-chat-msg-row { display: flex; }
.tp-chat-msg-row.is-assistant { align-self: flex-start; max-width: min(680px, 85%); }
.tp-chat-msg-row.is-other-user { align-self: flex-start; max-width: min(680px, 85%); }
.tp-chat-msg-row.is-user { align-self: flex-end; max-width: min(680px, 85%); }
.tp-chat-msg-bubble-wrap { display: flex; flex-direction: column; min-width: 0; }
.tp-chat-msg-row.is-user .tp-chat-msg-bubble-wrap { align-items: flex-end; }
/* 每則上方的名稱標籤（App：labelSmall、w600、依角色上色）：AI＝muted、自己＝accent 文字色、協作者＝靛藍文字色。 */
.tp-chat-msg-sender-name {
  /* 名稱是辨識角色的主要線索，不能比 HIG 下限 11px 小（eyebrow 10px 是給全大寫短標籤的）；
   * 中文與混合大小寫名稱不適合寬字距。 */
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow-wrap: anywhere;
  max-inline-size: 100%;
  color: var(--color-muted);
  margin: 0 4px 3px 4px;
}
.tp-chat-msg-sender-name.is-user { color: var(--color-accent-text); }
.tp-chat-msg-sender-name.is-other-user { color: var(--color-collaborator-text); }
.tp-chat-msg-row .tp-chat-msg { max-width: 100%; }
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

/* 使用者自己按的停止 —— 是終結但不是錯誤，走中性態（ADR-0007）。 */
.tp-chat-msg-assistant.is-terminated {
  color: var(--color-muted);
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

/* 停止等待（ADR-0007）。次要動作 — 陪在 typing 點點旁邊，不跟送出鍵搶重量。
   HIG：長工作要隨時可退出，所以它一送出就在，不等時鐘。 */
.tp-chat-stop {
  margin-inline-start: 10px;
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 12px;
  line-height: 1.6;
  cursor: pointer;
  vertical-align: middle;
}
.tp-chat-stop:hover:not(:disabled) { color: var(--color-foreground); }
.tp-chat-stop:disabled { opacity: 0.5; cursor: default; }
.tp-chat-stop:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* 跳到最新：聊天欄置中、composer 之上。只在 user 捲離底部時渲染。
   以 composer 為定位容器，跟隨輸入區高度與鍵盤位移，避免壓到送出按鈕。 */
.tp-chat-jump-latest {
  position: absolute;
  inset-inline-start: 50%;
  inset-block-end: calc(100% + 12px);
  z-index: 4;
  inline-size: 44px;
  block-size: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
}
.tp-chat-jump-latest:hover { background: var(--color-hover); }
.tp-chat-jump-latest:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.tp-chat-jump-latest:disabled { cursor: default; }

/* dock ＝（擁有者授權提示條＋composer）。浮在訊息上面，高度含提示條，所以提示條出現時留白自動變多、
 * 「跳到最新」按鈕（以 dock 為定位容器）也自然在提示條之上。
 * W8：手機軟鍵盤彈出時 bottom 定位會被鍵盤蓋 → 依 --kb-inset（useKeyboardInset 由 visualViewport 設；
 * 桌機/鍵盤收起恆 0）上移到鍵盤上方。transition 讓收放平順。 */
.tp-chat-dock {
  position: absolute; inset-inline: 0; inset-block-end: var(--chat-bottom-inset); z-index: 3;
  transform: translateY(calc(-1 * var(--kb-inset, 0px)));
  transition: transform var(--transition-duration-fast, 150ms) ease-out;
}
.tp-chat-composer {
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  --glass-alpha: 55%; --glass-filter: blur(24px);   /* recipe：tokens.css 的 .tp-glass；owner 選 A3（原 92%／14px 只透出 8%，看不出玻璃）。輸入框自己維持實心 */
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
  border: 1px solid var(--color-border-control);
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
.tp-chat-input:focus { border-color: var(--color-accent); }
.tp-chat-input:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.tp-chat-input:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-chat-send {
  position: relative;
  border: none; cursor: pointer;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-radius: 50%;
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
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

// dock 長高時，距底部在這個範圍內視為「本來就在底部」而重新釘回；比分頁的 80px 嚴，
// 因為這裡只在 dock 高度變動當下判斷，不該把正在讀舊訊息的人拉走。
const COMPOSER_REPIN_THRESHOLD_PX = 24;

// AI 的身分只靠標籤文字辨識（沒有頭像了），所以真人不能用同一個名字冒充：撞名時加註「（成員）」。
const AI_LABEL = 'Tripline AI';
// 顯示用：只拿掉會造成誤導的不可見字元（bidi 覆寫、零寬空格、BOM、軟連字號、空白填充字元）。
// 保留 ZWJ／ZWNJ：emoji 組合與波斯文、印度系文字的名字依賴它們。
const SPOOF_INVISIBLES = /[\u202A-\u202E\u2066-\u2069\u200B\u2060\uFEFF\u00AD\u061C\u200E\u200F\u3164\u115F\u1160\u2800\u17B5]/gu;
export function sanitizeSenderName(name?: string | null): string {
  const clean = (name ?? '').replace(SPOOF_INVISIBLES, '').trim();
  return /^[\s\u200C\u200D]*$/u.test(clean) ? '' : clean; // 只剩 ZWJ／ZWNJ 也是空白名稱
}
// 比對用：比顯示更狠。NFKC 折全形，去掉所有格式字元／組合符號／空白，再把 i、1、ı、| 折成 l
// （大寫 I 與小寫 l 在無襯線字體幾乎一樣）。跨字母系統的形近字（西里爾）擋不住，根治要伺服端限制顯示名稱。
const nameKey = (s: string) =>
  s.normalize('NFKC').replace(/[\p{Cf}\p{M}\s\u3164\u115F\u1160\u2800\u17B5]+/gu, '').toLowerCase().replace(/[i1ı|]/g, 'l');
export function humanSenderLabel(name: string): string {
  const clean = sanitizeSenderName(name);
  return nameKey(clean) === nameKey(AI_LABEL) ? `${clean}（成員）` : clean;
}

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

  const [linkTripId, setLinkTripId] = useState(() => searchParams.get('tripId'));
  const { trips, status: tripsStatus, activeTripId, setActiveTrip } = useTripSelection(user?.id, {
    explicitTripId: lockTripId ?? linkTripId,
  });
  const setActiveTripId = setActiveTrip;
  useEffect(() => {
    const target = searchParams.get('tripId');
    if (target) setLinkTripId(target);
  }, [searchParams]);
  useEffect(() => {
    if (!linkTripId || lockTripId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === `${LS_PREFIX}${LS_KEY_TRIP_PREF}`) setLinkTripId(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [linkTripId, lockTripId]);
  // #1140 item 10：useKeyboardInset 改由 app root（KeyboardInsetTracker）全站掛一次，
  // composer 讀全站 --kb-inset 上移即可，這裡不再各自掛（避免雙掛 cleanup 打架）。
  // 草稿由行程 ID 擁有；自動 fallback、手動切換、明確連結都讀同一份 session-only 狀態。
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const input = activeTripId ? drafts[activeTripId] ?? '' : '';
  const setInput = useCallback((value: string, tripId = activeTripId) => {
    if (tripId) setDrafts((previous) => ({ ...previous, [tripId]: value }));
  }, [activeTripId]);
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  // AI 授權 gate（Option E）：null=未知/載入中（放行，後端 mint 為最終關卡），
  // false=已知未授權（送出時攔下、跳授權 sheet），true=已授權。
  const [aiAuthorized, setAiAuthorized] = useState<boolean | null>(null);
  // 這個行程的擁有者授權狀態（#1600）：簽發 token 查的是擁有者，旅伴不能替擁有者授權。
  // null＝未知（載入中／查詢被拒），不攔，後端 mint 當最終關卡。
  const [tripAi, setTripAi] = useState<{ tripId: string; ownerAuthorized: boolean; isOwner: boolean } | null>(null);
  const isCompanion = tripAi?.tripId === activeTripId && !tripAi.isOwner;
  const ownerMustAuthorize = isCompanion && !tripAi.ownerAuthorized;
  // 送出時被攔下的訊息（開著 sheet 時非 null）。授權後用它續送、取消則丟棄。
  const [consentGate, setConsentGate] = useState<{ text: string; tripId: string } | null>(null);
  const consentGateRef = useRef(consentGate);
  const currentTripIdRef = useRef(activeTripId);
  currentTripIdRef.current = activeTripId;
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  // AI 資料同意（ADR-0012）：送出前本地已知需要同意 → 攔下跳就地同意 sheet；或後端以 AI_CONSENT_* 擋下
  // （owner-missing＝旅伴送出但行程擁有者未同意，沒有同意動作）。被攔訊息保留，同意後續送。
  const dataConsent = useAiDataConsent();
  const [dataGate, setDataGate] = useState<{ text: string; tripId: string; mode: 'consent' | 'owner-missing' } | null>(null);
  const dataOkRef = useRef(false); // 剛同意完的那一次續送跳過檢查（send 的 closure 還是舊的 needsConsent）
  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  useEffect(() => {
    setDataGate(null);
    setDataError(null);
    consentGateRef.current = null;
    setConsentGate(null);
    setConsentBusy(false);
    setConsentError(null);
  }, [activeTripId]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // dock 浮在訊息上面（玻璃要有東西折射），訊息區要留出它的高度：量測後寫進 shell 的 CSS 變數。
  // textarea 會隨輸入長高，所以用 ResizeObserver；用 callback ref 是因為 dock 不一定在第一次 render 就掛上。
  // 長高時若使用者本來就在底部，留白增加後要把捲動位置重新釘回底部，否則最新一則會被 dock 蓋住。
  const composerObserverRef = useRef<ResizeObserver | null>(null);
  const composerRef = useCallback((el: HTMLDivElement | null) => {
    composerObserverRef.current?.disconnect();
    composerObserverRef.current = null;
    const shell = el?.closest<HTMLElement>('.tp-chat-shell');
    if (!el || !shell || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      // 被隱藏（display:none，例如嵌入的分頁切走）時高度是 0：不寫入，免得留白被歸零、切回來時最新訊息被蓋住
      if (el.offsetHeight === 0) return;
      const body = bodyRef.current;
      const wasAtBottom = !!body && body.scrollHeight - body.scrollTop - body.clientHeight <= COMPOSER_REPIN_THRESHOLD_PX;
      shell.style.setProperty('--chat-composer-h', `${el.offsetHeight}px`);
      if (body && wasAtBottom) body.scrollTop = body.scrollHeight;
    };
    apply();
    composerObserverRef.current = new ResizeObserver(apply);
    composerObserverRef.current.observe(el);
  }, []);
  const tripMenuRef = useRef<HTMLDivElement>(null);

  const {
    messages, sendMessage, inflightId, busy, historyLoading,
    loadError, initialLoadError, retryLoadOlder, loadingOlder, latestRefreshing, latestError, retryLatest,
    isAtBottom, scrollToBottom,
    sseError, errorReason, elapsedMs, stopping, stopWaiting,
  } = useConversation(activeTripId, bodyRef);

  // Deep-link prefill: /chat?tripId=...&prefill=... — DaySection 的「+ 加景點」
  // 入口會帶這兩個 param 過來，讓 user 落地就看到準備好的請求草稿。撐到 active
  // trip 設好後再 populate input + 聚焦，不直接 send 讓 user 還能微調。讀完即
  // 從 URL 拿掉，避免重新整理 / 返回又 re-prefill。
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const targetTripId = searchParams.get('tripId');
    if (!prefill && !targetTripId) return;
    if (prefill && !targetTripId && !activeTripId) return;
    if (prefill) {
      setInput(prefill, targetTripId ?? activeTripId);
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
  }, [searchParams, setSearchParams, activeTripId, setInput]);

  // v2.33.47 round 7b LOW: memoize buildMessagesWithDividers — 之前每 keystroke
  // 都 O(n) walk messages list。1000-msg trip 在打字時明顯卡。
  const messagesWithDividers = useMemo(
    () => buildMessagesWithDividers(messages),
    [messages],
  );
  const liveRequestRef = useRef<{ tripId: string; id: number } | null>(null);
  if (liveRequestRef.current?.tripId !== activeTripId || (busy && !inflightId)) liveRequestRef.current = null;
  if (activeTripId && inflightId) liveRequestRef.current = { tripId: activeTripId, id: inflightId };
  const liveTerminal = !busy && liveRequestRef.current
    ? messages.find((message) => message.role === 'assistant' && message.requestId === liveRequestRef.current?.id && !message.pendingRequestId)
    : null;
  const terminalAnnouncement = liveTerminal
    ? liveTerminal.stopUnconfirmed ? '停止等待未確認，AI 可能仍在處理'
      : liveTerminal.terminated ? '已停止等待'
      : liveTerminal.failed ? 'AI 處理失敗'
        : 'AI 已完成'
    : '';

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

  const doSend = useCallback(async (text: string) => {
    setInput('');
    await sendMessage(text, user, (code) => {
      // 後端擋下（雙方同意）：保留輸入，跳對應 sheet；本地沒有同意狀態可顯示時退回一般錯誤訊息
      if (!dataConsent.consent || !activeTripId) return false;
      setInput(text);
      setDataGate({ text, tripId: activeTripId, mode: code === 'AI_CONSENT_OWNER_REQUIRED' ? 'owner-missing' : 'consent' });
      return true;
    });
  }, [sendMessage, user, setInput, dataConsent.consent, activeTripId]);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (!activeTripId) return;
    if (inflightId) return; // busy
    // 資料同意先於操作授權：隱私同意是前提。本地尚未載入狀態時不攔，由後端 AI_CONSENT_* 當最終關卡（見 doSend）。
    if (dataConsent.needsConsent && !dataOkRef.current) {
      setDataGate({ text, tripId: activeTripId, mode: 'consent' });
      setDataError(null);
      return;
    }
    // 旅伴 + 擁有者未授權：沒有可執行的動作，只能請擁有者授權（提示常駐顯示），輸入保留。
    if (ownerMustAuthorize) return;
    // Option E：已知未授權 → 攔下、跳授權 sheet（避免建一筆 mint 不出 token 的死請求，
    // 卡住整條佇列）。null（授權狀態載入中，數毫秒窗；讀取失敗已 fail-closed 成 false）不攔，
    // 讓後端 mint 當最終關卡。
    // 旅伴的授權由擁有者決定，旅伴自己有沒有授權無關，不跳授權視窗。
    if (aiAuthorized === false && !isCompanion) {
      const pending = { text, tripId: activeTripId };
      consentGateRef.current = pending;
      setConsentGate(pending);
      setConsentBusy(false);
      setConsentError(null);
      return;
    }
    void doSend(text);
  }, [activeTripId, inflightId, aiAuthorized, isCompanion, ownerMustAuthorize, doSend, dataConsent.needsConsent]);

  // 同意資料處理後續送被攔的訊息（切換行程後不續送）。
  const acceptDataAndSend = useCallback(async () => {
    const pending = dataGate;
    if (!pending) return;
    setDataBusy(true);
    setDataError(null);
    try {
      await dataConsent.accept();
      setDataGate(null);
      if (currentTripIdRef.current === pending.tripId) {
        dataOkRef.current = true;
        send(pending.text);
        dataOkRef.current = false;
      }
    } catch {
      setDataError('同意失敗，請稍後再試。');
    } finally {
      setDataBusy(false);
    }
  }, [dataGate, dataConsent, send]);

  // 授權後續送：POST Consent → 標記已授權 → 送出原被攔訊息。
  const authorizeAndSend = useCallback(async () => {
    const pending = consentGateRef.current;
    if (!pending) return;
    setConsentBusy(true);
    setConsentError(null);
    try {
      await typedApi.post('/api/account/ai-authorization');
      setAiAuthorized(true);
      if (consentGateRef.current !== pending || currentTripIdRef.current !== pending.tripId) return;
      consentGateRef.current = null;
      setConsentGate(null);
      setConsentBusy(false);
      void doSend(pending.text);
    } catch {
      if (consentGateRef.current === pending) {
        setConsentError('授權失敗，請稍後再試。');
        setConsentBusy(false);
      }
    }
  }, [doSend]);

  // 載入 owner 對 AI 的授權狀態（一次）。讀取失敗 fail-closed 成 false（＝送出時跳授權 sheet）：
  // 維持 null 會讓未授權 owner 送出→後端 park→提示「重送並在跳窗授權」，但 sheet 只在 false 才開、
  // null 永不轉 false → 跳窗永不出現、陷入死循環（adversarial F2）。fail-closed 到 false 可從
  // sheet 授權復原，且與 AiAuthorizeCard（同端點同樣 fail-closed 到 false）一致；誤攔已授權者
  // 也只是多點一次「授權並送出」（POST 冪等），不致卡死。
  useEffect(() => {
    let cancelled = false;
    typedApi.get('/api/account/ai-authorization')
      .then((r) => { if (!cancelled) setAiAuthorized(unwrap(r).authorized); })
      .catch(() => { if (!cancelled) setAiAuthorized(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeTripId) return;
    let cancelled = false;
    typedApi.get('/api/trips/{id}/ai-authorization', { path: { id: activeTripId } })
      .then((res) => { const r = unwrap(res); if (!cancelled && typeof r?.ownerAuthorized === 'boolean') setTripAi({ tripId: activeTripId, ...r }); })
      .catch(() => { /* 查不到就不攔 */ });
    return () => { cancelled = true; };
  }, [activeTripId]);

  function pickTrip(tripId: string) {
    // Section 5 (E4)：寫進 ActiveTripContext (內部已 persist localStorage)
    setLinkTripId(null);
    setActiveTripId(tripId);
    setTripMenuOpen(false);
  }

  const activeTrip = useMemo(
    () => (trips ?? []).find((t) => t.tripId === activeTripId) ?? null,
    [trips, activeTripId],
  );

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
      e.preventDefault();
      void send(input);
    }
  }

  const composerDisabled = !activeTripId || busy;

  const main = (
    <div className="tp-chat-shell" data-testid="chat-page" data-embedded={embedded ? 'true' : undefined}>
      <style>{SCOPED_STYLES}</style>
      {/* v2.31.86 embedded mode：TripSheet 已有 trip name + tab header，skip TitleBar repeat。 */}
      {!embedded && <TitleBar
        title={
          <TripTitleSwitcher
            label={activeTrip?.title || activeTrip?.name || '聊天'}
            trips={trips ?? []}
            activeTripId={activeTripId}
            onPick={pickTrip}
            testIdPrefix="chat"
          />
        }
        account={<AccountCircle />}
      />}

      <div className="tp-chat-body" ref={bodyRef} data-testid="chat-body">
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{terminalAnnouncement}</div>
        {activeTripId && (loadingOlder || (loadError && !initialLoadError)) && (
          <div className="tp-chat-history-status" data-testid="chat-history-status">
            {loadingOlder ? <span role="status" aria-label="載入較早訊息…"><span className="tp-chat-spinner" aria-hidden="true" />載入較早訊息…</span>
              : <button type="button" onClick={retryLoadOlder} aria-label="無法載入較早訊息，重試">無法載入較早訊息・重試</button>}
          </div>
        )}
        {loadError && initialLoadError && activeTripId && (
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
        {!activeTripId && tripsStatus === 'ready' && trips?.length === 0 && (
          <div className="tp-chat-empty">
            <div className="tp-chat-empty-icon" aria-hidden="true"><Icon name="chat" /></div>
            <h2>還沒有行程可以聊</h2>
            <p>聊天會直接改你選定的行程時間軸。先去新增一個再回來。</p>
            <Link to="/trips" className="cta">去新增行程</Link>
          </div>
        )}

        {!activeTripId && tripsStatus !== 'ready' && (
          <div className="tp-chat-empty"><p>{tripsStatus === 'error' ? '載入行程失敗，請稍後再試' : '載入中…'}</p></div>
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
           * 其他人:左側 + 名字在 bubble 上方。AI:左側 + 「Tripline AI」在 bubble 上方。
           * 三者都不用頭像（比照 App）。
           *
           * isOtherUser:user role 且 submittedBy 不等於當前登入者 email。
           * Legacy 訊息沒 submittedBy 視為自己(避免老資料全變對方 view)。 */
          const senderLocalPart = m.submittedBy?.split('@')[0];
          const isOtherUser = !isAssistant && !!m.submittedBy && m.submittedBy !== user?.email;
          // 2026-05-07：sender label 用「帳號名稱」(displayName) — 不是 email。
          //   - 自己（is-user）：current user displayName
          //   - 他人（is-other-user）：API LEFT JOIN users 帶 submittedByDisplayName，
          //     fallback email local part（users 表查無對應的 legacy 帳號）
          const otherDisplayName = sanitizeSenderName(m.submittedByDisplayName) || senderLocalPart || '?';
          const selfDisplayName = sanitizeSenderName(user?.displayName) || user?.email?.split('@')[0] || '我';
          const senderDisplay = humanSenderLabel(isOtherUser ? otherDisplayName : selfDisplayName);
          // v2.33.93 simplify: 兩個 ternary 同時依 isAssistant/isOtherUser/user 分支，
          // 抽 byRole 一次決定。clsx 已在其他 component 用，這裡也採用。
          const byRole = <A, O, U>(a: A, o: O, u: U): A | O | U => (isAssistant ? a : isOtherUser ? o : u);
          const roleCls = byRole('is-assistant', 'is-other-user', 'is-user');
          return (
            <Fragment key={m.id}>
              <div className={clsx('tp-chat-msg-row', roleCls)}>
                <div className="tp-chat-msg-bubble-wrap">
                  <div
                    className={clsx('tp-chat-msg-sender-name', roleCls)}
                    data-testid={`chat-sender-${m.id}`}
                  >
                    {isAssistant ? AI_LABEL : senderDisplay}
                  </div>
                  <div
                    className={clsx(
                      'tp-chat-msg',
                      byRole('tp-chat-msg-assistant', 'tp-chat-msg-other-user', 'tp-chat-msg-user'),
                      m.pendingRequestId && 'is-pending',
                      m.failed && 'is-failed',
                      m.terminated && 'is-terminated',
                    )}
                    data-testid={`chat-msg-${isOtherUser ? 'other-user' : m.role}`}
                  >
                    {m.pendingRequestId ? (
                      <>
                        <span className="tp-chat-typing" aria-label="AI 思考中">
                          <span /><span /><span />
                        </span>
                        <button
                          type="button"
                          className="tp-chat-stop"
                          data-testid="chat-stop-waiting"
                          onClick={stopWaiting}
                          disabled={!inflightId || stopping}
                        >
                          停止等待
                        </button>
                      </>
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
                  {formatChatTime(m.createdAt)}
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

      <div className="tp-chat-dock" ref={composerRef}>
        {ownerMustAuthorize && (
          <div className="tp-chat-load-error" role="status" data-testid="chat-owner-unauthorized">
            <span className="tp-chat-load-error-text">請行程擁有者授權 AI 後，才能在這個行程使用 AI。</span>
          </div>
        )}
        <form
          className="tp-chat-composer tp-glass"
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
        >
          {/* 捲到底箭頭以 dock 為定位容器（在提示條與 composer 之上）；只在 user 捲離底部時出現。
              aria-live 不用 —— 它是導覽控制項不是狀態播報。 */}
          {activeTripId && latestRefreshing && (
            <div className="tp-chat-jump-latest" role="status" aria-live="polite" aria-label="正在更新最新訊息" data-testid="chat-latest-refreshing">
              <span className="tp-chat-spinner" aria-hidden="true" /><span className="sr-only">正在更新最新訊息</span>
            </div>
          )}
          {activeTripId && !latestRefreshing && latestError && (
            <button type="button" className="tp-chat-jump-latest" onClick={retryLatest}
              aria-label="更新最新訊息失敗，重試" data-testid="chat-latest-retry">↻</button>
          )}
          {activeTripId && !latestRefreshing && !latestError && !isAtBottom && (
            <button
              type="button"
              className="tp-chat-jump-latest"
              data-testid="chat-jump-to-latest"
              onClick={scrollToBottom}
              aria-label="回到最新訊息"
              title="回到最新訊息"
            >
              <span aria-hidden="true">↓</span>
            </button>
          )}
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

      {dataConsent.consent && (
        <AiDataConsentSheet
          open={dataGate !== null}
          consent={dataConsent.consent}
          mode={dataGate?.mode}
          message={dataGate?.text}
          busy={dataBusy}
          error={dataError}
          onAccept={acceptDataAndSend}
          onDecline={() => { setDataGate(null); setDataError(null); }}
        />
      )}
      <AiConsentSheet
        open={consentGate !== null}
        message={consentGate?.text ?? ''}
        busy={consentBusy}
        error={consentError}
        onAuthorizeAndSend={authorizeAndSend}
        onCancel={() => { consentGateRef.current = null; setConsentGate(null); setConsentError(null); }}
      />
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
