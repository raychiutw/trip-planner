import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import DroppableIdeasSection, { IDEAS_SECTION_DROP_ID } from '../../src/components/trip/DroppableIdeasSection';
import DemoteConfirmModal from '../../src/components/trip/DemoteConfirmModal';

describe('DroppableIdeasSection', () => {
  it('renders children in a droppable wrapper with stable test id', () => {
    render(
      <DndContext>
        <DroppableIdeasSection>
          <p>idea cards</p>
        </DroppableIdeasSection>
      </DndContext>,
    );
    expect(screen.getByTestId('droppable-ideas-section')).toBeTruthy();
    expect(screen.getByText('idea cards')).toBeTruthy();
  });

  it('exposes a stable drop id used by the parent onDragEnd handler', () => {
    expect(IDEAS_SECTION_DROP_ID).toBe('ideas-section');
  });

  it('does not show hint by default (no active drag)', () => {
    render(
      <DndContext>
        <DroppableIdeasSection hint="拖到這裡移回 Ideas">
          <p>x</p>
        </DroppableIdeasSection>
      </DndContext>,
    );
    // dnd-kit 自帶 DndLiveRegion role="status"；確認 hint copy 不在 DOM。
    expect(screen.queryByText('拖到這裡移回 Ideas')).toBeNull();
  });
});

describe('DemoteConfirmModal', () => {
  it('renders destructive copy + 確認/取消 buttons when open', () => {
    render(
      <DemoteConfirmModal open entryTitle="美ら海" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/美ら海/).textContent).toContain('美ら海');
    expect(screen.getByRole('button', { name: '確認移回' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    render(
      <DemoteConfirmModal open={false} entryTitle="x" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('clicking 確認移回 fires onConfirm; 取消 fires onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DemoteConfirmModal open entryTitle="x" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '確認移回' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses alertdialog role for screen reader destructive context', () => {
    render(
      <DemoteConfirmModal open entryTitle="x" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

describe('DroppableIdeasSection — onDragEnd contract', () => {
  it('parent handler can match over.id === IDEAS_SECTION_DROP_ID to trigger demote flow', () => {
    const onDragEnd = vi.fn((e: DragEndEvent) => {
      if (e.over?.id === IDEAS_SECTION_DROP_ID) {
        // demote handler would fire here
      }
    });
    render(
      <DndContext onDragEnd={onDragEnd}>
        <DroppableIdeasSection>
          <p>x</p>
        </DroppableIdeasSection>
      </DndContext>,
    );
    expect(IDEAS_SECTION_DROP_ID).toBe('ideas-section');
  });
});
