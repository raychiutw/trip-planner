import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * R4 structural validations — CSS + TSX structure checks
 * for SpeedDial, Bottom Sheet, and Download Sheet changes.
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

/* ===== R4-5: SpeedDial vertical column layout ===== */

describe('R4-5 SpeedDial vertical column', () => {
  it('.speed-dial-items uses flex-direction: column', () => {
    const body = ruleBody(styleCss, '.speed-dial-items');
    expect(body).toContain('flex-direction: column');
  });

  it('.speed-dial-items positioned right of FAB', () => {
    const body = ruleBody(styleCss, '.speed-dial-items');
    expect(body).toMatch(/right:\s*calc\(var\(--fab-size\)\s*\+\s*12px\)/);
  });

  it('.speed-dial-item uses flex-direction: row (label left, icon right)', () => {
    const body = ruleBody(styleCss, '.speed-dial-item');
    expect(body).toContain('flex-direction: row');
  });

  it('.speed-dial-item has min-height: var(--tap-min)', () => {
    const body = ruleBody(styleCss, '.speed-dial-item');
    expect(body).toContain('min-height: var(--tap-min)');
  });

  it('.speed-dial-item has cursor: pointer', () => {
    const body = ruleBody(styleCss, '.speed-dial-item');
    expect(body).toContain('cursor: pointer');
  });

  it('.speed-dial-label has no pointer-events: none', () => {
    const body = ruleBody(styleCss, '.speed-dial-label');
    expect(body).not.toContain('pointer-events: none');
  });

  it('no grid-template-rows or grid-auto-flow remnants', () => {
    const speedDialSection = styleCss.slice(
      styleCss.indexOf('Speed Dial FAB'),
      styleCss.indexOf('Tool Action Buttons'),
    );
    expect(speedDialSection).not.toContain('grid-template-rows');
    expect(speedDialSection).not.toContain('grid-auto-flow');
  });

  it('SpeedDial.tsx renders label before icon in JSX', () => {
    const tsx = readFileSync('src/components/trip/SpeedDial.tsx', 'utf-8');
    const labelIdx = tsx.indexOf('speed-dial-label');
    const iconIdx = tsx.indexOf('<Icon name={item.icon}');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(iconIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeLessThan(iconIdx);
  });

  it('FAB uses left-pointing arrow when closed', () => {
    const tsx = readFileSync('src/components/trip/SpeedDial.tsx', 'utf-8');
    // FAB_CLOSED should have path pointing left: M16 6l-8 6 8 6z
    const closedMatch = tsx.match(/FAB_CLOSED[\s\S]*?<path d="([^"]+)"/);
    expect(closedMatch).not.toBeNull();
    expect(closedMatch[1]).toContain('M16');
  });
});

/* ===== R4-6: Download Sheet flex-wrap ===== */

describe('R4-6 Download Sheet flex-wrap', () => {
  it('.download-sheet-options uses flex-wrap: wrap', () => {
    const body = ruleBody(styleCss, '.download-sheet-options');
    expect(body).toContain('flex-wrap: wrap');
  });

  it('.download-sheet-options has border-top separator', () => {
    const body = ruleBody(styleCss, '.download-sheet-options');
    expect(body).toContain('border-top');
  });

  it('.download-sheet-options has justify-content: center', () => {
    const body = ruleBody(styleCss, '.download-sheet-options');
    expect(body).toContain('justify-content: center');
  });

  it('.download-option has min-width for wrapping', () => {
    const body = ruleBody(styleCss, '.download-option');
    expect(body).toMatch(/min-width:\s*\d+px/);
  });

  it('no border-right on .download-option', () => {
    const body = ruleBody(styleCss, '.download-option');
    expect(body).not.toContain('border-right');
  });
});

/* ===== R4-7: Bottom Sheet fixed 85dvh ===== */

describe('R4-7 Bottom Sheet fixed height', () => {
  it('.info-sheet-panel has height 85dvh or 85vh', () => {
    const body = ruleBody(styleCss, '.info-sheet-panel');
    expect(body).toMatch(/height:\s*85[dv]vh/);
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

  it('.nav-close-btn button is var(--tap-min)', () => {
    const body = ruleBody(sharedCss, '.nav-close-btn');
    expect(body).toContain('width: var(--tap-min)');
    expect(body).toContain('height: var(--tap-min)');
  });

  it('.sheet-close-btn button is var(--tap-min)', () => {
    const body = ruleBody(styleCss, '.sheet-close-btn');
    expect(body).toContain('width: var(--tap-min)');
    expect(body).toContain('height: var(--tap-min)');
  });
});

/* ===== R4-11: X button no circle outline ===== */

describe('R4-11 close button no circle outline', () => {
  it('.sheet-close-btn has outline: none and box-shadow: none by default', () => {
    const body = ruleBody(styleCss, '.sheet-close-btn');
    expect(body).toContain('outline: none');
    expect(body).toContain('box-shadow: none');
  });

  it('.sheet-close-btn:focus-visible restores ring', () => {
    const rules = rulesFor(styleCss, '.sheet-close-btn:focus-visible');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].body).toContain('box-shadow: var(--shadow-ring)');
  });
});

/* ===== R4-1: InfoPanel hotel + transport card padding ===== */

describe('R4-1 InfoPanel card padding', () => {
  it('.hotel-summary-card has spacing-3/spacing-4 padding', () => {
    const body = ruleBody(styleCss, '.hotel-summary-card');
    expect(body).toContain('padding: var(--spacing-3) var(--spacing-4)');
  });

  it('.transport-summary-card has spacing-3/spacing-4 padding', () => {
    const body = ruleBody(styleCss, '.transport-summary-card');
    expect(body).toContain('padding: var(--spacing-3) var(--spacing-4)');
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
