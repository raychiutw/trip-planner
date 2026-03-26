import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * R4 structural validations — CSS + TSX structure checks
 * for QuickPanel, Bottom Sheet changes.
 */

const styleCss = readFileSync('css/style.css', 'utf-8');
const sharedCss = readFileSync('css/shared.css', 'utf-8');

/* ===== Helpers ===== */

/** Extract all CSS rules containing a given selector substring */
function rulesFor(css, selector) {
  const rules = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1].includes(selector)) {
      rules.push({ selector: m[1].trim(), body: m[2].trim() });
    }
  }
  return rules;
}

/** Get the body of the first rule matching a selector */
function ruleBody(css, selector) {
  const rules = rulesFor(css, selector);
  const exact = rules.find(r => r.selector === selector);
  return exact ? exact.body : (rules[0]?.body ?? '');
}

/* ===== QuickPanel CSS structure ===== */

describe('QuickPanel CSS structure', () => {
  it('.quick-panel-trigger has FAB styling (fixed, border-radius 50%)', () => {
    const body = ruleBody(styleCss, '.quick-panel-trigger');
    expect(body).toContain('position: fixed');
    expect(body).toContain('border-radius: 50%');
    expect(body).toContain('width: var(--fab-size)');
  });

  it('.quick-panel-grid uses 3-column grid', () => {
    const body = ruleBody(styleCss, '.quick-panel-grid');
    expect(body).toContain('grid-template-columns: repeat(3, 1fr)');
  });

  it('.quick-panel-item has min-height: var(--spacing-tap-min)', () => {
    const body = ruleBody(styleCss, '.quick-panel-item');
    expect(body).toContain('min-height: var(--spacing-tap-min)');
  });

  it('.quick-panel-item has cursor: pointer', () => {
    const body = ruleBody(styleCss, '.quick-panel-item');
    expect(body).toContain('cursor: pointer');
  });

  it('.quick-panel-sheet has bottom sheet positioning', () => {
    const body = ruleBody(styleCss, '.quick-panel-sheet');
    expect(body).toContain('position: fixed');
    expect(body).toContain('bottom: 0');
    expect(body).toContain('transform: translateY(100%)');
  });

  it('.quick-panel.open .quick-panel-sheet transforms to visible', () => {
    const body = ruleBody(styleCss, '.quick-panel.open .quick-panel-sheet');
    expect(body).toContain('transform: translateY(0)');
  });

  it('.quick-panel-divider uses spacing (no border line)', () => {
    const body = ruleBody(styleCss, '.quick-panel-divider');
    expect(body).toContain('margin: var(--spacing-3) 0');
    expect(body).not.toContain('height: 1px');
    expect(body).not.toContain('background:');
  });

  it('no old speed-dial CSS remnants', () => {
    expect(styleCss).not.toContain('.speed-dial-trigger');
    expect(styleCss).not.toContain('.speed-dial-items');
    expect(styleCss).not.toContain('.speed-dial-item');
    expect(styleCss).not.toContain('.speed-dial-label');
    expect(styleCss).not.toContain('.speed-dial-backdrop');
  });

  it('no old download-sheet CSS remnants', () => {
    expect(styleCss).not.toContain('.download-backdrop');
    expect(styleCss).not.toContain('.download-sheet');
    expect(styleCss).not.toContain('.download-option');
  });

  it('QuickPanel.tsx has 14 panel items', () => {
    const tsx = readFileSync('src/components/trip/QuickPanel.tsx', 'utf-8');
    // Match PANEL_ITEMS entries: { key: '...', icon: '...', label: '...', action: '...'
    const matches = tsx.match(/\{ key: '[^']+', icon: '[^']+', label: '[^']+', action: '/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(14);
  });

  it('QuickPanel.tsx FAB uses upward triangle path', () => {
    const tsx = readFileSync('src/components/trip/QuickPanel.tsx', 'utf-8');
    expect(tsx).toContain('M12 8l-6 6h12z');
  });

  it('QuickPanel.tsx has no old SpeedDial references', () => {
    const tsx = readFileSync('src/components/trip/QuickPanel.tsx', 'utf-8');
    expect(tsx).not.toContain('speed-dial');
    expect(tsx).not.toContain('SpeedDial');
  });

  it('TripPage.tsx imports QuickPanel (not SpeedDial)', () => {
    const tsx = readFileSync('src/pages/TripPage.tsx', 'utf-8');
    expect(tsx).toContain("import QuickPanel from '../components/trip/QuickPanel'");
    expect(tsx).not.toContain("import SpeedDial from");
    expect(tsx).not.toContain("import DownloadSheet from");
  });
});

/* ===== R4-7: Bottom Sheet fixed height ===== */

describe('R4-7 Bottom Sheet fixed height', () => {
  it('.info-sheet-panel has height 92dvh or 92vh', () => {
    const body = ruleBody(styleCss, '.info-sheet-panel');
    expect(body).toMatch(/height:\s*92[dv]vh/);
  });

  it('no .dragging class in CSS', () => {
    expect(styleCss).not.toContain('.info-sheet-panel.dragging');
  });

  it('InfoSheet.tsx has no drag-related code', () => {
    const tsx = readFileSync('src/components/trip/InfoSheet.tsx', 'utf-8');
    expect(tsx).not.toContain('SNAP_STEP');
    expect(tsx).not.toContain('DRAG_THRESHOLD');
    expect(tsx).not.toContain('handleDragStart');
    expect(tsx).not.toContain('handleDragEnd');
    expect(tsx).not.toContain('heightStyle');
    expect(tsx).not.toContain('classList.add');
    expect(tsx).not.toContain('bodyDragMode');
  });
});

/* ===== R4-8: Bottom Sheet compact header ===== */

describe('R4-8 Bottom Sheet compact header', () => {
  it('.sheet-handle padding is 8px 0 (not 20px)', () => {
    const body = ruleBody(styleCss, '.sheet-handle');
    expect(body).toContain('padding: 8px 0');
    expect(body).not.toContain('padding: 20px');
  });

  it('.sheet-header margin-bottom is 8px (not 12px)', () => {
    const body = ruleBody(styleCss, '.sheet-header');
    expect(body).toContain('margin-bottom: 8px');
  });

  it('.sheet-handle has no cursor: grab', () => {
    const body = ruleBody(styleCss, '.sheet-handle');
    expect(body).not.toContain('cursor: grab');
  });
});

/* ===== R4-10: X button icon size consistency ===== */

describe('R4-10 close button icon size consistency', () => {
  it('.sheet-close-btn svg is 20px', () => {
    const rules = rulesFor(styleCss, '.sheet-close-btn');
    const svgRule = rules.find(r => r.selector.includes('svg'));
    expect(svgRule).toBeDefined();
    expect(svgRule.body).toContain('width: 20px');
    expect(svgRule.body).toContain('height: 20px');
  });

  it('.nav-close-btn button is var(--spacing-tap-min)', () => {
    const body = ruleBody(sharedCss, '.nav-close-btn');
    expect(body).toContain('width: var(--spacing-tap-min)');
    expect(body).toContain('height: var(--spacing-tap-min)');
  });

  it('.sheet-close-btn button is var(--spacing-tap-min)', () => {
    const body = ruleBody(styleCss, '.sheet-close-btn');
    expect(body).toContain('width: var(--spacing-tap-min)');
    expect(body).toContain('height: var(--spacing-tap-min)');
  });
});

/* ===== R4-11: X button no circle outline ===== */

describe('R4-11 close button no circle outline', () => {
  it('.sheet-close-btn has outline: none and box-shadow: none by default', () => {
    const body = ruleBody(styleCss, '.sheet-close-btn');
    expect(body).toContain('outline: none');
    expect(body).toContain('box-shadow: none');
  });

  it('.sheet-close-btn:focus and :focus-visible both suppress outline', () => {
    const focusRules = rulesFor(styleCss, '.sheet-close-btn:focus');
    expect(focusRules.length).toBeGreaterThan(0);
    expect(focusRules[0].body).toContain('outline: none');
    expect(focusRules[0].body).toContain('box-shadow: none');
    const fvRules = rulesFor(styleCss, '.sheet-close-btn:focus-visible');
    expect(fvRules.length).toBeGreaterThan(0);
    expect(fvRules[0].body).toContain('outline: none');
    expect(fvRules[0].body).toContain('box-shadow: none');
  });
});

/* ===== R4-1: InfoPanel hotel + transport card padding ===== */

describe('R4-1 InfoPanel card padding', () => {
  it('.hotel-summary-card has spacing-4/spacing-5 padding', () => {
    const body = ruleBody(styleCss, '.hotel-summary-card');
    expect(body).toContain('padding: var(--spacing-4) var(--spacing-5)');
  });

  it('.transport-summary-card has spacing-4/spacing-5 padding', () => {
    const body = ruleBody(styleCss, '.transport-summary-card');
    expect(body).toContain('padding: var(--spacing-4) var(--spacing-5)');
  });
});

/* ===== R4-2: InfoPanel width restored to 280px ===== */

describe('R4-2 InfoPanel width', () => {
  it('--info-panel-w is 280px', () => {
    expect(sharedCss).toContain('--info-panel-w: 280px');
  });
});

/* ===== R4-3: TodaySummary map links removed ===== */

describe('R4-3 TodaySummary map links removed', () => {
  it('TodaySummary.tsx has no map link code', () => {
    const tsx = readFileSync('src/components/trip/TodaySummary.tsx', 'utf-8');
    expect(tsx).not.toContain('today-summary-links');
    expect(tsx).not.toContain('today-summary-map-link');
    expect(tsx).not.toContain('getGoogleUrl');
    expect(tsx).not.toContain('getNaverUrl');
    expect(tsx).not.toContain('escUrl');
  });

  it('CSS has no .today-summary-links or .today-summary-map-link', () => {
    expect(styleCss).not.toContain('.today-summary-links');
    expect(styleCss).not.toContain('.today-summary-map-link');
  });
});

/* ===== R4-4: scrollIntoView removed ===== */

describe('R4-4 scrollIntoView removed', () => {
  it('InfoPanel.tsx has no handleEntryClick or scrollIntoView', () => {
    const tsx = readFileSync('src/components/trip/InfoPanel.tsx', 'utf-8');
    expect(tsx).not.toContain('handleEntryClick');
    expect(tsx).not.toContain('scrollIntoView');
    expect(tsx).not.toContain('data-entry-index');
  });

  it('TodaySummary.tsx has no onEntryClick prop', () => {
    const tsx = readFileSync('src/components/trip/TodaySummary.tsx', 'utf-8');
    expect(tsx).not.toContain('onEntryClick');
    expect(tsx).not.toContain('role="button"');
  });

  it('TimelineEvent.tsx has no data-entry-index', () => {
    const tsx = readFileSync('src/components/trip/TimelineEvent.tsx', 'utf-8');
    expect(tsx).not.toContain('data-entry-index');
  });

  it('.today-summary-item has no cursor: pointer', () => {
    const body = ruleBody(styleCss, '.today-summary-item');
    expect(body).not.toContain('cursor: pointer');
  });
});
