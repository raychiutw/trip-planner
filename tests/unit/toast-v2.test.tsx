import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ToastV2 from '../../src/components/shared/ToastV2';

describe('ToastV2', () => {
  it('renders message text', () => {
    const { getByText } = render(<ToastV2 message="已連線" icon="online" visible={true} />);
    expect(getByText('已連線')).toBeTruthy();
  });

  it('has role="status" and aria-live="polite"', () => {
    const { container } = render(<ToastV2 message="test" icon="online" visible={true} />);
    const el = container.querySelector('[role="status"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-live')).toBe('polite');
    expect(el?.getAttribute('aria-atomic')).toBe('true');
  });

  it('visible=true applies slide-down animation', () => {
    const { container } = render(<ToastV2 message="test" icon="online" visible={true} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('toast-slide-down');
    expect(el.className).not.toContain('opacity-0');
  });

  it('visible=false applies slide-up animation + opacity-0', () => {
    const { container } = render(<ToastV2 message="test" icon="online" visible={false} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('toast-slide-up');
    expect(el.className).toContain('opacity-0');
  });

  it('offline icon renders wifi-off SVG', () => {
    const { container } = render(<ToastV2 message="離線" icon="offline" visible={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Wifi-off has a diagonal line
    expect(container.querySelector('line')).toBeTruthy();
  });

  it('online icon renders checkmark SVG', () => {
    const { container } = render(<ToastV2 message="已連線" icon="online" visible={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Checkmark has a circle
    expect(container.querySelector('circle')).toBeTruthy();
    // No diagonal line
    expect(container.querySelector('line')).toBeNull();
  });

  it('offline icon has warning color', () => {
    const { container } = render(<ToastV2 message="test" icon="offline" visible={true} />);
    const iconSpan = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(iconSpan.className).toContain('text-warning');
  });

  it('online icon has success color', () => {
    const { container } = render(<ToastV2 message="test" icon="online" visible={true} />);
    const iconSpan = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(iconSpan.className).toContain('text-success');
  });

  it('icon span has aria-hidden="true"', () => {
    const { container } = render(<ToastV2 message="test" icon="online" visible={true} />);
    const iconSpan = container.querySelector('[aria-hidden="true"]');
    expect(iconSpan).toBeTruthy();
  });
});
