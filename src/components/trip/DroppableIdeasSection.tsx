/**
 * DroppableIdeasSection — 把 Ideas section 包成 dnd-kit drop target，drag entry
 * 到此區域觸發 demote flow。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-reorder/spec.md
 *   "Entry 拖回 Ideas 觸發 demote"。
 *
 * Drop id 固定 `ideas-section`，由父層 onDragEnd 比對 `over.id === 'ideas-section'`
 * 判斷是 demote 動作。當前架構 IdeasTabContent (TripSheet) 與 TimelineRail (主
 * Itinerary view) 在不同 DndContext，cross-component drag 為 V2 lift DndContext
 * 後啟動；此 component 提供 ID-based droppable wiring 讓 V2 ready。
 */
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export const IDEAS_SECTION_DROP_ID = 'ideas-section';

interface DroppableIdeasSectionProps {
  children: ReactNode;
  /** 提示文字（drag 進入時顯示），預設「拖到此處移回 Ideas」 */
  hint?: string;
}

export default function DroppableIdeasSection({ children, hint = '拖到此處移回 Ideas' }: DroppableIdeasSectionProps) {
  const { isOver, setNodeRef } = useDroppable({ id: IDEAS_SECTION_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={`tp-ideas-droppable${isOver ? ' is-over' : ''}`}
      data-testid="droppable-ideas-section"
      data-over={isOver || undefined}
      aria-label={hint}
    >
      {children}
      {isOver && (
        <div className="tp-ideas-droppable-hint" role="status" aria-live="polite">
          {hint}
        </div>
      )}
    </div>
  );
}
