/**
 * TripSelect — terracotta-themed select (replaces native <select>).
 *
 * Covers:
 *   - Trigger renders placeholder when value not in options
 *   - Trigger shows label for current value
 *   - Listbox opens on trigger click + shows all options
 *   - Selecting an option fires onChange with value and closes listbox
 *   - Disabled trigger does not open listbox
 *   - variant='pill' applies the pill modifier class to the root
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TripSelect } from '../../src/components/TripSelect';

const OPTIONS = [
  { value: 'updated', label: '最新編輯' },
  { value: 'start', label: '出發日近' },
  { value: 'name', label: '名稱 A→Z' },
] as const;

describe('TripSelect', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows placeholder when value not matched', () => {
    render(<TripSelect value="missing" onChange={() => {}} options={[...OPTIONS]} placeholder="請選擇" />);
    expect(screen.getByRole('button')).toHaveTextContent('請選擇');
  });

  it('shows option label for current value', () => {
    render(<TripSelect value="start" onChange={() => {}} options={[...OPTIONS]} />);
    expect(screen.getByRole('button')).toHaveTextContent('出發日近');
  });

  it('opens listbox on click and shows all options', () => {
    render(<TripSelect value="updated" onChange={() => {}} options={[...OPTIONS]} />);
    fireEvent.click(screen.getByRole('button'));
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('最新編輯')).toBeInTheDocument();
    expect(within(list).getByText('出發日近')).toBeInTheDocument();
    expect(within(list).getByText('名稱 A→Z')).toBeInTheDocument();
  });

  it('calls onChange and closes listbox when option clicked', () => {
    const onChange = vi.fn();
    render(<TripSelect value="updated" onChange={onChange} options={[...OPTIONS]} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('名稱 A→Z'));
    expect(onChange).toHaveBeenCalledWith('name');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<TripSelect value="updated" onChange={() => {}} options={[...OPTIONS]} disabled />);
    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('applies pill variant modifier class to root', () => {
    const { container } = render(
      <TripSelect value="updated" onChange={() => {}} options={[...OPTIONS]} variant="pill" />,
    );
    const root = container.querySelector('.tp-select');
    expect(root).not.toBeNull();
    expect(root!.className).toContain('tp-select--pill');
  });
});
