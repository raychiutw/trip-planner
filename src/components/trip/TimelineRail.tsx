/**
 * TimelineRail — 桌機 + 手機統一 compact editorial rail with V3 inline expansion (PR2 v2.7)
 *
 * Reverses the 2026-04-19 「整行可點跳詳情頁」 decision. Click a row → toggle
 * inline detail panel (description / locations / note). Note is click-to-edit
 * (textarea + Cmd+Enter / ESC) and persists via PATCH /api/trips/:id/entries/:eid.
 * On save success → dispatch `tp-entry-updated` event so TripPage triggers
 * `refetchCurrentDay`.
 *
 * Accordion behavior: only one row expanded at a time (parent-managed `expandedId`).
 * StopDetailPage URL still resolves for direct deep-link sharing but no longer
 * reachable via list click.
 */

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
  DndContext, useDndMonitor, useDroppable,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTripId } from '../../contexts/TripIdContext';
import { useTripDays } from '../../contexts/TripDaysContext';
import { apiFetchRaw } from '../../lib/apiClient';
import { requestTravelRecompute, getAutoRecomputeStatus } from '../../lib/travelRecompute';
import { captureDragScroll, restoreDragScroll } from '../../lib/preserveScroll';
import { EVENT } from '../../lib/events';
import { POI_TYPE_LABELS, poiCategoryLabel, type PoiType } from '../../lib/poiCategory';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';
import Icon from '../shared/Icon';
import ConfirmModal from '../shared/ConfirmModal';
import { showToast } from '../shared/Toast';
import { useAutosave } from '../../hooks/useAutosave';
import { ApiError } from '../../lib/errors';
import MarkdownText from '../shared/MarkdownText';
// 2026-05-03 modal-to-fullpage migration: EntryActionPopover 由 /trip/:id/stop/:eid/(copy|move) page 取代。
// DayOption type 抽到 src/lib/entryAction.ts 給 caller (TripPage dayOptions) 共用。
import { useNavigate } from 'react-router-dom';
import MapLinks from './MapLinks';
import TravelPill from './TravelPill';
import { TripTimePicker } from '../TripTimePicker';
import type { StopPoiOptionData, TimelineEntryData } from './TimelineEvent';
import { parseEntryTime, formatDurationCompact, formatTimeRange, deriveTypeMeta } from '../../lib/timelineUtils';
import { dayNumFromId } from '../../lib/entryAction';
import { useDragDrop } from '../../hooks/useDragDrop';
import { useTripSegments } from '../../hooks/useTripSegments';
import { getTimelineEntryDisplayTitle } from '../../lib/stopDisplay';
import { condenseHours } from '../../lib/poiHours';

const SCOPED_STYLES = `
.tp-rail-detail {
  /* 2026-07-07 user 要求：展開明細與 header 卡同寬（原 margin-left 56/44px
   * 對齊 dot 縮排 — v2.30.12 註解保留於 git history）。 */
  margin: 4px 0 8px;
  padding: 14px 16px;
  /* owner 2026-07-19「展開的行程景點要壓在 timeline 上」：展開卡左緣(x≈30)蓋過 timeline
   * spine(.tp-rail-body::before，position:absolute@x≈49)。absolute pseudo 的 paint order
   * 高過 static 子元素 → 直線畫在展開卡「之上」穿過內容。給展開卡 relative + z-index:1
   * 建 stacking → 卡壓在 spine 之上（線在展開區被卡蓋住，符合「壓在 timeline 上」）。 */
  position: relative;
  z-index: 1;
  /* 展開明細與卡片同色系（繼承 .tp-rail-item[data-tone] 的 --tone-*；neutral fallback tertiary）。
   * v2.57.x：外層內容欄整片改 --color-secondary 後（見 TripPage.tsx .tp-trip-page-shell），
   * fallback 若還留在 secondary 會跟外層同色、展開明細沒層次 —— 調高一階到 tertiary。 */
  background: var(--tone-subtle, var(--color-tertiary));
  border: 1px solid var(--tone-bg, var(--color-border));
  border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: 12px;
  /* iOS 式展開（2026-07-07）：interpolate-size 讓 height:auto 可 transition，
   * 搭 @starting-style 從 0 高平滑長開（Apple bezier）。不支援的瀏覽器
   * height/overflow 宣告無害，動畫 fallback 到下方 keyframes fade。
   * 收合維持條件 unmount（立即消失）— 測試與 a11y 語意不變。 */
  interpolate-size: allow-keywords;
  height: auto;
  overflow: hidden;
  transition:
    height 320ms var(--transition-timing-function-apple, ease-out),
    margin 320ms var(--transition-timing-function-apple, ease-out),
    padding 320ms var(--transition-timing-function-apple, ease-out),
    opacity 240ms ease-out;
  animation: tp-rail-detail-in 160ms var(--transition-timing-function-apple, ease-out);
}
@starting-style {
  .tp-rail-detail {
    height: 0;
    margin-top: 0; margin-bottom: 0;
    padding-top: 0; padding-bottom: 0;
    opacity: 0;
  }
}
/* 支援 interpolate-size 的瀏覽器走高度 transition，關掉舊 fade keyframes
 * 避免 opacity 被 animation 蓋過 transition（兩者疊跑不協調）。 */
@supports (interpolate-size: allow-keywords) {
  .tp-rail-detail { animation: none; }
}
@media (max-width: 760px) {
  .tp-rail-detail { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-rail-detail { transition: none; animation: none; }
}
@keyframes tp-rail-detail-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-rail-detail-section h4 {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-muted);
  margin: 0 0 6px;
}
.tp-rail-detail-desc {
  font-size: var(--font-size-body); line-height: 1.55;
  color: var(--color-foreground);
  margin: 0;
}
/* v2.30.14：景點說明 section — master POI 整合 meta row + MapLinks */
.tp-rail-poi-meta {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-meta-sep { opacity: 0.4; }
.tp-rail-poi-meta-star { color: var(--color-accent); font-weight: 700; }
.tp-rail-poi-meta-strong { color: var(--color-foreground); font-weight: 600; }
.tp-rail-detail-maps { margin-bottom: 10px; }
.tp-rail-detail-desc-master {
  margin-top: 8px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

.tp-rail-note-value {
  font-size: var(--font-size-body); line-height: 1.55;
  background: var(--color-background); border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: text;
  min-height: var(--spacing-tap-min);
  white-space: pre-wrap;
  transition: border-color 120ms;
}
.tp-rail-note-value:hover { border-color: var(--color-border); }
.tp-rail-note-value.is-empty { color: var(--color-muted); font-style: italic; cursor: pointer; }
.tp-rail-note-input {
  font: inherit; font-size: var(--font-size-body); line-height: 1.55;
  width: 100%;
  background: var(--color-background); border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  resize: vertical;
  min-height: 88px;
  color: var(--color-foreground);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-rail-note-input:focus { outline: none; }
.tp-rail-note-actions {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  flex-wrap: wrap;
}
.tp-rail-note-save, .tp-rail-note-cancel {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  border-radius: var(--radius-full); cursor: pointer;
  /* H4: Apple HIG 44px tap target — these are primary edit-mode actions. */
  min-height: var(--spacing-tap-min);
  padding: 8px 16px;
  border: 1px solid transparent;
}
.tp-rail-note-save {
  background: var(--color-accent-fill); color: var(--color-accent-foreground); border-color: var(--color-accent-fill);
}
.tp-rail-note-save:hover:not(:disabled) { filter: brightness(0.95); }
.tp-rail-note-save:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-rail-note-cancel {
  background: transparent; color: var(--color-muted);
}
.tp-rail-note-cancel:hover { background: var(--color-background); color: var(--color-foreground); }
.tp-rail-note-kbd { font-size: var(--font-size-caption); color: var(--color-muted); margin-left: auto; }
.tp-rail-note-kbd kbd {
  background: var(--color-background); padding: 1px 6px; border-radius: var(--radius-xs);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: var(--font-size-caption); border: 1px solid var(--color-border);
}
/* 鍵盤捷徑提示只在有實體鍵盤的裝置顯示；觸控裝置（無 hover + 粗指標）沒有 ⌘/esc 鍵。 */
@media (hover: none) and (pointer: coarse) {
  .tp-rail-note-kbd { display: none; }
}
.tp-rail-note-error {
  font-size: var(--font-size-footnote); color: var(--color-destructive);
  margin-top: 4px;
}

/* caret 現為獨立 toggle button（無障礙 toggle）；rotate 由 tokens.css
   .tp-rail-item[data-expanded] 處理，這裡只補 button reset + focus/disabled。 */
.tp-rail-caret { transition: transform 120ms; display: inline-block; background: none; border: none; padding: 0; margin: 0; font: inherit; line-height: 1; color: var(--color-muted); cursor: pointer; }
.tp-rail-caret:disabled { cursor: default; opacity: 0.4; }
.tp-rail-caret:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; border-radius: var(--radius-sm); }

/* 備選景點 list — alternates only (v2.30.14)。master POI 已升格到 .tp-rail-poi-meta */
.tp-rail-poi-list { display: flex; flex-direction: column; gap: 8px; }
.tp-rail-poi-card {
  /* 備選 = 第三色粉（柔褐三色主題 2026-06）*/
  background: var(--color-accent-3-subtle);
  border: 1px solid var(--color-accent-3-bg);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: border-color 160ms var(--transition-timing-function-apple);
}
.tp-rail-poi-card:hover { border-color: var(--color-accent-3); }
.tp-rail-poi-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.tp-rail-poi-name {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.35;
}
.tp-rail-poi-type {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  background: var(--color-tertiary);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}
.tp-rail-poi-card-meta {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-desc {
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  margin-top: 6px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-rail-poi-note {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 4px;
  line-height: 1.55;
}

/* 設為正選 按鈕（沿用 EditEntryPage .set-master：terracotta tonal，粉底備選卡上仍清晰）。 */
.tp-rail-poi-actions { display: flex; gap: 8px; margin-top: 10px; }
.tp-rail-set-master {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 32px; padding: 0 14px;
  border: none; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  cursor: pointer;
}
.tp-rail-set-master:hover:not(:disabled) { background: var(--color-accent-bg); }
.tp-rail-set-master:disabled { opacity: 0.5; cursor: default; }
.tp-rail-set-master .svg-icon { width: 15px; height: 15px; }
.tp-rail-set-master:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

/* 起訖時間 chip（V2）：header sub-line 內可點膠囊，terracotta tonal + pencil；空值虛線提示。 */
.tp-rail-time-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px;
  border: 1px solid transparent; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-caption2); font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
  cursor: pointer; line-height: 1.4;
}
.tp-rail-time-chip:hover:not(:disabled) { border-color: var(--color-accent-bg); background: var(--color-accent-bg); }
.tp-rail-time-chip[aria-expanded="true"] { border-color: var(--color-accent); }
.tp-rail-time-chip.is-empty {
  background: transparent; color: var(--color-muted);
  border-color: var(--color-line-strong); border-style: dashed; font-weight: 600;
}
.tp-rail-time-chip:disabled { opacity: 0.55; cursor: default; }
.tp-rail-time-chip .svg-icon { width: 11px; height: 11px; opacity: 0.75; }
.tp-rail-time-chip:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

/* 起訖時間 popup（portal 到 body，逃離 header .tp-rail-content overflow:hidden 裁切）。
   z 低於內層 TripTimePicker 的 .tp-time-popover(1100)，高於 sticky-nav(200)。 */
.tp-rail-time-pop {
  position: fixed; z-index: 1000;
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px; min-width: 208px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px rgba(42, 31, 24, 0.18);
}
.tp-rail-time-pop-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
/* 抵達/離開 標籤在 flex row 內被壓成 min-content → 2 字 CJK 折成上下兩行（audit）。
 * nowrap + flex-shrink:0 保持單行。 */
.tp-rail-time-pop-label { font-size: var(--font-size-caption); font-weight: 700; color: var(--color-muted); white-space: nowrap; flex-shrink: 0; }
.tp-rail-time-pop-done {
  align-self: flex-end; min-height: 36px; padding: 0 18px;
  border: none; border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  font: inherit; font-size: var(--font-size-caption); font-weight: 700; cursor: pointer;
}
.tp-rail-time-pop-done:hover { background: var(--color-accent-deep); }

/* 2026-04-29 mockup parity:expanded toolbar 從 body 上方移到底部(mockup S12
 * Variant A 規範)。margin-top + padding-top + border-top 視覺分隔 body 內容。
 * gap 改 4px 讓 4+2 兩組看起來更緊。 */
/* rev2 Section 02：head 右側動作簇 — ⋯ context menu + 展開 caret。
 * 取代舊「展開明細底部一排 icon 工具列」（複/移/編/刪），把動作收進單顆 ⋯（Apple 列表語彙）。 */
.tp-rail-head-actions {
  /* owner 2026-07-19：⋯ 與 ⌄ 兩鈕 gap 2px 太近 → 6px 拉開。 */
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
}

/* ⋯ trigger：桌機 hover / focus / menu 開啟才顯（Apple Music track row 行為，resting 列乾淨）；
 * 觸控無 hover → 淡顯恆在，才點得到。 */
.tp-rail-menu-trigger {
  border: 0; background: transparent; cursor: pointer;
  width: 32px; height: 32px; border-radius: var(--radius-full);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-muted);
  opacity: 0; transition: opacity 140ms, background 140ms, color 140ms;
}
.tp-rail-menu-trigger .svg-icon { width: 18px; height: 18px; }
.tp-rail-menu-trigger:hover { background: var(--color-hover, var(--color-secondary)); color: var(--color-foreground); }
@media (hover: hover) {
  .tp-rail-item:hover .tp-rail-menu-trigger,
  .tp-rail-menu-trigger:focus-visible,
  .tp-rail-menu-trigger[aria-expanded="true"] { opacity: 1; }
}
.tp-rail-menu-trigger:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; opacity: 1; }
@media (hover: none) { .tp-rail-menu-trigger { opacity: 0.65; } }

/* ⋯ menu：原生 Popover API（top-layer 自動逃離 .tp-rail-content overflow:hidden、
 * light-dismiss 免自寫）。top-layer 不隨 anchor → 開啟時 JS 依 trigger rect 設 top/left。 */
.tp-rail-menu {
  position: fixed; margin: 0; inset: auto;
  min-width: 208px; max-width: 264px; padding: 6px;
  /* 短視窗（landscape phone、8 項 menu ~320px）夾在畫面內可捲，避免末項（刪除）落在畫面外不可及。 */
  max-height: calc(100dvh - 16px); overflow-y: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 10px 28px rgba(0,0,0,0.12));
  z-index: var(--z-modal, 9000);
}
.tp-rail-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 9px 10px; border: 0; background: transparent;
  border-radius: var(--radius-sm);
  font: inherit; font-size: var(--font-size-subheadline);
  color: var(--color-foreground); text-align: left; cursor: pointer;
}
.tp-rail-menu-item .svg-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.tp-rail-menu-item:hover,
.tp-rail-menu-item:focus-visible { background: var(--color-hover, var(--color-secondary)); outline: none; }
.tp-rail-menu-item.is-danger { color: var(--color-destructive); }
.tp-rail-menu-item.is-danger .svg-icon { color: var(--color-destructive); }
.tp-rail-menu-item.is-danger:hover,
.tp-rail-menu-item.is-danger:focus-visible { background: var(--color-priority-high-bg, var(--color-hover)); }
.tp-rail-menu-sep { height: 1px; margin: 5px 6px; background: var(--color-border); }

/* 拖拉排序 grip：rev2 只在排序模式（⋯「重新排序」進入）顯示 — resting 列不放 grip（Apple 慣例：
 * 排序在 ⋯ 內，不在列上排 icon）。桌機 + 觸控一致由排序模式驅動。 */
.tp-rail-grip {
  border: 0; background: transparent;
  display: none; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  cursor: grab; color: var(--color-accent);
  border-radius: var(--radius-sm);
  /* drag-vs-scroll：pan-y 讓垂直快滑仍捲動 timeline，長按走 TouchSensor 認定 reorder。 */
  touch-action: pan-y; flex-shrink: 0;
}
.tp-rail-body[data-sort-mode] .tp-rail-grip { display: inline-flex; }
/* owner ⑧：排序模式時右邊 caret › 隱藏，grip 顯示在同位置（head-actions）。 */
.tp-rail-body[data-sort-mode] .tp-rail-caret { display: none; }
.tp-rail-grip:active { cursor: grabbing; }
.tp-rail-grip:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; opacity: 1; }
.tp-rail-grip .svg-icon { width: 16px; height: 16px; }

/* 排序模式「完成」bar — sticky 在 rail 底，退出排序模式。 */
.tp-rail-sort-done {
  position: sticky; bottom: 8px; z-index: 2;
  display: flex; justify-content: center; margin: 10px 0 2px;
  pointer-events: none;
}
.tp-rail-sort-done button {
  pointer-events: auto;
  font: inherit; font-size: var(--font-size-subheadline); font-weight: 700;
  padding: 8px 22px; border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border: 0; cursor: pointer; box-shadow: var(--shadow-md, 0 6px 16px rgba(0,0,0,0.12));
}

/* 2026-07-07 跨天拖拉：拖曳懸停本日 rail 時淡高亮（drop-target 回饋）。
 * neutral 陰影 + 淡底，不用 tone 框（三色系統雷：tone 太淺別當框）。 */
.tp-rail-body.is-drop-target {
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  box-shadow: inset 0 0 0 2px var(--color-border);
  transition: background 120ms ease-out;
}
/* 空日 drop 槽：dashed 空槽提示可拖入（僅 dndManaged 空日 render 時出現）。 */
.tp-rail-body.is-empty-day {
  min-height: 56px;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}
.tp-rail-body.is-empty-day::after {
  content: '拖曳景點到這裡';
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
`;

interface TimelineRailProps {
  events: TimelineEntryData[];
  /** Activate "now" indicator for this index */
  nowIndex?: number;
  /** v2.10 Wave 1: trip_days.id for current day — passed to RailRow for copy/move
   *  popover currentDayId + copy POST default sortOrder. Optional for tests. */
  dayId?: number | null;
  /** 2026-07-07 跨天拖拉：true = 由外層（TripPage）統一 DndContext 管理 —
   *  rail 不自建 context，同日 reorder 改經 useDndMonitor 接（active/over 都
   *  屬本 rail 才處理），跨天 drop 由 TripPage onDragEnd 處理。
   *  預設 false（EditEntryPage 等獨立頁維持自建 context 原行為）。 */
  dndManaged?: boolean;
}

/** dndManaged 模式的事件橋 — useDndMonitor 是 hook 不能條件呼叫，抽小元件條件 render。 */
function DndMonitorBridge({ onDragStart, onDragEnd }: { onDragStart: () => void; onDragEnd: (e: DragEndEvent) => void }) {
  // onDragCancel（Escape / 鍵盤取消）走獨立事件、不觸發 onDragEnd → 也還原捲動，
  // 否則取消時 autoScroll 位移留著、頁面停在錯位。
  useDndMonitor({ onDragStart, onDragEnd, onDragCancel: restoreDragScroll });
  return null;
}

interface RailRowProps {
  entry: TimelineEntryData;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  isPast: boolean;
  isNow: boolean;
  isLast: boolean;
  dayId?: number | null;
  /** rev2 Section 02：排序模式（由 ⋯ menu「重新排序」開啟）— true 時所有 row 顯 grip。 */
  sortMode: boolean;
  /** ⋯ menu「重新排序」→ 進排序模式（顯 grip + 底部「完成排序」）。 */
  onEnterSortMode: () => void;
  /** rev2 mockup：停留站序號（跳過飯店）。null = 飯店（給床 icon 不給號，當日路線起訖錨點 DESIGN.md:190）。 */
  stopNumber: number | null;
  /** W13 拖拉 a11y：⋯ menu「上移一格/下移一格」的鍵盤/觸控替代排序（不靠拖曳，給 VoiceOver/TalkBack）。 */
  onMoveStep?: (entryId: number, dir: 'up' | 'down') => void;
}

/** ⋯ context menu 的一列（或分隔線）。 */
type RailMenuItem =
  | { kind: 'sep' }
  | {
      kind: 'item';
      label: string;
      icon: React.ComponentProps<typeof Icon>['name'];
      danger?: boolean;
      onSelect: () => void;
      testid?: string;
    };

/**
 * ⋯ context menu — rev2 mockup Section 02：把停留卡的動作從「展開明細一排 icon 鈕」
 * 收進單顆 ⋯（Apple 列表語彙，不在列上排 6 顆 icon）。
 * 刻意用原生 Popover API（本 repo 首處；EntryTimeChip 的 popup 是 createPortal + 手寫 open state，
 * 兩者不同機制）：native 免費拿 top-layer（自動逃離 .tp-rail-content 的 overflow:hidden、免 portal /
 * z-index 戰爭）+ light-dismiss（點外面 / Esc 關閉 + 焦點歸還 trigger，免自寫 handler）。top-layer
 * 預設不跟 anchor 走，故開啟時（toggle→open）依 trigger rect 定位。
 */
function RailRowMenu({ menuId, label, items, testid }: {
  menuId: string;
  label: string;
  items: RailMenuItem[];
  testid?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // native popover invoker 不自動反映可被 CSS / AT 讀取的 aria-expanded 屬性 → 手動追蹤開合
  // （讓 SR 念「已展開的選單按鈕」+ 讓 .tp-rail-menu-trigger[aria-expanded="true"] 開啟時保持可見）。
  const [open, setOpen] = useState(false);
  const positionMenu = () => {
    const t = triggerRef.current;
    const m = menuRef.current;
    if (!t || !m) return;
    const r = t.getBoundingClientRect();
    const mh = m.offsetHeight || 300;
    const mw = m.offsetWidth || 216;
    // 下方空間夠 → 貼 trigger 下緣；否則往上翻。右對齊 trigger、夾在 viewport 內。
    const top = window.innerHeight - r.bottom > mh + 12 ? r.bottom + 6 : Math.max(8, r.top - mh - 6);
    const left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8));
    m.style.top = `${top}px`;
    m.style.left = `${left}px`;
  };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tp-rail-menu-trigger"
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`更多動作：${label}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={testid}
      >
        <Icon name="ellipsis" />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        className="tp-rail-menu"
        aria-label={`${label} 的動作`}
        onToggle={(e) => {
          const isOpen = e.newState === 'open';
          setOpen(isOpen);
          if (!isOpen) return;
          positionMenu();
          // 開啟時焦點移進 menu 首項（鍵盤導航）；native popover 已管 Esc / 點外面關閉 + 焦點歸還 trigger。
          menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        }}
        onKeyDown={(e) => {
          const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          if (!items || items.length === 0) return;
          const arr = Array.from(items);
          const cur = arr.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); arr[cur < 0 ? 0 : (cur + 1) % arr.length]?.focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); arr[cur < 0 ? arr.length - 1 : (cur - 1 + arr.length) % arr.length]?.focus(); }
          else if (e.key === 'Home') { e.preventDefault(); arr[0]?.focus(); }
          else if (e.key === 'End') { e.preventDefault(); arr[arr.length - 1]?.focus(); }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) =>
          it.kind === 'sep' ? (
            <div key={`sep-${i}`} className="tp-rail-menu-sep" role="separator" />
          ) : (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={clsx('tp-rail-menu-item', it.danger && 'is-danger')}
              onClick={() => {
                // 關 popover 再執行動作。try/catch 容忍 jsdom（無原生 Popover API）與「已關閉」狀態。
                try { menuRef.current?.hidePopover(); } catch { /* popover 未開 / 環境不支援 */ }
                it.onSelect();
              }}
              data-testid={it.testid}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </button>
          ),
        )}
      </div>
    </>
  );
}

// v2.33.28: dedupe — 改 import POI_TYPE_LABELS canonical (poiCategory.ts)。
// hotel canonical = '飯店'（之前本地 '住宿' 屬 drift bug 家族 v2.31.23 root cause）。

// v2.33.45 round 6b: wrap memo — 之前 alternate POI 列表每筆 row 都會在
// RailRow re-render 時跟著 re-render，trips 含 hotel + ~10 alternates 時
// 浪費 render。poi prop 來自 entry.stopPois.filter(sort_order>1)，引用穩定。
interface StopPoiChoiceCardProps {
  poi: StopPoiOptionData;
  tripId: string | null;
  entryId: number | null;
  dayNum: number | null;
}

const StopPoiChoiceCard = memo(function StopPoiChoiceCard({
  poi, tripId, entryId, dayNum,
}: StopPoiChoiceCardProps) {
  const [promoting, setPromoting] = useState(false);
  const metaParts: string[] = [];
  if (typeof poi.rating === 'number') metaParts.push(`★ ${poi.rating.toFixed(1)}`);
  if (poi.price) metaParts.push(poi.price);
  const hoursStr = condenseHours(poi.hours);
  if (hoursStr) metaParts.push(hoursStr);
  if (poi.reservation) metaParts.push(poi.reservation);
  // poi.category 是 Google primaryType（英文）— 經 poiCategoryLabel 映射成中文，
  // 不再直接露英文（沖繩備選卡的「tourist_attraction」等）；空則 fallback poi.type。
  // 備選卡無相鄰粗類 badge，故保留 poi.type fallback（跟正選不同，正選只顯示細類）。
  const typeLabel = poiCategoryLabel(poi.category)
    ?? (poi.type ? POI_TYPE_LABELS[poi.type as PoiType] ?? poi.type : null);

  // 設為正選：把此備選 swap 成 entry 的 master POI（後端 PATCH /entries/:eid/master 做
  // swap sort_order + OCC + 同 TX mark segments stale）。promote 改變 entry 座標 → 觸發
  // travel 重算。poiId 缺（未存檔搜尋結果）→ 無 PATCH target，停用。跨區距離提醒留在
  // 全編輯頁；inline 走輕量快速 path，重算後 TravelPill 會顯示真實距離。
  // OCC：timeline 資料不帶 entry_pois_version，故 inline promote 走 LWW（同 inline 備註）；
  // 需嚴格防丟更新時走全編輯頁（帶 version）。
  const canPromote = poi.poiId != null && tripId != null && entryId != null;
  const handleSetMaster = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPromote || promoting) return;
    setPromoting(true);
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryId}/master`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ poiId: poi.poiId }),
      });
      if (!res.ok) {
        // LWW（未帶 version）→ 不會 STALE 409；失敗一律 toast + refetch resync。
        showToast('設為正選失敗', 'error', 5000);
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId, entryId } }));
        return;
      }
      requestTravelRecompute(tripId, dayNum).catch(() => undefined);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId, travelRecomputeRequested: true },
      }));
      showToast(`已將「${poi.name}」設為正選`, 'success', 3000);
    } catch {
      showToast('設為正選失敗', 'error', 5000);
    } finally {
      setPromoting(false);
    }
  };

  // v2.30.14：StopPoiChoiceCard 只渲染備選 (alternate)，「正選」已升格到景點說明。
  // v2.33.93 simplify: onClick stopPropagation 從 wrapper <div> 搬上 <article>，
  // 拔掉純為 event isolation 而存在的無布局意義 wrapper。
  return (
    <article className="tp-rail-poi-card" data-variant="alternate" onClick={(e) => e.stopPropagation()}>
      <div className="tp-rail-poi-head">
        <span className="tp-rail-poi-name">{poi.name}</span>
        {typeLabel && <span className="tp-rail-poi-type">{typeLabel}</span>}
        {poi.location && <MapLinks location={poi.location} inline />}
      </div>
      {metaParts.length > 0 && (
        <div className="tp-rail-poi-card-meta">{metaParts.join(' · ')}</div>
      )}
      {poi.description && (
        <MarkdownText text={poi.description} as="div" className="tp-rail-poi-desc" inline />
      )}
      {poi.note && (
        <MarkdownText text={poi.note} as="div" className="tp-rail-poi-note" inline />
      )}
      {canPromote && (
        <div className="tp-rail-poi-actions">
          <button
            type="button"
            className="tp-rail-set-master"
            onClick={handleSetMaster}
            disabled={promoting}
            data-testid={`timeline-rail-set-master-${entryId}-${poi.poiId}`}
          >
            <Icon name="swap-horizontal" />
            設為正選
          </button>
        </div>
      )}
    </article>
  );
});

/**
 * EntryTimeChip — timeline 展開列 header 內「起訖時間」可點 chip（V2）。點 chip → portal
 * 浮出共用 TripTimePicker（抵達 / 離開），就地改時間，不必進全編輯頁、不必展開列。
 *
 * 為何 portal：header 的 .tp-rail-content 是 overflow:hidden，inline 浮層會被裁切；portal
 * 到 document.body 逃離裁切，用 chip rect 定位（fixed）。outside-click 排除內層
 * TripTimePicker 的 .tp-time-popover portal，避免點時/分格誤關本 popup。
 *
 * 存檔：PATCH /trips/:id/entries/:eid { start_time | end_time }。後端會依抵達時間重排當日
 * （resortDayByArrival）；前端 dispatch entryUpdated + requestTravelRecompute 觸發重算與
 * refetch。LWW（同 inline 備註）— 不帶 OCC token。
 */
function EntryTimeChip({ tripId, entryId, dayNum, start, end }: {
  tripId: string | null;
  entryId: number | null;
  dayNum: number | null;
  start: string | null;
  end: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [startDraft, setStartDraft] = useState(start ?? '');
  const [endDraft, setEndDraft] = useState(end ?? '');
  const chipRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // popup 關閉時，隨 entry 最新值 seed draft（refetch / master swap 帶新時間）；開啟中
  // 不動，保住使用者進行中的編輯。
  useEffect(() => {
    if (!open) { setStartDraft(start ?? ''); setEndDraft(end ?? ''); }
  }, [start, end, open]);

  // 定位：chip 正下方；open 期間隨 scroll / resize 重算（fixed viewport 座標）。存檔改在
  // 關閉時（見下），open 期間不觸發重排，故 popup 不會邊編邊跳位、deps 只需 [open]。
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = chipRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // 開啟時把焦點移入 popup（容器 tabIndex=-1）：否則鍵盤使用者停在 chip、要 tab 過整頁才到
  // picker（popup portal 到 body、位於 DOM 末端）。pos 已於上方 layout effect 同步設好 → 此 passive
  // effect 執行時 portal 已掛載，popRef.current 可用。
  useEffect(() => {
    if (open) popRef.current?.focus();
  }, [open]);

  // 存檔：關閉 popup 時把 draft 與原值 diff，只送有變的欄位、一次 PATCH（起訖同批 → 後端
  // effective-merge 驗證先後、只觸發一次重排/重算；避免每 pick 一發 + LWW 亂序 race）。
  const flushSave = useCallback(async () => {
    if (!tripId || entryId == null) return;
    const nextStart = startDraft === '' ? null : startDraft;
    const nextEnd = endDraft === '' ? null : endDraft;
    const body: Record<string, string | null> = {};
    if (nextStart !== (start || null)) body.start_time = nextStart;
    if (nextEnd !== (end || null)) body.end_time = nextEnd;
    if (Object.keys(body).length === 0) return; // 無變動 → 不打
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // 400 = 起訖倒置（後端 effective merge 驗證）；其餘一律失敗。draft 隨關閉後 re-seed 回原值。
        showToast(res.status === 400 ? '抵達時間需早於離開時間' : '時間儲存失敗', 'error', 5000);
        return;
      }
      // 後端已依抵達時間重排當日 → 重算車程 + refetch（順序可能變）。
      requestTravelRecompute(tripId, dayNum).catch(() =>
        showToast('時間已儲存，車程更新失敗，重新整理後再試', 'info', 5000));
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId, dayNum, travelRecomputeRequested: true },
      }));
    } catch {
      showToast('時間儲存失敗', 'error', 5000);
    }
  }, [tripId, entryId, dayNum, startDraft, endDraft, start, end]);

  const closeAndSave = useCallback(() => {
    setOpen(false);
    void flushSave();
  }, [flushSave]);

  // outside-click 關閉並存檔：排除本 popup、chip、以及內層 TripTimePicker 的 .tp-time-popover portal。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('.tp-rail-time-pop, .tp-time-popover') || (t && chipRef.current?.contains(t))) return;
      closeAndSave();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, closeAndSave]);

  const hasTime = !!(start || end);
  const disabled = entryId == null || tripId == null;

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={clsx('tp-rail-time-chip', !hasTime && 'is-empty')}
        onClick={(e) => { e.stopPropagation(); if (disabled) return; if (open) closeAndSave(); else setOpen(true); }}
        disabled={disabled}
        aria-expanded={open}
        aria-label="編輯起訖時間"
        data-testid={entryId != null ? `timeline-rail-time-chip-${entryId}` : undefined}
      >
        <span>{hasTime ? formatTimeRange(start ?? '', end ?? '') : '設定時間'}</span>
        <Icon name="pencil" />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="tp-rail-time-pop"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Escape 關閉並存檔、焦點歸還 chip（鍵盤流程收尾；chip 常駐掛載，resort 後 React 復用同節點）。
            if (e.key === 'Escape') { e.stopPropagation(); closeAndSave(); chipRef.current?.focus(); }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="起訖時間"
          tabIndex={-1}
        >
          <div className="tp-rail-time-pop-row">
            <span className="tp-rail-time-pop-label">抵達</span>
            <TripTimePicker value={startDraft} onChange={setStartDraft} clearable ariaLabel="抵達時間" />
          </div>
          <div className="tp-rail-time-pop-row">
            <span className="tp-rail-time-pop-label">離開</span>
            <TripTimePicker value={endDraft} onChange={setEndDraft} clearable ariaLabel="離開時間" />
          </div>
          <button type="button" className="tp-rail-time-pop-done" onClick={closeAndSave}>完成</button>
        </div>,
        document.body,
      )}
    </>
  );
}

const RailRow = memo(function RailRow({ entry, index, expanded, onToggle, isPast, isNow, isLast, dayId, sortMode, onEnterSortMode, stopNumber, onMoveStep }: RailRowProps) {
  const tripId = useTripId();
  const allDays = useTripDays();
  const parsed = parseEntryTime(entry);
  const meta = deriveTypeMeta(entry);
  const entryDisplayTitle = getTimelineEntryDisplayTitle(entry);

  // QA 2026-04-26 PR-K：dnd-kit sortable wiring。entry.id null 時 disabled
  // (避免拖到還沒儲存的 row)。drag handle 用 grip icon button (only-source)
  // 避免跟 row click 衝突 toggle expand。
  const sortableId = entry.id ?? `idx-${index}`;
  // 2026-07-07 跨天拖拉：data 帶 dayId — TripPage 層 DndContext 據此分流
  // 同日（rail monitor reorder）vs 跨天（TripPage move）。
  // rev2 Section 02：拖曳只在排序模式（⋯「重新排序」）啟用 — resting 列不可拖（grip 亦 display:none）。
  const sortable = useSortable({ id: sortableId, disabled: entry.id == null || !sortMode, data: { dayId } });
  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : undefined,
    zIndex: sortable.isDragging ? 20 : undefined,
  };
  const canExpand = entry.id != null;
  const entryIdNum = entry.id ?? null;

  // v2.29.x per-POI note cutover：inline 快速編輯的 save target 從 entry-level
  // `trip_entries.note`（已 DROP）改為 master stopPoi（sortOrder=1）的 per-POI note。
  // master poiId 從 entry.stopPois 取 sortOrder===1 那筆的 poiId；缺 master 或
  // master 無 poiId（如尚未存檔的搜尋結果）→ 無法定位 PATCH target → 停用編輯。
  const masterPoiId = useMemo(() => {
    const items = entry.stopPois ?? [];
    const masterRow = items.find((p) => p.sortOrder === 1);
    return masterRow?.poiId ?? null;
  }, [entry.stopPois]);
  const canEditNote = masterPoiId != null;

  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  // v2.33.108: note save 走 useAutosave hook（state/error 由 hook 管）。
  // deleteError 保留 separate state — 跟 note edit error 互不干擾。
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();
  // Section 4.5 (terracotta-ui-parity-polish): 取代 window.confirm 為 ConfirmModal pattern
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // v2.33.108: note 改 auto-save — onBlur 立即 flush，Cmd+Enter 仍 flush。
  // 移除「儲存 / 取消」button，改「完成」按鈕（純關閉 edit mode，狀態已 auto-saved）。
  // ESC 改 revert + 關 — 若未 save 直接 cancel；若已 save 則 revert 需透過原值重 PATCH（保守做法：ESC 一律 flush + close）。
  const noteAutosave = useAutosave<{ note: string }>({
    debounceMs: 800,
    save: async (body) => {
      if (!tripId || entryIdNum == null || masterPoiId == null) {
        throw new Error('Missing tripId / entryId / masterPoiId');
      }
      // v2.29.x：repoint 到 per-POI note 端點（master poiId）。LWW，不帶 version token。
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}/pois/${masterPoiId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await ApiError.fromResponse(res);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: entryIdNum },
      }));
      return await res.json() as Record<string, unknown>;
    },
  });

  // v2.33.143: autosave error 走 toast（拔 SaveStatus inline UI 後唯一錯誤 surface）。
  // 監聽 state==='error' transition 觸發 1 次 toast，避免每 re-render 都 toast。
  const lastNoteErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (noteAutosave.state === 'error' && noteAutosave.error && noteAutosave.error !== lastNoteErrorRef.current) {
      lastNoteErrorRef.current = noteAutosave.error;
      showToast(`備註儲存失敗：${noteAutosave.error}`, 'error', 6000);
    } else if (noteAutosave.state !== 'error') {
      lastNoteErrorRef.current = null;
    }
  }, [noteAutosave.state, noteAutosave.error]);

  const beginEditNote = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    // v2.29.x：無 master poiId → 無 PATCH target，停用 inline 編輯（no-op）。
    if (!canEditNote) return;
    setDraftNote(entry.note ?? '');
    setEditingNote(true);
  };

  const closeEditNote = useCallback(async () => {
    await noteAutosave.flush();
    setEditingNote(false);
    setDraftNote('');
  }, [noteAutosave]);

  const handleNoteChange = (value: string) => {
    setDraftNote(value);
    noteAutosave.patch({ note: value });
  };

  const handleNoteBlur = () => {
    void noteAutosave.flush();
  };

  const handleNoteKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // ESC 直接關閉（已 auto-save flushed 或仍 in pending — flush 後關）
      void closeEditNote();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void closeEditNote();
    }
  };

  // QA 2026-04-26 BUG-012：mockup .iconbtn.sm.danger trash delete handler。
  // Section 4.5 (terracotta-ui-parity-polish): mockup 規定不用 window.confirm。
  // 改 ConfirmModal pattern — trash button 開 modal，modal 內 confirm 才 fire DELETE。
  // 成功後 dispatch event 觸發 refetch。
  const handleDeleteConfirm = useCallback(async () => {
    if (!tripId || entryIdNum == null) return;
    setDeleting(true);
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('刪除失敗');
      // 2026-07-06 車程重算缺口：刪除後 FK cascade 移除舊 pair，新相鄰 pair
      // 缺 row 沒人算 → 補顯式 day-scoped recompute（fire-and-forget，失敗
      // 靜默 — self-healing 與 TravelPill ⚠ 是 fallback）。
      void requestTravelRecompute(tripId, dayNumFromId(allDays, dayId))
        .catch(() => undefined);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: entryIdNum },
      }));
      setShowDeleteConfirm(false);
    } catch (err) {
      // 顯示錯誤但保留 modal 開啟讓 user 重試
      setDeleteError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }, [tripId, entryIdNum, dayId, allDays]);

  // v2.10 Wave 1 → 2026-05-03 modal-to-fullpage: copy / move 改 navigate
  // 到 /trip/:id/stop/:eid/(copy|move) page，page 自己處理 fetch days +
  // 確認 + dispatch tp-entry-updated event。TimelineRail 只需 navigate。
  const goCopyOrMove = useCallback((action: 'copy' | 'move') => {
    if (!tripId || entryIdNum == null) return;
    navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryIdNum}/${action}`);
  }, [tripId, entryIdNum, navigate]);

  const hasNote = !!entry.note?.trim();

  const stopPois: StopPoiOptionData[] = useMemo(() => {
    const items = entry.stopPois ?? [];
    return [...items]
      .filter((p) => !!p.name?.trim())
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [entry.stopPois]);

  // v2.30.14：master POI (sortOrder=1) 欄位升格到「景點說明」section、不再渲染獨立
  // 「正選」卡片；備選 (sortOrder>=2) 留在「備選景點」section（只在 alternates 存
  // 在時渲染）。Section 順序：景點說明 → 備註 → 備選景點。
  const master = stopPois[0] ?? null;
  const alternates = stopPois.slice(1);
  const hasAlternates = alternates.length > 0;

  const masterMeta = useMemo(() => {
    const parts: { text: string; kind: 'star' | 'strong' | 'plain' }[] = [];
    if (master && typeof master.rating === 'number') {
      parts.push({ text: `★ ${master.rating.toFixed(1)}`, kind: 'star' });
    }
    if (master?.price) parts.push({ text: master.price, kind: 'strong' });
    const condensedHours = condenseHours(master?.hours);
    if (condensedHours) parts.push({ text: condensedHours, kind: 'plain' });
    if (master?.reservation) parts.push({ text: master.reservation, kind: 'plain' });
    return parts;
  }, [master]);

  // v2.55.x：正選 POI 細類 label（拉麵/神社）— v2.30.14 把 master 升格到景點說明時漏掉，
  // 導致每日行程頁只剩 collapsed row 的粗類 badge、看不到 v2.55.73 的細類。
  // 只取細類（poiCategoryLabel(category)），不 fallback 粗類 type：正選已有相鄰粗類
  // badge（deriveTypeMeta），fallback 會讓景點說明冒出跟 badge 重複的粗類回聲。
  const masterTypeLabel = poiCategoryLabel(master?.category);

  // MapLinks 來源優先 master.location → fallback entry.locations[0]（舊資料相容）
  const mapLocation = master?.location ?? entry.locations?.[0] ?? null;
  const entryDesc = entry.description?.trim() ?? '';
  const masterDesc = master?.description?.trim() ?? '';
  const hasDescriptionSection =
    !!entryDesc || !!masterDesc || masterMeta.length > 0 || !!mapLocation || !!masterTypeLabel;

  // 當日 day number（餵給 EntryTimeChip / 備選卡做 travel 重算的 dayNum）— hoist 一次，
  // 不在 render / alternates.map 內重複 O(days) 掃描。
  const dayNum = dayNumFromId(allDays, dayId);

  // row 展開 toggle：head 是 div（onClick，滑鼠整列可點）與獨立 caret <button>（鍵盤/SR
  // toggle）共用此 handler；chip 等子互動元素自行 stopPropagation。
  const handleHeadActivate = () => {
    if (!canExpand) return;
    // v2.31.81 #5：row click → dispatch entryFocused 讓 TripMapRail pan 到該 pin。
    // v2.31.87 #5+#6：isExpanding = !expanded（點後 next state）→ flyTo zoom 15 / 11。
    if (entry.id != null) {
      window.dispatchEvent(new CustomEvent(EVENT.entryFocused, {
        detail: { entryId: entry.id, isExpanding: !expanded },
      }));
    }
    onToggle();
  };

  // ⋯ menu「編輯備註」：展開 row（若收合）+ 進 inline 編輯（sibling textarea 在 detail 內）。
  const openNoteEditor = () => {
    if (!canEditNote) return;
    if (!expanded) onToggle();
    setDraftNote(entry.note ?? '');
    setEditingNote(true);
  };

  // rev2 Section 02：停留卡動作收進 ⋯ menu，依 Apple 慣例分組（destructive 獨立末組）。
  // 沿用舊 toolbar testid（timeline-rail-edit/-delete/-copy-open/-move-open）→ 只換容器不換語意。
  const menuGroups: RailMenuItem[][] = [
    // 第 1 組：在地圖開啟（in-app trip map 聚焦本站）
    mapLocation && tripId && entryIdNum != null
      ? [{ kind: 'item', label: '在地圖開啟', icon: 'location-pin', testid: `timeline-rail-menu-map-${entry.id}`,
          onSelect: () => navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryIdNum}/map`) }]
      : [],
    // 第 2 組：編輯（備註 inline / 換景點 L3 / 編輯景點全頁）
    [
      ...(canEditNote
        ? [{ kind: 'item' as const, label: '編輯備註', icon: 'pencil' as const, testid: `timeline-rail-menu-note-${entry.id}`, onSelect: openNoteEditor }]
        : []),
      ...(tripId && entryIdNum != null
        ? [{ kind: 'item' as const, label: '換景點', icon: 'swap-horizontal' as const, testid: `timeline-rail-menu-change-${entry.id}`,
            onSelect: () => navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryIdNum}/change-poi`) }]
        : []),
      ...(tripId && entryIdNum != null
        ? [{ kind: 'item' as const, label: '編輯景點', icon: 'edit' as const, testid: `timeline-rail-edit-${entry.id}`,
            onSelect: () => navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryIdNum}/edit`) }]
        : []),
    ],
    // 第 3 組：安排（重新排序 / 複製 / 移到）
    [
      { kind: 'item', label: '重新排序', icon: 'grip', testid: `timeline-rail-menu-sort-${entry.id}`, onSelect: onEnterSortMode },
      // W13：⋯ menu 上移/下移一格 —— 不靠拖曳的鍵盤/VoiceOver 替代排序路徑（首列無上移、末列無下移）。
      ...(entryIdNum != null && index > 0
        ? [{ kind: 'item' as const, label: '上移一格', icon: 'chevron-up' as const, testid: `timeline-rail-move-up-${entry.id}`, onSelect: () => onMoveStep?.(entryIdNum, 'up') }]
        : []),
      ...(entryIdNum != null && !isLast
        ? [{ kind: 'item' as const, label: '下移一格', icon: 'chevron-down' as const, testid: `timeline-rail-move-down-${entry.id}`, onSelect: () => onMoveStep?.(entryIdNum, 'down') }]
        : []),
      ...(dayId != null && allDays.length > 1 && entryIdNum != null
        ? [
            { kind: 'item' as const, label: '複製到其他天', icon: 'copy' as const, testid: `timeline-rail-copy-open-${entry.id}`, onSelect: () => goCopyOrMove('copy') },
            { kind: 'item' as const, label: '移到其他天', icon: 'folder' as const, testid: `timeline-rail-move-open-${entry.id}`, onSelect: () => goCopyOrMove('move') },
          ]
        : []),
    ],
    // 末組：刪除（destructive 紅，Apple 慣例獨立末組）
    entryIdNum != null
      ? [{ kind: 'item', label: '刪除景點', icon: 'trash', danger: true, testid: `timeline-rail-delete-${entry.id}`,
          onSelect: () => setShowDeleteConfirm(true) }]
      : [],
  ];
  const menuItems: RailMenuItem[] = menuGroups
    .filter((g) => g.length > 0)
    .flatMap((g, i) => (i === 0 ? g : [{ kind: 'sep' } as RailMenuItem, ...g]));

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={sortableStyle}
        className="tp-rail-item"
        data-now={isNow || undefined}
        data-past={isPast || undefined}
        data-tone={meta.tone}
        data-last={isLast || undefined}
        data-expanded={expanded || undefined}
        data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
      >
        {/* mockup .tp-detail-row:1923 — 6-col grid: grip(24) | time(50) | dot(24) | icon(44) | body(1fr) | caret(20)。
         * 2026-05-10 (#510)：重新加回 .tp-rail-dot — 編號圓圈是 wayfinding，
         * mockup terracotta-preview-v2.html 6241 一直都有，移除它的舊註解（基於更早 S12 Variant A）已過期。 */}
        {/* rev2 owner 2026-07-19：排序 grip 從「列首左欄」移到右邊 head-actions（取代 caret ›）。
         * 左欄 grip 會讓排序模式整條 timeline dots 右移一欄（1-2-3 格式跑掉）；改放右邊 →
         * 左邊 node 編號兩模式一致（見 head .tp-rail-head-actions 內的 .tp-rail-grip）。 */}
        <span className="tp-rail-dot" data-hotel={stopNumber == null || undefined} aria-hidden="true">
          {stopNumber != null ? stopNumber : <Icon name="hotel" />}
        </span>
        {/* head 是 div（非 button / 非 role="button"）— sub-line 內含可互動的時間 chip，
            role="button" 的子孫是 presentational（WAI-ARIA），會讓 AT 吞掉 chip。故 row-click
            展開走 div onClick（滑鼠便利，保留 mockup 整列可點），無障礙 toggle 走下方獨立的
            caret <button>（鍵盤 focus + SR），chip 亦是可 focus 的 sibling button 正常曝露。 */}
        <div
          className="tp-rail-head"
          onClick={handleHeadActivate}
          data-testid={entry.id != null ? `timeline-rail-row-${entry.id}` : undefined}
        >
          <span className="tp-rail-content">
            <span className="tp-rail-name">{entryDisplayTitle}</span>
            {(() => {
              const durLabel = formatDurationCompact(parsed.duration);
              // mockup hotel row sub-line 是「HOTEL · 退房 + 早餐」— 不顯示 rating
              // 即使 POI 有 rating（design choice：飯店重點是 check-out / 早餐
              // 等資訊，rating 對 hotel timeline entry 不那麼相關）。
              const isHotel = meta.label === '住宿';
              const rating = typeof entry.googleRating === 'number' && !isHotel ? entry.googleRating : null;
              const desc = entry.description?.trim() ?? '';
              const shortDesc = desc && desc.length <= 24 && !desc.includes('\n') ? desc : '';
              return (
                <span className="tp-rail-sub">
                  {/* D-review #3：每個「分隔符 + 值」綁成 .tp-rail-sub-part nowrap 單位,
                      副標超長換行時只在 part 之間斷（乾淨）、分隔符永不孤懸在行尾、
                      ★+評分整組不拆(plan L50 adapt 非 truncate)。 */}
                  {entryIdNum != null && (
                    <EntryTimeChip
                      tripId={tripId ?? null}
                      entryId={entryIdNum}
                      dayNum={dayNum}
                      start={parsed.start}
                      end={parsed.end}
                    />
                  )}
                  <span className="tp-rail-sub-part">
                    {entryIdNum != null && <span className="tp-rail-sub-sep">·</span>}
                    <span className="tp-rail-sub-type">{meta.label}</span>
                  </span>
                  {durLabel && (
                    <span className="tp-rail-sub-part">
                      <span className="tp-rail-sub-sep">·</span>
                      <span>{durLabel}</span>
                    </span>
                  )}
                  {rating != null && (
                    <span className="tp-rail-sub-part">
                      <span className="tp-rail-sub-sep">·</span>
                      <span className="tp-rail-sub-rating">
                        <span className="tp-rail-sub-star">★</span>
                        {rating.toFixed(1)}
                      </span>
                    </span>
                  )}
                  {shortDesc && (
                    <span className="tp-rail-sub-part">
                      <span className="tp-rail-sub-sep">·</span>
                      <span>{shortDesc}</span>
                    </span>
                  )}
                </span>
              );
            })()}
          </span>
          <div className="tp-rail-head-actions">
            {menuItems.length > 0 && entry.id != null && (
              <RailRowMenu
                menuId={`rail-menu-${entry.id}`}
                label={entryDisplayTitle}
                items={menuItems}
                testid={`timeline-rail-menu-${entry.id}`}
              />
            )}
            <button
              type="button"
              className="tp-rail-caret"
              onClick={(e) => { e.stopPropagation(); handleHeadActivate(); }}
              disabled={!canExpand}
              aria-expanded={canExpand ? expanded : undefined}
              aria-label={`${expanded ? '收合' : '展開'}景點：${entryDisplayTitle}`}
              data-testid={entry.id != null ? `timeline-rail-toggle-${entry.id}` : undefined}
            >
              <span aria-hidden="true">›</span>
            </button>
            {/* 排序模式：caret › 隱藏（CSS），此 grip 顯示在同位置（owner ⑧）。onClick 擋冒泡避免
             * 拖曳握把被當成整列點擊 → 誤觸展開。 */}
            <button
              type="button"
              className="tp-rail-grip"
              {...sortable.listeners}
              {...sortable.attributes}
              onClick={(e) => e.stopPropagation()}
              aria-label={`拖拉排序：${entryDisplayTitle}`}
              data-testid={entry.id != null ? `timeline-rail-grip-${entry.id}` : undefined}
            >
              <Icon name="grip" />
            </button>
          </div>
        </div>
      </div>

      {expanded && entry.id != null && (
        <div className="tp-rail-detail" data-tone={meta.tone} data-testid={`timeline-rail-detail-${entry.id}`}>
          {hasDescriptionSection && (
            <div
              className="tp-rail-detail-section"
              data-testid={`timeline-rail-description-${entry.id}`}
            >
              <h4>景點說明</h4>
              {masterTypeLabel && (
                <span className="tp-rail-poi-type">{masterTypeLabel}</span>
              )}
              {masterMeta.length > 0 && (
                <div className="tp-rail-poi-meta">
                  {masterMeta.map((m, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="tp-rail-poi-meta-sep">·</span>}
                      <span
                        className={clsx({
                          'tp-rail-poi-meta-star': m.kind === 'star',
                          'tp-rail-poi-meta-strong': m.kind === 'strong',
                        })}
                      >
                        {m.text}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
              {mapLocation && (
                <div
                  className="tp-rail-detail-maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapLinks location={mapLocation} inline />
                </div>
              )}
              {entryDesc && (
                <MarkdownText text={entryDesc} as="p" className="tp-rail-detail-desc" />
              )}
              {masterDesc && masterDesc !== entryDesc && (
                <MarkdownText
                  text={masterDesc}
                  as="p"
                  className="tp-rail-detail-desc tp-rail-detail-desc-master"
                />
              )}
            </div>
          )}

          <div className="tp-rail-detail-section">
            <h4>備註</h4>
            {editingNote ? (
              <>
                <textarea
                  className="tp-rail-note-input"
                  value={draftNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  onBlur={handleNoteBlur}
                  onKeyDown={handleNoteKey}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  data-testid={`timeline-rail-note-input-${entry.id}`}
                />
                <div className="tp-rail-note-actions">
                  {/* v2.33.143: SaveStatus indicator 拔除 — silent auto-save，失敗
                      走 toast (見 noteAutosave 旁 useEffect)。 */}
                  <button
                    type="button"
                    className="tp-rail-note-cancel"
                    onClick={(e) => { e.stopPropagation(); void closeEditNote(); }}
                    data-testid={`timeline-rail-note-close-${entry.id}`}
                  >
                    完成
                  </button>
                  <span className="tp-rail-note-kbd">
                    <kbd>⌘</kbd> + <kbd>↩</kbd> 完成 · <kbd>esc</kbd> 關閉
                  </span>
                </div>
              </>
            ) : canEditNote ? (
              <div
                className={clsx('tp-rail-note-value', !hasNote && 'is-empty')}
                onClick={beginEditNote}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  // role="button" 須同時支援 Enter 與 Space（WAI-ARIA），Space preventDefault
                  // 防頁面捲動（adversarial H1，與 EditEntryPage PerPoiNoteRow 同源修正）。
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    beginEditNote(e);
                  }
                }}
                data-testid={`timeline-rail-note-value-${entry.id}`}
              >
                {hasNote ? entry.note : '+ 加備註'}
              </div>
            ) : hasNote ? (
              // v2.29.x：無 master poiId → 顯示 master note（read-only），不提供編輯 affordance。
              // note 來源已是 master（mapDay 設定）。空 note + 無 master 時整段不渲染。
              <div
                className="tp-rail-note-value"
                data-testid={`timeline-rail-note-value-${entry.id}`}
              >
                {entry.note}
              </div>
            ) : (
              <p className="tp-rail-detail-desc tp-rail-detail-desc-master" style={{ margin: 0 }}>
                尚無備註
              </p>
            )}
          </div>

          {hasAlternates && (
            <div className="tp-rail-detail-section">
              <h4>備選景點</h4>
              <div
                className="tp-rail-poi-list"
                data-testid={`timeline-rail-alternates-${entry.id}`}
              >
                {alternates.map((poi, i) => (
                  <StopPoiChoiceCard
                    key={`${poi.poiId ?? poi.name}-${i}`}
                    poi={poi}
                    tripId={tripId ?? null}
                    entryId={entryIdNum}
                    dayNum={dayNum}
                  />
                ))}
              </div>
            </div>
          )}

          {/* rev2 Section 02（2026-07-17 mockup）：展開明細底部的「一排 icon 鈕」
           * （複製 / 移到 / 編輯 / 刪除 + 在地圖開啟）已收進 row 上的 ⋯ context menu
           * （見 head .tp-rail-head-actions 的 RailRowMenu）。Apple 列表語彙：動作進單顆 ⋯，
           * 不在列上排 icon 工具列。明細只留資訊面（景點說明 / 備註 inline / 備選景點）。 */}
        </div>
      )}


      {/* 2026-07-07 stacking-context bug fix：原 inline modal（fixed inset:0
       * z:1000）在 desktop 2-col 下被祖先 transform/contain 困在左欄 stacking
       * context — backdrop 蓋不到右側 sticky 地圖、dialog 被地圖 panel 切掉。
       * 改用 shared ConfirmModal（createPortal 到 body + --z-modal 9000），
       * 與全站其他刪除 confirm（trip-notes / favorites / trips-list）同 pattern。 */}
      <ConfirmModal
        open={showDeleteConfirm}
        title="確認刪除？"
        message={`「${entryDisplayTitle}」將從行程中移除。此操作無法復原。`}
        warning={deleteError ?? undefined}
        confirmLabel="確認刪除"
        busy={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        // deleting 中不可關（Escape/backdrop 也擋）— DELETE 失敗的 error 要留在
        // modal 裡顯示（對齊原 inline 版 !deleting guard；codex review P1）
        onCancel={() => { if (!deleting) setShowDeleteConfirm(false); }}
      />
    </>
  );
});

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1, dayId, dndManaged = false }: TimelineRailProps) {
  // v2.55.x: 從 EditEntryPage 回前頁（或從地圖跳景點）帶 ?focus=<entryId> 時，該景點所在
  // 的 rail 掛載即展開它 —— 回到「當下景點展開」。只認得屬於本 rail 的 entry，避免每一天的
  // rail 都去吃同一個 focus（expandedId 對不到的 rail 設 null 無害）。
  const [expandedId, setExpandedId] = useState<number | null>(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    const focusId = focus ? Number(focus) : NaN;
    return Number.isFinite(focusId) && events.some((e) => e.id === focusId) ? focusId : null;
  });
  // rev2 Section 02：排序模式（⋯ menu「重新排序」進入）— per-rail（每天一個 rail 實例）。
  // 進入後所有 row 顯 grip 可拖；drag 觸發 refetch（events 變）時不重置，否則每拖一次就退出。
  const [sortMode, setSortMode] = useState(false);
  const enterSortMode = useCallback(() => setSortMode(true), []);
  // PR-K：local order override — drag-end 後立即套用 optimistic order，等
  // backend PATCH 完成 + tp-entry-updated 觸發 refetch 再用 fresh data 覆蓋。
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
  const tripId = useTripId();
  const allDays = useTripDays();
  // v2.24.0 γ.1：fetch segments → 為每對 entry 提供 segment row 給 TravelPill 啟用
  // tap-switch dialog。Hook listen tp-segment-updated + tp-entry-updated 自動 re-fetch。
  const { segmentMap, ready: segmentsReady } = useTripSegments(tripId);

  // PR-K dnd-kit sensors。includeTouch 拆 mouse/touch：桌機 MouseSensor 8px 即時
  // 拖曳（避免誤觸 click expand row），觸控走 TouchSensor 200ms 長按（快速垂直
  // 滑動仍可捲動），keyboard 走 sortable coordinate getter。
  const { sensors } = useDragDrop({ includeTouch: true, pointerActivationDistance: 8, sortable: true });

  // 套 order override (drag 後 optimistic) 重排 events
  const orderedEvents = useMemo(() => {
    if (!orderOverride) return events;
    const byId = new Map<number, TimelineEntryData>();
    events.forEach((e) => { if (e.id != null) byId.set(e.id, e); });
    const result: TimelineEntryData[] = [];
    orderOverride.forEach((id) => { const e = byId.get(id); if (e) result.push(e); });
    // 保險：events 有但 override 漏的 id 接在尾巴
    events.forEach((e) => { if (e.id != null && !orderOverride.includes(e.id)) result.push(e); });
    return result;
  }, [events, orderOverride]);

  // events prop 變動 → reset override（refetch 帶回 backend authoritative order）
  // v2.33.44 round 6a: useMemo() 內呼 setState 是 side-effect masquerading as memo
  // (React 19 concurrent / strict mode 會 fire twice + warning)。改 useEffect 正確路徑。
  const eventsKey = events.map((e) => e.id ?? -1).join(',');
  useEffect(() => { setOrderOverride(null); }, [eventsKey]);

  // 2026-07-06 self-healing 車程補算：刪除/搬日/複製/後端直寫（AI chat、import、
  // share clone、tp-* CLI）後，新相鄰 pair 缺 segment row（FK cascade 只刪舊
  // pair，新 pair 無人算）或換 POI 後 computed_at=NULL。render 時偵測缺口 →
  // 自動 day-scoped recompute，以缺口清單當 signature 防重（同缺口只試一次，
  // unhealable 缺座標 pair 不會被無關 mutation 反覆 re-arm）。其餘防護在
  // helper：in-flight dedup、唯讀 403 → 該 trip auto 停用、失敗靜默（fallback
  // 是 TravelPill ⚠ 手動鈕）。segmentsReady gate 防首次 render 空 map 誤判；
  // orderOverride gate 防 drag optimistic order 在 PATCH commit 前誤判新
  // adjacency 白燒一輪（perf review CRITICAL）。
  useEffect(() => {
    if (!tripId || !segmentsReady || orderOverride != null) return;
    // auto 只在 day scope 明確時打 — 解析不到 dayNum 不能放大成全 trip
    // recompute（47-pair trip ≈ 52 subrequests 貼 CF 50 上限，自動路徑
    // fail-open 方向錯誤；explicit 手動 ⚠ 才保留全 trip fallback）。
    const dayNum = dayNumFromId(allDays, dayId);
    if (dayNum == null) return;
    const gaps: string[] = [];
    for (let i = 1; i < orderedEvents.length; i++) {
      const prev = orderedEvents[i - 1];
      const curr = orderedEvents[i];
      if (prev?.id == null || curr?.id == null) continue;
      // 缺座標 pair 不進 gaps：backend recompute 對它無能為力（skip 不寫
      // row），觸發只會白燒該日全部 pair 的 Google 重算。user 補座標後
      // entry 資料變 → masterLat 有值 → 進 gaps → 自動補算，閉環成立。
      if (prev.masterLat == null || prev.masterLng == null
        || curr.masterLat == null || curr.masterLng == null) continue;
      const seg = segmentMap.get(`${prev.id}-${curr.id}`);
      if (!seg || seg.computedAt == null) gaps.push(`${prev.id}-${curr.id}`);
    }
    if (gaps.length === 0) return;
    void requestTravelRecompute(tripId, dayNum, {
      auto: true,
      signature: gaps.join(','),
    });
  }, [tripId, segmentsReady, orderOverride, segmentMap, orderedEvents, dayId, allDays]);

  // 2026-07-08 車程重算狀態：auto 終端失敗（403 唯讀 viewer / 持續 API 錯）時
  // helper dispatch segmentRecomputeFailed — 監聽後 re-render，讓 TravelPill 由樂觀
  // 「重新計算中」改顯誠實「待更新」（stale pair 不會自己好，別假稱系統在算）。
  const [, bumpRecomputeStatus] = useState(0);
  useEffect(() => {
    if (!tripId) return;
    const onFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | null;
      if (detail?.tripId && detail.tripId !== tripId) return;
      bumpRecomputeStatus((n) => n + 1);
    };
    window.addEventListener(EVENT.segmentRecomputeFailed, onFailed);
    return () => window.removeEventListener(EVENT.segmentRecomputeFailed, onFailed);
  }, [tripId]);
  // day-scope 級（全 rail 共用）：blocked=唯讀 viewer / failed=本日持續失敗 → 停滯。
  // 每 render 重讀（bumpRecomputeStatus / segments refetch 觸發的 re-render 會刷新）。
  const recomputeStalled = tripId != null
    && getAutoRecomputeStatus(tripId, dayNumFromId(allDays, dayId)) !== 'active';

  // W13：reorder 落地（optimistic override → batch PATCH → travel recompute → 廣播 → 失敗 revert）
  // 抽成共用，供拖曳（handleDragEnd）與 ⋯ menu「上移/下移一格」（moveEntryStep）共用，行為一致。
  const applyReorder = useCallback(async (newIds: number[], sourceEntryId: number | string) => {
    setOrderOverride(newIds);
    if (!tripId) return;
    // Section 6/3：reorder 走 batch endpoint，避免 N+1 PATCH。一次送所有改變位置的 sort_order，
    // atomic 失敗 → revert override。
    try {
      const updates = newIds.map((id, idx) => ({ id, sort_order: idx }));
      const res = await apiFetchRaw(`/trips/${tripId}/entries/batch`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error(`batch reorder failed: ${res.status}`);
      // OSM PR (migration 0045)：reorder 後 entry travel 依順序重算（fire-and-forget，失敗 toast 提示）。
      // day-scope 化省其他天 Google 重算；dayNum 解析不到才退全 trip。
      requestTravelRecompute(tripId, dayNumFromId(allDays, dayId))
        .catch(() => {
          showToast('順序已儲存，但車程時間更新失敗，重新整理後再試', 'info');
        });
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: sourceEntryId, reordered: true, travelRecomputeRequested: true },
      }));
    } catch {
      setOrderOverride(null);
    }
  }, [tripId, allDays, dayId]);

  // W13：⋯ menu「上移/下移一格」—— 單步 arrayMove 後走 applyReorder（VoiceOver/觸控不靠拖曳的替代）。
  const moveEntryStep = useCallback((entryId: number, dir: 'up' | 'down') => {
    const oldIdx = orderedEvents.findIndex((ev) => ev.id === entryId);
    if (oldIdx < 0) return;
    const newIdx = dir === 'up' ? oldIdx - 1 : oldIdx + 1;
    if (newIdx < 0 || newIdx >= orderedEvents.length) return;
    const reordered = arrayMove(orderedEvents, oldIdx, newIdx);
    const newIds = reordered.map((ev) => ev.id).filter((id): id is number => id != null);
    void applyReorder(newIds, entryId);
  }, [orderedEvents, applyReorder]);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    // 拖完還原到「開始拖前」的 scrollTop（抵消拖曳中 dnd-kit autoScroll + drop 後
    // focus 亂捲），頁面不移動。idempotent：capturedTop 用完即清。
    restoreDragScroll();
    if (!over || active.id === over.id) return;
    // dndManaged：monitor 收到整個 TripPage context 的事件 — 只處理「active
    // 與 over 都屬本 rail」的同日 reorder；跨天 drop 由 TripPage onDragEnd 接。
    if (dndManaged) {
      const activeDay = (active.data.current as { dayId?: number | null } | undefined)?.dayId;
      const overDay = (over.data?.current as { dayId?: number | null } | undefined)?.dayId;
      if (dayId == null || activeDay !== dayId || overDay !== dayId) return;
    }
    const oldIdx = orderedEvents.findIndex((ev, i) => (ev.id ?? `idx-${i}`) === active.id);
    const newIdx = orderedEvents.findIndex((ev, i) => (ev.id ?? `idx-${i}`) === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(orderedEvents, oldIdx, newIdx);
    const newIds = reordered.map((ev) => ev.id).filter((id): id is number => id != null);
    // W13：落地邏輯抽到 applyReorder（拖曳與 ⋯ menu 上移/下移共用，行為一致）。
    await applyReorder(newIds, active.id);
  }, [orderedEvents, dayId, dndManaged, applyReorder]);

  // 2026-07-07 跨天拖拉：rail body 掛 droppable — 拖到空日（無 item 可 over）
  // 或 rail 空白處也能 drop（data 帶 dayId 給 TripPage 判目標日，插末尾）。
  // isOver 淡高亮當 drop-target 回饋。非 managed / 無 dayId 時 disabled。
  // Hook 必須在 early-return 之前（rules-of-hooks）。
  const { setNodeRef: setRailBodyRef, isOver: isRailDropOver } = useDroppable({
    id: `tp-rail-day-${dayId ?? 'na'}`,
    data: { dayId, railContainer: true },
    disabled: !dndManaged || dayId == null,
  });

  // 2026-07-07 跨天拖拉：dndManaged 空日放行 — render header + 空 drop 槽
  // （droppable body），讓「拖到還沒排的天」成立。獨立頁維持 null。
  if ((!events || events.length === 0) && !dndManaged) return null;

  const firstTime = orderedEvents[0] ? parseEntryTime(orderedEvents[0]).start : '';
  const lastTime = orderedEvents[orderedEvents.length - 1]
    ? (parseEntryTime(orderedEvents[orderedEvents.length - 1]!).end || parseEntryTime(orderedEvents[orderedEvents.length - 1]!).start)
    : '';

  // PR-K：sortable items list — entry.id 或 fallback `idx-N`（disabled in RailRow）
  const sortableItems = orderedEvents.map((e, i) => e.id ?? `idx-${i}`);

  // rev2 mockup：停留站序號**跳過飯店**（飯店是當日路線起訖錨點、非「第幾站」，給床 icon 不給號 —
  // DESIGN.md:190 + mockup .row.is-hotel 不 counter-increment）。null = 飯店。
  const stopNumbers = orderedEvents.map((() => {
    let n = 0;
    return (e: TimelineEntryData) => (deriveTypeMeta(e).label === '住宿' ? null : ++n);
  })());

  return (
    <div className="tp-rail">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-rail-header">
        <span className="tp-rail-eyebrow">行程</span>
        <span className="tp-rail-meta">
          {orderedEvents.length} 個停留點{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      {/* 2026-07-07 跨天拖拉雙模：dndManaged = TripPage 統一 DndContext（跨 rail
        * 拖拉 + autoScroll 捲動換天），rail 只掛 monitor 接同日 reorder；
        * 否則（獨立頁）自建 context 維持原行為。嵌套 DndContext 會搶事件，
        * 兩模式互斥。 */}
      <RailDndScope
        managed={dndManaged}
        sensors={sensors}
        onDragStart={captureDragScroll}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
      <div ref={setRailBodyRef} data-sort-mode={sortMode || undefined} className={clsx('tp-rail-body', { 'is-drop-target': isRailDropOver, 'is-empty-day': orderedEvents.length === 0 })}>
        {/* v2.33.60 round 14: 拔 <div.tp-rail-line> orphan — CSS 已 display:none，DOM 也清掉 */}
        {orderedEvents.map((entry, i) => {
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === orderedEvents.length - 1;
          const expanded = entry.id != null && expandedId === entry.id;
          // v2.24.0 γ.1：lookup segment for (prev, curr) pair
          const prev = i > 0 ? orderedEvents[i - 1] : null;
          // v2.31.8: `entry.travel` 在 backend _merge.ts 是 segmentsMap.get(from=eid) =
          // 「離開此 entry 到下一站」語意；UI pill 在 (prev → curr) 中間，意思是
          // 「抵達 curr 的旅程」。所以 fallback 要用 `prev.travel`（離開 prev = 抵達 curr）
          // 不是 `entry.travel`，否則 segments 還沒載入時會閃顯錯誤方向值。
          // segments 載入後 segment prop 覆蓋 → 正確值。
          const travelObj = prev?.travel && typeof prev.travel === 'object' ? prev.travel : null;
          const segment = (prev?.id != null && entry.id != null)
            ? segmentMap.get(`${prev.id}-${entry.id}`)
            : undefined;
          // 2026-07-06 車程重算缺口：pair 兩端都是真 entry 卻無 segment row 也無
          // legacy travel（刪除/搬日後的新 adjacency、或缺座標 pair 永遠算不出）
          // → 不能整顆 pill 消失（user 連 ⚠ 重算鈕都沒有，無從補救 — codex
          // review P1）。segments ready 後才判 missing，避免載入期閃 ⚠。
          const pairMissing = segmentsReady && !segment && !travelObj
            && prev?.id != null && entry.id != null;
          // 缺座標 pair：self-healing 排除（見上方 gaps 條件），無法自動補算 → chip
          // 顯「缺座標」誠實訊息，而非假稱「重新計算中」（adversarial review P1）。
          const pairMissingCoords = pairMissing
            && (prev?.masterLat == null || prev?.masterLng == null
              || entry.masterLat == null || entry.masterLng == null);
          return (
            <div key={entry.id ?? i} className="tp-rail-row-wrap">
              {i > 0 && (travelObj || segment || pairMissing) && (
                <TravelPill
                  type={travelObj?.type ?? null}
                  desc={travelObj?.desc ?? null}
                  min={travelObj?.min ?? null}
                  distanceM={travelObj?.distanceM ?? null}
                  segment={segment ? {
                    id: segment.id,
                    mode: segment.mode,
                    submode: segment.submode,
                    source: segment.source,
                    min: segment.min,
                    distanceM: segment.distanceM,
                    computedAt: segment.computedAt,
                    noTravel: segment.noTravel,
                  } : undefined}
                  sameplace={travelObj?.sameplace || undefined}
                  missing={pairMissing || undefined}
                  missingCoords={pairMissingCoords || undefined}
                  recomputeStalled={recomputeStalled || undefined}
                  tripId={tripId}
                  fromName={prev ? getTimelineEntryDisplayTitle(prev) : null}
                  toName={getTimelineEntryDisplayTitle(entry)}
                  fromEntryId={prev?.id ?? undefined}
                  toEntryId={entry.id ?? undefined}
                />
              )}
              <RailRow
                entry={entry}
                index={i}
                expanded={expanded}
                onToggle={() => {
                  if (entry.id == null) return;
                  setExpandedId((cur) => (cur === entry.id ? null : entry.id ?? null));
                }}
                isPast={isPast}
                isNow={isNow}
                isLast={isLast}
                dayId={dayId}
                sortMode={sortMode}
                onEnterSortMode={enterSortMode}
                stopNumber={stopNumbers[i] ?? null}
                onMoveStep={moveEntryStep}
              />
            </div>
          );
        })}
        {sortMode && (
          <div className="tp-rail-sort-done">
            <button type="button" onClick={() => setSortMode(false)}>完成排序</button>
          </div>
        )}
      </div>
        </SortableContext>
      </RailDndScope>
    </div>
  );
});

/** 雙模 DnD wrapper — managed 時不建 context（外層 TripPage 提供），掛 monitor 橋。 */
function RailDndScope({ managed, sensors, onDragStart, onDragEnd, children }: {
  managed: boolean;
  sensors: ReturnType<typeof useDragDrop>['sensors'];
  onDragStart: () => void;
  onDragEnd: (e: DragEndEvent) => void;
  children: React.ReactNode;
}) {
  if (managed) {
    return (
      <>
        <DndMonitorBridge onDragStart={onDragStart} onDragEnd={onDragEnd} />
        {children}
      </>
    );
  }
  return (
    <DndContext sensors={sensors} accessibility={TP_DRAG_ACCESSIBILITY} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={restoreDragScroll}>
      {children}
    </DndContext>
  );
}

export default TimelineRail;
