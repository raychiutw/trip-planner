import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Icon from '../../src/components/shared/Icon';

describe('Icon — edit & menu entries', () => {
  it('renders edit icon with SVG path containing stroke-linecap', () => {
    const { container } = render(<Icon name="edit" />);
    const path = container.querySelector('svg path');
    expect(path).not.toBeNull();
    const svg = container.querySelector('svg');
    expect(svg?.innerHTML).toContain('stroke-linecap');
  });

  it('renders menu icon with SVG path containing stroke path data', () => {
    const { container } = render(<Icon name="menu" />);
    const path = container.querySelector('svg path');
    expect(path).not.toBeNull();
    const svg = container.querySelector('svg');
    expect(svg?.innerHTML).toContain('d="M3 12h18');
  });
});
