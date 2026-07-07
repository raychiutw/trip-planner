/**
 * crossDayMove — 跨天拖拉的 batch PATCH payload 計算（2026-07-07）
 *
 * TripPage 統一 DndContext 收到「active 與 over 屬不同天」的 drop 時，把
 * entry 插進目標日指定位置：moved entry 換 day_id + 佔該位 sort_order，
 * 目標日插入點之後的 entries 依序 +1。來源日不重排 — sort_order 留 gap
 * 無妨（後端 ORDER BY sort_order，相對序不變）。
 *
 * 純函數：TripPage 直接用，unit test 直測。
 */

export interface CrossDayMoveUpdate {
  id: number;
  day_id?: number;
  sort_order: number;
}

/**
 * TripPage DndContext 的 collision 策略：sortable items 永遠優先，沒有
 * item 命中才 fallback 到 rail container droppables。
 *
 * 為何（codex review P1）：rail body droppable 幾何上蓋住所有 rows —
 * 純 closestCenter 下 (a) 同日拖到 rail 空白 over=body → monitor 判 no-op
 * （regression：原行為會挑最近 item）；(b) 單 item 天 body/item 中心 tie
 * → 可能選 body → 想插最前卻 append。items-first 同時修兩者，且空日
 * （無 items）自然 fallback 到 container = 空日可 drop。
 *
 * 用 any-free 的結構型別以免耦合 dnd-kit 內部型別版本。
 */
export function railItemsFirstCollision<
  Args extends {
    droppableContainers: Array<{ data: { current?: { railContainer?: boolean } | undefined } }>;
  },
  Ret,
>(closest: (args: Args) => Ret[], args: Args): Ret[] {
  const items = args.droppableContainers.filter((c) => !c.data.current?.railContainer);
  const itemHits = closest({ ...args, droppableContainers: items });
  if (itemHits.length > 0) return itemHits;
  const rails = args.droppableContainers.filter((c) => c.data.current?.railContainer);
  return closest({ ...args, droppableContainers: rails });
}

/**
 * @param activeEntryId 被拖的 entry
 * @param targetDayId 目標日 trip_days.id
 * @param targetEntryIds 目標日現有 entries（依 sort_order 序）
 * @param overEntryId drop 在目標日哪個 entry 上；null / 找不到 = 插末尾
 *   （拖到 rail 空白處或空日的 rail container）
 */
export function buildCrossDayMoves(
  activeEntryId: number,
  targetDayId: number,
  targetEntryIds: number[],
  overEntryId: number | null,
): CrossDayMoveUpdate[] {
  // 防呆：target 列表不應含 active（跨天前提），含了就當同日 — 交還 caller 處理
  const ids = targetEntryIds.filter((id) => id !== activeEntryId);
  const overIdx = overEntryId != null ? ids.indexOf(overEntryId) : -1;
  const insertIdx = overIdx >= 0 ? overIdx : ids.length;

  return [
    { id: activeEntryId, day_id: targetDayId, sort_order: insertIdx },
    ...ids.slice(insertIdx).map((id, i) => ({ id, sort_order: insertIdx + 1 + i })),
  ];
}
