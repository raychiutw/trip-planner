import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Icon from '../../src/components/shared/Icon';
import { TRAVEL_METHODS } from '../../src/lib/travelMode';

describe('交通方式圖示 (#1587 發現 23)', () => {
  it('每個方式的 iconName 都在 Icon 元件註冊（會渲染出 svg）', () => {
    for (const m of TRAVEL_METHODS) {
      const { container } = render(<Icon name={m.iconName} />);
      expect(container.querySelector('svg'), m.key).not.toBeNull();
    }
  });
});
