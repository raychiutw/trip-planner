import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/* ───── helpers ───── */

const CSS_FILES = {
    shared: readFileSync('css/shared.css', 'utf-8'),
    style:  readFileSync('css/style.css',  'utf-8'),
    map:    readFileSync('css/map.css',    'utf-8'),
};
const ALL_CSS = Object.values(CSS_FILES).join('\n');

/**
 * Strip token definition blocks (single source of truth); we only lint usage sites.
 * Handles: :root { … }, @theme { … }, @layer base { nested… }, body.theme-* { … }
 */
function stripTokenBlocks(css) {
    let result = css
        .replace(/@theme\s*\{[^}]*\}/g, '');
    // Robust @layer base removal: brace-depth counting to handle any nesting
    const layerRe = /@layer\s+base\s*\{/g;
    let m;
    while ((m = layerRe.exec(result)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        while (i < result.length && depth > 0) {
            if (result[i] === '{') depth++;
            else if (result[i] === '}') depth--;
            i++;
        }
        result = result.slice(0, m.index) + result.slice(i);
        layerRe.lastIndex = m.index;
    }
    return result
        .replace(/:root\s*\{[^}]*\}/g, '')
        .replace(/body\.theme-[\w.-]*\s*\{[^}]*\}/g, '')
        .replace(/body\.dark\s*\{[^}]*\}/g, '');
}

/**
 * Strip @media print { … } and .print-mode … rules.
 * Print has its own requirements and is excluded from HIG lint.
 */
function stripPrintBlocks(css) {
    // @media print { … } (handles nested braces one level deep)
    let result = css.replace(/@media\s+print\s*\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/g, '');
    // .print-mode … { … }
    result = result.replace(/\.print-mode[^{]*\{[^}]*\}/g, '');
    // .print-exit-btn … { … }
    result = result.replace(/\.print-exit-btn[^{]*\{[^}]*\}/g, '');
    return result;
}

/**
 * Extract all CSS rule blocks as { selector, body } pairs.
 * Simplistic but sufficient for single-depth rules.
 */
function extractRules(css) {
    const rules = [];
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        rules.push({ selector: m[1].trim(), body: m[2].trim() });
    }
    return rules;
}

/**
 * Extract px values from a CSS property value string.
 * Returns an array of numbers. Skips var(), calc(), %, em, rem, vw, vh, dvh, etc.
 */
function extractPxValues(value) {
    const nums = [];
    // Match number followed by px (not inside a var() or other function)
    const re = /(?<!\w)([\d.]+)px/g;
    let m;
    while ((m = re.exec(value)) !== null) {
        nums.push(parseFloat(m[1]));
    }
    return nums;
}

/* ───── tests ───── */

describe('CSS HIG Compliance', () => {

    describe('Token discipline', () => {

        it('no hardcoded transition durations outside :root', () => {
            const cleaned = stripTokenBlocks(ALL_CSS);
            const rules = extractRules(cleaned);
            const violations = [];

            for (const { selector, body } of rules) {
                // Find transition properties
                const transMatch = body.match(/transition\s*:[^;]*/g);
                if (!transMatch) continue;
                for (const t of transMatch) {
                    // Check for hardcoded durations like 0.2s, 150ms, etc.
                    if (/\d+(\.\d+)?(s|ms)/.test(t) && !/var\(--duration/.test(t)) {
                        // Allow 0s (instant, e.g. visibility 0s)
                        if (/\b0s\b/.test(t) && !/[1-9]\d*(\.\d+)?s/.test(t) && !/\d+ms/.test(t)) continue;
                        violations.push(`${selector}: ${t.trim()}`);
                    }
                }
            }

            expect(violations, `Hardcoded transition durations found:\n${violations.join('\n')}`).toEqual([]);
        });

        it('no hardcoded #fff in accent/interactive contexts', () => {
            const cleaned = stripTokenBlocks(stripPrintBlocks(ALL_CSS));
            const rules = extractRules(cleaned);
            const violations = [];

            // Brand contexts that legitimately use #fff
            const brandSelectors = ['.g-icon', '.n-icon', '.cmp-'];

            for (const { selector, body } of rules) {
                if (brandSelectors.some(b => selector.includes(b))) continue;
                // Check for color: #fff or #FFF or #ffffff
                if (/color\s*:\s*#(?:fff|FFF|ffffff)\b/.test(body)) {
                    violations.push(`${selector}: color: #fff`);
                }
            }

            expect(violations, `Hardcoded #fff found:\n${violations.join('\n')}`).toEqual([]);
        });

        it('font-size only uses var(--font-size-*) tokens', () => {
            const cleaned = stripTokenBlocks(stripPrintBlocks(ALL_CSS));
            const rules = extractRules(cleaned);
            const violations = [];

            for (const { selector, body } of rules) {
                const fsMatch = body.match(/font-size\s*:\s*([^;]*)/g);
                if (!fsMatch) continue;
                for (const fs of fsMatch) {
                    const value = fs.replace(/font-size\s*:\s*/, '').trim();
                    // Allowed: var(--font-size-*), em, rem, %, inherit, initial, unset
                    if (/var\(--font-size-/.test(value)) continue;
                    if (/^\d+(\.\d+)?(em|rem|%)$/.test(value)) continue;
                    if (/^(inherit|initial|unset)$/.test(value)) continue;
                    violations.push(`${selector}: font-size: ${value}`);
                }
            }

            expect(violations, `Hardcoded font-size found:\n${violations.join('\n')}`).toEqual([]);
        });
    });

    describe('4pt grid', () => {

        // Selectors/properties to exclude from 4pt grid checking
        const GRID_EXCEPTIONS = [
            // Decorative elements
            { selector: /scrollbar/, reason: 'scrollbar decorative' },
            { selector: /\.sheet-handle/, reason: 'sheet handle decorative' },
            { selector: /\.cmp-/, reason: 'color mode preview decorative' },
            { selector: /\.ov-card h4::before/, reason: 'decorative dot' },
            { selector: /::before|::after/, reason: 'pseudo-element decorative' },
            { selector: /@page/, reason: 'print page margin' },
            // Border widths are not layout spacing
        ];

        function isExcepted(selector) {
            return GRID_EXCEPTIONS.some(e => e.selector.test(selector));
        }

        /**
         * Check spacing properties for 4pt grid compliance.
         * Returns array of violation strings.
         */
        function checkSpacingGrid(css, properties) {
            const cleaned = stripTokenBlocks(stripPrintBlocks(css));
            const rules = extractRules(cleaned);
            const violations = [];

            for (const { selector, body } of rules) {
                if (isExcepted(selector)) continue;

                for (const prop of properties) {
                    // Match the property and its value
                    const re = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]*)`, 'g');
                    let m;
                    while ((m = re.exec(body)) !== null) {
                        const value = m[1].trim();
                        // Skip if it uses var() or calc() or relative units
                        if (/var\(/.test(value)) continue;
                        if (/calc\(/.test(value)) continue;

                        const pxValues = extractPxValues(value);
                        for (const px of pxValues) {
                            if (px === 0) continue;
                            if (px % 4 !== 0) {
                                violations.push(`${selector} { ${prop}: ${value} } — ${px}px is not on 4pt grid`);
                            }
                        }
                    }
                }
            }
            return violations;
        }

        it('padding values are multiples of 4', () => {
            const violations = checkSpacingGrid(ALL_CSS, [
                'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            ]);
            expect(violations, `Padding off 4pt grid:\n${violations.join('\n')}`).toEqual([]);
        });

        it('margin values are multiples of 4', () => {
            const violations = checkSpacingGrid(ALL_CSS, [
                'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            ]);
            expect(violations, `Margin off 4pt grid:\n${violations.join('\n')}`).toEqual([]);
        });

        it('gap values are multiples of 4', () => {
            const violations = checkSpacingGrid(ALL_CSS, ['gap', 'row-gap', 'column-gap']);
            expect(violations, `Gap off 4pt grid:\n${violations.join('\n')}`).toEqual([]);
        });
    });

    describe('Visual consistency', () => {

        it('.sticky-nav has no solid var(--color-background) or rgba() background', () => {
            const cleaned = stripPrintBlocks(ALL_CSS);
            const rules = extractRules(cleaned);
            const violations = [];

            for (const { selector, body } of rules) {
                if (!selector.includes('sticky-nav')) continue;
                // Check for background: var(--bg) (solid, not color-mix)
                if (/background\s*:\s*var\(--color-background\)/.test(body)) {
                    violations.push(`${selector}: background: var(--color-background) [should use color-mix or inherit frosted glass]`);
                }
                // Check for rgba( background
                if (/background\s*:\s*rgba\(/.test(body)) {
                    violations.push(`${selector}: rgba() background [should use color-mix]`);
                }
            }

            expect(violations, `Sticky-nav background violations:\n${violations.join('\n')}`).toEqual([]);
        });

        it('color mode preview uses var(--cmp-*) tokens', () => {
            const settingCSS = CSS_FILES.setting;
            const rules = extractRules(settingCSS);
            const violations = [];

            const previewSelectors = ['.color-mode-light', '.color-mode-dark', '.color-mode-auto'];
            const hardcodedPreviewColors = ['#F5F5F5', '#FFFFFF', '#E0E0E0', '#1A1816', '#292624', '#3D3A37'];

            for (const { selector, body } of rules) {
                if (!previewSelectors.some(s => selector.includes(s))) continue;
                for (const hex of hardcodedPreviewColors) {
                    if (body.includes(hex)) {
                        violations.push(`${selector}: contains hardcoded ${hex} [should use var(--cmp-*)]`);
                    }
                }
            }

            expect(violations, `Preview hardcoded colors:\n${violations.join('\n')}`).toEqual([]);
        });

        it('focus-visible with outline:none also has box-shadow', () => {
            const cleaned = stripPrintBlocks(ALL_CSS);
            const rules = extractRules(cleaned);
            const violations = [];

            // Form inputs (textarea, input) use text cursor as focus indicator
            const formInputSelectors = ['textarea', 'input', '.edit-textarea'];

            for (const { selector, body } of rules) {
                if (!selector.includes(':focus-visible')) continue;
                if (formInputSelectors.some(f => selector.includes(f))) continue;
                if (/outline\s*:\s*none/.test(body) && !/box-shadow/.test(body)) {
                    violations.push(`${selector}: outline: none without box-shadow replacement`);
                }
            }

            expect(violations, `Focus-visible missing box-shadow:\n${violations.join('\n')}`).toEqual([]);
        });

        it('backdrop/overlay selectors use var(--overlay) not hardcoded rgba', () => {
            const cleaned = stripTokenBlocks(stripPrintBlocks(ALL_CSS));
            const rules = extractRules(cleaned);
            const violations = [];

            const backdropSelectors = ['backdrop', 'overlay'];

            for (const { selector, body } of rules) {
                if (!backdropSelectors.some(b => selector.toLowerCase().includes(b))) continue;
                if (/background\s*:\s*rgba\(0\s*,\s*0\s*,\s*0/.test(body)) {
                    violations.push(`${selector}: hardcoded rgba(0,0,0,...) [should use var(--overlay)]`);
                }
            }

            expect(violations, `Backdrop hardcoded rgba:\n${violations.join('\n')}`).toEqual([]);
        });

        it('pseudo-element margin/padding on 4pt grid', () => {
            const cleaned = stripTokenBlocks(stripPrintBlocks(ALL_CSS));
            const rules = extractRules(cleaned);
            const violations = [];
            const spacingProps = [
                'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            ];

            // Decorative pseudo-elements to skip
            const pseudoExceptions = [/\.ov-card h4::before/, /\.cmp-/, /scrollbar/, /@page/];

            for (const { selector, body } of rules) {
                if (!(/::before|::after/.test(selector))) continue;
                if (pseudoExceptions.some(e => e.test(selector))) continue;

                for (const prop of spacingProps) {
                    const re = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]*)`, 'g');
                    let m;
                    while ((m = re.exec(body)) !== null) {
                        const value = m[1].trim();
                        if (/var\(/.test(value)) continue;
                        if (/calc\(/.test(value)) continue;

                        const pxValues = extractPxValues(value);
                        for (const px of pxValues) {
                            if (px === 0) continue;
                            if (px % 4 !== 0) {
                                violations.push(`${selector} { ${prop}: ${value} } — ${px}px is not on 4pt grid`);
                            }
                        }
                    }
                }
            }

            expect(violations, `Pseudo-element spacing off 4pt grid:\n${violations.join('\n')}`).toEqual([]);
        });

        it('.color-mode-card.active uses var(--shadow-ring)', () => {
            const settingCSS = CSS_FILES.setting;
            const rules = extractRules(settingCSS);

            for (const { selector, body } of rules) {
                if (selector.includes('.color-mode-card.active')) {
                    expect(body).toContain('var(--shadow-ring)');
                    expect(body).not.toMatch(/box-shadow\s*:\s*0\s+0\s+0\s+\d+px/);
                }
            }
        });

        it('.dh-nav base style does not use justify-content: center', () => {
            const styleCSS = CSS_FILES.style;
            // Strip @media blocks to get only base-level rules
            const baseCSS = styleCSS.replace(/@media[^{]*\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/g, '');
            const rules = extractRules(baseCSS);
            const violations = [];

            for (const { selector, body } of rules) {
                if (!/\.dh-nav\b/.test(selector)) continue;
                if (/justify-content\s*:\s*center/.test(body)) {
                    violations.push(`${selector}: justify-content: center (causes overflow-x left clipping on mobile)`);
                }
            }

            expect(violations, `dh-nav base center violations:\n${violations.join('\n')}`).toEqual([]);
        });
    });
});
