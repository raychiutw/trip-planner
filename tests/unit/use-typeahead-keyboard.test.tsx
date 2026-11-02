/**
 * useTypeaheadKeyboard tests — v2.31.94 a11y combobox keyboard nav.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypeaheadKeyboard } from '../../src/hooks/useTypeaheadKeyboard';

function fakeEvent(key: string): React.KeyboardEvent<HTMLInputElement> {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe('useTypeaheadKeyboard', () => {
  it('initial focusedIndex = -1', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b', 'c'], onPick }),
    );
    expect(result.current.focusedIndex).toBe(-1);
    expect(result.current.inputProps['aria-activedescendant']).toBeUndefined();
    expect(result.current.inputProps['aria-expanded']).toBe(true);
  });

  it('aria-expanded false when options empty', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: [], onPick: vi.fn() }),
    );
    expect(result.current.inputProps['aria-expanded']).toBe(false);
  });

  it('ArrowDown moves focus down', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b', 'c'], onPick: vi.fn() }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    expect(result.current.focusedIndex).toBe(0);
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    expect(result.current.focusedIndex).toBe(1);
    expect(result.current.inputProps['aria-activedescendant']).toBe('t-opt-1');
  });

  it('ArrowDown wraps to first after last', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b'], onPick: vi.fn() }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('ArrowUp from -1 jumps to last option', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b', 'c'], onPick: vi.fn() }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowUp')));
    expect(result.current.focusedIndex).toBe(2);
  });

  it('Enter picks focused option', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b'], onPick }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('Enter')));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('Enter is no-op when nothing focused', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a'], onPick }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('Enter')));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Escape resets focus to -1', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a', 'b'], onPick: vi.fn() }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('Escape')));
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('all keys no-op when options empty', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: [], onPick }),
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('Enter')));
    expect(result.current.focusedIndex).toBe(-1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('options length change resets focusedIndex', () => {
    const { result, rerender } = renderHook(
      ({ opts }: { opts: string[] }) =>
        useTypeaheadKeyboard({ listId: 't', options: opts, onPick: vi.fn() }),
      { initialProps: { opts: ['a', 'b', 'c'] } },
    );
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(fakeEvent('ArrowDown')));
    expect(result.current.focusedIndex).toBe(1);
    rerender({ opts: ['x'] });
    expect(result.current.focusedIndex).toBe(-1);
  });

  it('getOptionId returns stable id', () => {
    const { result } = renderHook(() =>
      useTypeaheadKeyboard({ listId: 't', options: ['a'], onPick: vi.fn() }),
    );
    expect(result.current.getOptionId(0)).toBe('t-opt-0');
    expect(result.current.getOptionId(5)).toBe('t-opt-5');
  });
});
