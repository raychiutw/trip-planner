/**
 * useTypeaheadKeyboard — ARIA combobox keyboard navigation for typeahead UI.
 *
 * v2.31.94. Shared by AddCustomStopPage (mobile fullpage) and AddStopPage
 * 自訂 tab (desktop inline) — same a11y semantics, two callers.
 *
 * Implements WCAG 2.1 Level A "combobox / listbox" pattern:
 *   - Arrow Down: focus next option (wraps to first)
 *   - Arrow Up: focus previous option (wraps to last)
 *   - Enter: pick currently focused option (if any)
 *   - Escape: close + reset focus
 *
 * Caller wires the returned `inputProps` onto the text <input role="combobox">
 * and reads `focusedIndex` / `getOptionId(i)` to set `aria-activedescendant`
 * and `aria-selected` on each <button role="option">.
 */
import { useCallback, useEffect, useState } from 'react';

export interface UseTypeaheadKeyboardOptions<T> {
  listId: string;
  options: T[];
  onPick: (option: T) => void;
}

export interface UseTypeaheadKeyboardResult {
  focusedIndex: number;
  /** stable id for each option (combobox aria-activedescendant target) */
  getOptionId: (index: number) => string;
  /** spread on the text <input role="combobox"> */
  inputProps: {
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-autocomplete': 'list';
    'aria-activedescendant': string | undefined;
    onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /** Reset focus to -1 (no selection). Caller invokes after `onPick`. */
  resetFocus: () => void;
}

export function useTypeaheadKeyboard<T>(
  opts: UseTypeaheadKeyboardOptions<T>,
): UseTypeaheadKeyboardResult {
  const { listId, options, onPick } = opts;
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // When the option list shape changes (length / first item), reset focus to
  // avoid pointing at a stale index.
  useEffect(() => {
    setFocusedIndex(-1);
  }, [options.length]);

  const getOptionId = useCallback((i: number) => `${listId}-opt-${i}`, [listId]);

  const onKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      if (options.length === 0) return;
      switch (ev.key) {
        case 'ArrowDown':
          ev.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % options.length);
          break;
        case 'ArrowUp':
          ev.preventDefault();
          setFocusedIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
          break;
        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            ev.preventDefault();
            onPick(options[focusedIndex]!);
          }
          break;
        case 'Escape':
          ev.preventDefault();
          setFocusedIndex(-1);
          break;
        default:
          return;
      }
    },
    [focusedIndex, options, onPick],
  );

  const resetFocus = useCallback(() => setFocusedIndex(-1), []);

  return {
    focusedIndex,
    getOptionId,
    inputProps: {
      role: 'combobox',
      'aria-expanded': options.length > 0,
      'aria-controls': listId,
      'aria-autocomplete': 'list',
      'aria-activedescendant':
        focusedIndex >= 0 ? `${listId}-opt-${focusedIndex}` : undefined,
      onKeyDown,
    },
    resetFocus,
  };
}
