import { describe, it, expect } from 'vitest';

const { createSkeleton } = require('../../js/app.js');

/* ===== 3.4 Skeleton DOM ===== */

describe('createSkeleton', () => {
  it('creates day sections for each dayId', () => {
    const html = createSkeleton([1, 2, 3]);
    expect(html).toContain('data-day="1"');
    expect(html).toContain('data-day="2"');
    expect(html).toContain('data-day="3"');
  });

  it('includes loading placeholder in day slots', () => {
    const html = createSkeleton([1]);
    expect(html).toContain('slot-loading');
    expect(html).toContain('載入中');
  });

  it('includes footer-slot only (no info slots)', () => {
    const html = createSkeleton([1]);
    expect(html).toContain('id="footer-slot"');
    expect(html).not.toContain('id="flights-slot"');
    expect(html).not.toContain('id="checklist-slot"');
    expect(html).not.toContain('id="backup-slot"');
    expect(html).not.toContain('id="emergency-slot"');
    expect(html).not.toContain('id="suggestions-slot"');
    expect(html).not.toContain('id="driving-slot"');
  });

  it('creates correct day-slot ids', () => {
    const html = createSkeleton([1, 2]);
    expect(html).toContain('id="day-slot-1"');
    expect(html).toContain('id="day-slot-2"');
  });

  it('day sections are visible by default (continuous scroll)', () => {
    const html = createSkeleton([1]);
    expect(html).not.toContain('display:none');
  });
});
