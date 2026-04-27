import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConflictModal from '../../src/components/trip/ConflictModal';

describe('ConflictModal', () => {
  it('renders the conflicting entry and three resolution actions', () => {
    render(
      <ConflictModal
        open
        conflictTitle="水族館"
        time="14:00-15:00"
        onMoveAfter={vi.fn()}
        onParallel={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog').textContent).toContain('水族館');
    expect(screen.getByRole('dialog').textContent).toContain('14:00-15:00');
    expect(screen.getByRole('button', { name: '換位置' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '併排' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  });

  it('calls the selected resolution callback', () => {
    const onParallel = vi.fn();
    render(
      <ConflictModal
        open
        conflictTitle="水族館"
        time="14:00-15:00"
        onMoveAfter={vi.fn()}
        onParallel={onParallel}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '併排' }));
    expect(onParallel).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    render(
      <ConflictModal
        open={false}
        conflictTitle="水族館"
        time="14:00-15:00"
        onMoveAfter={vi.fn()}
        onParallel={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
