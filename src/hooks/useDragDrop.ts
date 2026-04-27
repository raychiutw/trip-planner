import {
  KeyboardSensor,
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
    pointerSensor,
    ...(includeTouch ? [touchSensor] : []),
    keyboardSensor,
  );

  return { sensors };
}
