import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

/**
 * CSS Selector DOM Validation
 *
 * Verifies that descendant selectors in page-specific CSS files
 * actually match the DOM structure in the corresponding HTML.
 */

// Setting page deleted in SPA migration — CSS selector tests no longer applicable
const PAGES = [];

function extractRules(css) {
    const rules = [];
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
        rules.push({ selector: m[1].trim(), body: m[2].trim() });
    }
    return rules;
}

function getStaticClasses(doc) {
    const classes = new Set();
    doc.querySelectorAll('[class]').forEach(el => {
        el.classList.forEach(c => classes.add('.' + c));
    });
    return classes;
}

describe('CSS selector DOM validation', () => {
    it('SPA migration: setting.css and setting.html removed', () => {
        // setting page was deleted in SPA migration — no page-specific CSS to validate
        expect(PAGES).toHaveLength(0);
    });

    PAGES.forEach(({ css, html }) => {
        it(`descendant selectors in ${css} match ${html} DOM`, () => {
            const cssContent = readFileSync(css, 'utf-8');
            const htmlContent = readFileSync(html, 'utf-8');
            const dom = new JSDOM(htmlContent);
            const doc = dom.window.document;
            const staticClasses = getStaticClasses(doc);

            const rules = extractRules(cssContent);
            const broken = [];

            for (const { selector } of rules) {
                // Skip @media, dark mode overrides
                if (selector.startsWith('@') || selector.includes('body.dark')) continue;

                // Split comma-separated selectors
                const subs = selector.split(',').map(s => s.trim());

                for (const sub of subs) {
                    // Clean: remove pseudo-elements and pseudo-classes
                    const clean = sub
                        .replace(/::[\w-]+(\([^)]*\))?/g, '')
                        .replace(/:[\w-]+(\([^)]*\))?/g, '')
                        .trim();

                    // Only check descendant selectors (have space = multiple parts)
                    if (!clean || !clean.includes(' ')) continue;

                    // Extract class selectors from the target (last part)
                    const parts = clean.split(/\s+/);
                    const target = parts[parts.length - 1];
                    const targetClasses = target.match(/\.[\w-]+/g) || [];

                    // Only validate if the target element exists in static HTML
                    const targetInStatic = targetClasses.some(c => staticClasses.has(c));
                    if (!targetInStatic) continue;

                    try {
                        const match = doc.querySelector(clean);
                        if (!match) {
                            broken.push(sub);
                        }
                    } catch (e) {
                        // Invalid selector for querySelector, skip
                    }
                }
            }

            if (broken.length > 0) {
                expect.fail(
                    `CSS selectors in ${css} don't match DOM in ${html}:\n` +
                    broken.map(s => `  ✗ ${s}`).join('\n')
                );
            }
        });
    });
});
