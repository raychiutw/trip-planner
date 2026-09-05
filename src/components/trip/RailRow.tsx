/** 時間軸的一列（#1262 自 TimelineRail 拆出）：render + ⋯ menu + 展開明細；資料變更走 entry 變更 module。 */
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTripId } from '../../contexts/TripIdContext';
import { useTripDays } from '../../contexts/TripDaysContext';
import { updateEntryPoi, deleteEntry } from '../../lib/entryMutations';
import { EVENT } from '../../lib/events';
import { poiCategoryLabel } from '../../lib/poiCategory';
import Icon from '../shared/Icon';
import ConfirmModal from '../shared/ConfirmModal';
import { showToast } from '../shared/Toast';
import { useAutosave } from '../../hooks/useAutosave';
import MarkdownText from '../shared/MarkdownText';
import { useNavigate } from 'react-router-dom';
import MapLinks from './MapLinks';
import type { StopPoiOptionData, TimelineEntryData } from './TimelineEvent';
import { parseEntryTime, formatDurationCompact, deriveTypeMeta } from '../../lib/timelineUtils';
import { dayNumFromId } from '../../lib/entryAction';
import { getTimelineEntryDisplayTitle } from '../../lib/stopDisplay';
import { condenseHours } from '../../lib/poiHours';
import { RailRowMenu, type RailMenuItem } from './RailRowMenu';
import { StopPoiChoiceCard } from './StopPoiChoiceCard';
import { EntryTimeChip } from './EntryTimeChip';

export interface RailRowProps {
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
  /** 當日所有停留點共用的連續序號。 */
  stopNumber: number;
  /** W13 拖拉 a11y：⋯ menu「上移一格/下移一格」的鍵盤/觸控替代排序（不靠拖曳，給 VoiceOver/TalkBack）。 */
  onMoveStep?: (entryId: number, dir: 'up' | 'down') => void;
}

/** ⋯ context menu 的一列（或分隔線）。 */

export const RailRow = memo(function RailRow({ entry, index, expanded, onToggle, isPast, isNow, isLast, dayId, sortMode, onEnterSortMode, stopNumber, onMoveStep }: RailRowProps) {
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
      // v2.29.x：per-POI note 端點（master poiId）。LWW，不帶 version token。#1260 走 module。
      const r = await updateEntryPoi(tripId, entryIdNum, dayNumFromId(allDays, dayId), masterPoiId, body);
      if (!r.ok) throw new Error(r.message || '備註儲存失敗');
      return r.data;
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
      // #1260：刪除後新相鄰 pair 缺 segment 的 day-scoped recompute 由 module 保證。
      const r = await deleteEntry(tripId, entryIdNum, dayNumFromId(allDays, dayId));
      if (!r.ok) throw new Error('刪除失敗');
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
        <span className="tp-rail-dot" aria-hidden="true">{stopNumber}</span>
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

