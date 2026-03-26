import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RequestStepperV2 from '../../src/components/shared/RequestStepperV2';

describe('RequestStepperV2', () => {
  it('renders 4 step labels', () => {
    const { getByText } = render(<RequestStepperV2 status="open" />);
    expect(getByText('送出')).toBeTruthy();
    expect(getByText('接收')).toBeTruthy();
    expect(getByText('處理中')).toBeTruthy();
    expect(getByText('已回覆')).toBeTruthy();
  });

  it('has role="group" and aria-label', () => {
    const { container } = render(<RequestStepperV2 status="open" />);
    const group = container.querySelector('[role="group"]');
    expect(group).toBeTruthy();
    expect(group?.getAttribute('aria-label')).toBe('請求進度');
  });

  describe('status: open — 第一步 active', () => {
    it('first dot has active class (border accent)', () => {
      const { container } = render(<RequestStepperV2 status="open" />);
      const dots = container.querySelectorAll('.rounded-full');
      expect(dots[0]?.className).toContain('border-accent');
    });

    it('first label has accent color and semibold', () => {
      const { getByText } = render(<RequestStepperV2 status="open" />);
      const label = getByText('送出');
      expect(label.className).toContain('text-accent');
      expect(label.className).toContain('font-semibold');
    });
  });

  describe('status: processing — 第三步 active', () => {
    it('first two dots are done (bg accent)', () => {
      const { container } = render(<RequestStepperV2 status="processing" />);
      const dots = container.querySelectorAll('.rounded-full');
      // 送出 = done, 接收 = done
      expect(dots[0]?.className).toContain('bg-accent');
      expect(dots[1]?.className).toContain('bg-accent');
    });

    it('third dot is active (border accent + animation)', () => {
      const { container } = render(<RequestStepperV2 status="processing" />);
      const dots = container.querySelectorAll('.rounded-full');
      expect(dots[2]?.className).toContain('border-accent');
      expect(dots[2]?.className).toContain('animate-');
    });

    it('fourth dot is pending (border)', () => {
      const { container } = render(<RequestStepperV2 status="processing" />);
      const dots = container.querySelectorAll('.rounded-full');
      expect(dots[3]?.className).toContain('border-border');
    });
  });

  describe('status: completed — 全部 done', () => {
    it('all 4 dots are done (bg accent)', () => {
      const { container } = render(<RequestStepperV2 status="completed" />);
      const dots = container.querySelectorAll('.rounded-full');
      // completed = index 3, 所以 0,1,2 是 done, 3 是 active
      expect(dots[0]?.className).toContain('bg-accent');
      expect(dots[1]?.className).toContain('bg-accent');
      expect(dots[2]?.className).toContain('bg-accent');
      // 第四個是 active（最後一步）
      expect(dots[3]?.className).toContain('border-accent');
    });

    it('done labels have muted color', () => {
      const { getByText } = render(<RequestStepperV2 status="completed" />);
      expect(getByText('送出').className).toContain('text-muted');
      expect(getByText('接收').className).toContain('text-muted');
    });
  });

  describe('status: received — 第二步 active', () => {
    it('connecting lines have correct state', () => {
      const { container } = render(<RequestStepperV2 status="received" />);
      // 3 connecting lines between 4 steps
      const lines = container.querySelectorAll('.h-0\\.5');
      expect(lines).toHaveLength(3);
      // Line 1 (open→received): done
      expect(lines[0]?.className).toContain('bg-accent');
      // Line 2 (received→processing): pending
      expect(lines[1]?.className).toContain('bg-(--color-border)');
      // Line 3 (processing→completed): pending
      expect(lines[2]?.className).toContain('bg-(--color-border)');
    });
  });
});
