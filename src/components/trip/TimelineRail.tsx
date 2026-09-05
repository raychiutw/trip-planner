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

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { DndContext, useDndMonitor, useDroppable, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTripId } from '../../contexts/TripIdContext';
import { useTripDays } from '../../contexts/TripDaysContext';
import { reorderEntries } from '../../lib/entryMutations';
import { requestTravelRecompute, getAutoRecomputeStatus } from '../../lib/travelRecompute';
import { captureDragScroll, restoreDragScroll } from '../../lib/preserveScroll';
import { EVENT } from '../../lib/events';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';
import { showToast } from '../shared/Toast';
import TravelPill from './TravelPill';
import type { TimelineEntryData } from './TimelineEvent';
import { parseEntryTime } from '../../lib/timelineUtils';
import { dayNumFromId } from '../../lib/entryAction';
import { useDragDrop } from '../../hooks/useDragDrop';
import { useTripSegments } from '../../hooks/useTripSegments';
import { getTimelineEntryDisplayTitle } from '../../lib/stopDisplay';
import { RailRow } from './RailRow';
import { TIMELINE_RAIL_SCOPED_STYLES } from './TimelineRail.styles';

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
      // #1260：batch reorder + day-scope 重算 + emit 在 module；失敗 revert override。
      const r = await reorderEntries(tripId, dayNumFromId(allDays, dayId), newIds);
      if (!r.ok) throw new Error(`batch reorder failed: ${r.status}`);
      void sourceEntryId;
      void r.recompute.then((ok) => {
        if (!ok) showToast('順序已儲存，但車程時間更新失敗，重新整理後再試', 'info');
      });
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

  return (
    <div className="tp-rail">
      <style>{TIMELINE_RAIL_SCOPED_STYLES}</style>
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
                stopNumber={i + 1}
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

