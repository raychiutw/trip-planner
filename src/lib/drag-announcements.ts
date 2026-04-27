/**
 * dnd-kit Announcements — 中文化 screen reader 提示，供 Ideas/Itinerary
 * DndContext 的 `accessibility.announcements` 套用。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   "Drag keyboard 支援（a11y）" + drag-to-promote spec 「a11y fallback」要求。
 *
 * dnd-kit 預設提供英文 announcements（"Picked up draggable item ..."）。本檔
 * 改成繁體中文，落到 `<DndLiveRegion role="status" aria-live="assertive">`，
 * keyboard / screen reader 使用者操作時即時播報目前狀態。
 */
import type { Announcements } from '@dnd-kit/core';

const labelOf = (id: unknown) => (id == null ? '項目' : String(id));

export const TP_DRAG_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `已選取 ${labelOf(active?.id)}，可用方向鍵移動，Enter 放下，Esc 取消。`;
  },
  onDragOver({ active, over }) {
    if (!over) return `${labelOf(active?.id)} 目前未指向放置區。`;
    return `${labelOf(active?.id)} 移到 ${labelOf(over.id)} 上方。`;
  },
  onDragEnd({ active, over }) {
    if (!over) return `${labelOf(active?.id)} 已放下，未指向任何放置區，操作取消。`;
    return `${labelOf(active?.id)} 已放下到 ${labelOf(over.id)}。`;
  },
  onDragCancel({ active }) {
    return `${labelOf(active?.id)} 拖動已取消，項目回原位。`;
  },
};

/**
 * Default DndContext accessibility prop — apply to keep keyboard / screen reader
 * UX consistent across Ideas and Itinerary contexts.
 */
export const TP_DRAG_ACCESSIBILITY = {
  announcements: TP_DRAG_ANNOUNCEMENTS,
} as const;
