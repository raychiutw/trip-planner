import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('GlobalMapPage hotel marker labels', () => {
  it('does not render the old hotel bed emoji in sheet stop dots', () => {
    const source = readFileSync('src/pages/GlobalMapPage.tsx', 'utf-8');
    expect(source).not.toContain('🛏');
    expect(source).toContain("{p.index || '·'}");
  });
});
