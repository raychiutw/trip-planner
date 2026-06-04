import {
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export interface UseDragDropOptions {
  includeTouch?: boolean;
  pointerActivationDistance?: number;
  touchActivationDelay?: number;
  touchActivationTolerance?: number;
  sortable?: boolean;
}

export function useDragDrop({
  includeTouch = false,
  pointerActivationDistance = 4,
  touchActivationDelay = 200,
  touchActivationTolerance = 5,
  sortable = false,
}: UseDragDropOptions = {}) {
  // Drag-vs-scroll: when touch is enabled we deliberately split mouse and touch
  // across two single-purpose sensors instead of one PointerSensor:
  //   • MouseSensor  → desktop, instant drag once moved `pointerActivationDistance`.
  //   • TouchSensor  → touch, press-and-hold `touchActivationDelay` so a quick
  //                    vertical swipe scrolls the page instead of grabbing a card.
  // A PointerSensor would ALSO fire for touch (pointer events) with no delay and
  // out-race the 200ms TouchSensor, hijacking scroll into an accidental reorder.
  // Pointer-only contexts (includeTouch=false) keep PointerSensor for mouse + pen.
  // Accepted narrow gap on the touch path: a stylus that emits ONLY pointer events
  // (no mouse/touch emulation) won't initiate drag and falls back to the
  // KeyboardSensor reorder — re-adding PointerSensor here would bring the race back.
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: pointerActivationDistance },
  });
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: pointerActivationDistance },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: touchActivationDelay, tolerance: touchActivationTolerance },
  });
  const keyboardSensor = useSensor(
    KeyboardSensor,
    sortable ? { coordinateGetter: sortableKeyboardCoordinates } : {},
  );

  const sensors = useSensors(
    includeTouch ? mouseSensor : pointerSensor,
    ...(includeTouch ? [touchSensor] : []),
    keyboardSensor,
  );

  return { sensors };
}
