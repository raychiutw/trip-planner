import { readFileSync, existsSync } from 'fs';
import { describe, it, expect } from 'vitest';

/* ───── file loading ───── */

function readFile(path) {
    if (!existsSync(path)) return '';
    return readFileSync(path, 'utf-8');
}

const JS_FILES = [
    'js/app.js', 'js/shared.js', 'js/icons.js',
    'js/setting.js', 'js/manage.js', 'js/admin.js', 'js/map-row.js',
].map(path => ({ path, content: readFile(path) })).filter(f => f.content);

// src/ TypeScript files (React migration)
const SRC_FILES = [
    'src/lib/mapRow.ts', 'src/lib/sanitize.ts', 'src/lib/constants.ts',
    'src/lib/formatUtils.ts', 'src/lib/localStorage.ts', 'src/lib/drivingStats.ts',
    'src/lib/weather.ts',
].map(path => ({ path, content: readFile(path) })).filter(f => f.content);

const CSS_FILES = [
    'css/shared.css', 'css/style.css',
    'css/setting.css', 'css/admin.css', 'css/manage.css',
    'css/map.css',
].map(path => ({ path, content: readFile(path) })).filter(f => f.content);

const HTML_FILES = [
    'index.html', 'setting.html', 'edit.html',
    'manage/index.html', 'admin/index.html',
].map(path => ({ path, content: readFile(path) })).filter(f => f.content);

/* ───── CSS helpers ───── */

/**
 * Extract all class selector tokens from CSS text.
 * Returns array of class name strings.
 * Skips tokens preceded by ':' (pseudo-class/element context).
 */
function extractClassNames(css) {
    const results = [];
    const re = /\.([a-zA-Z][\w-]*)/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        // Skip if the character immediately before '.' is ':'
        const preceding = m.index > 0 ? css[m.index - 1] : '';
        if (preceding === ':') continue;
        results.push(m[1]);
    }
    return results;
}

/**
 * Extract all CSS custom property names from declarations (--foo-bar: value).
 * Returns array of property name strings (without the leading --).
 */
function extractCustomProperties(css) {
    const results = [];
    const re = /--([\w-]+)\s*:/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        results.push(m[1]);
    }
    return results;
}

/* ───── 1. JS mutable state (UPPER_CASE vars that get reassigned) ───── */

describe('JS naming — mutable state', () => {

    // True constants: declared once with UPPER_CASE, never reassigned — OK
    const TRUE_CONSTANTS = new Set([
        'FIELD_MAP', 'JSON_FIELDS', 'TRANSPORT_TYPES', 'TRANSPORT_TYPE_ORDER',
        'ARROW_EXPAND', 'ARROW_COLLAPSE', 'DRIVING_WARN_MINUTES', 'DRIVING_WARN_LABEL',
        'MS_PER_DAY', 'SAFE_COLOR_RE', 'APPLE_SVG', 'DIAL_RENDERERS',
        'WMO', 'ICONS', 'EMOJI_ICON_MAP', 'LS_PREFIX', 'LS_TTL',
    ]);

    it('TRIP should be renamed to trip (camelCase mutable state)', () => {
        // Phase 3 complete: js/ legacy files no longer use 'var TRIP ='
        for (const { path, content } of JS_FILES) {
            const hasTripVarDecl = /\bvar\s+TRIP\s*=/.test(content);
            expect(hasTripVarDecl, `${path}: found 'var TRIP =' — rename to 'trip' (camelCase mutable state)`).toBe(false);
        }
    });

    it('CURRENT_TRIP_ID should be renamed to currentTripId', () => {
        // Phase 3 complete: js/ legacy files no longer use 'var CURRENT_TRIP_ID ='
        for (const { path, content } of JS_FILES) {
            const hasCTIVarDecl = /\bvar\s+CURRENT_TRIP_ID\s*=/.test(content);
            expect(hasCTIVarDecl, `${path}: found 'var CURRENT_TRIP_ID =' — rename to 'currentTripId'`).toBe(false);
        }
    });

    it('new UPPER_CASE vars not in whitelist must not be reassigned', () => {
        // Guards against introducing NEW mutable state with UPPER_CASE naming.
        // Whitelisted names (existing true constants) are exempt.
        // Note: src/ TypeScript files use 'const' not 'var', so the var-based
        // regex will not match them — no false positives.
        const violations = [];

        for (const { path, content } of [...JS_FILES, ...SRC_FILES]) {
            const declRe = /\bvar\s+([A-Z][A-Z0-9_]+)\s*=/g;
            let m;
            while ((m = declRe.exec(content)) !== null) {
                const varName = m[1];
                if (TRUE_CONSTANTS.has(varName)) continue;

                // Count occurrences of `VARNAME =` (any assignment, including declaration)
                const reassignRe = new RegExp(`\\b${varName}\\s*=[^=]`, 'g');
                let count = 0;
                while (reassignRe.exec(content) !== null) {
                    count++;
                }
                // More than one assignment means it's reassigned after declaration
                if (count > 1) {
                    violations.push(`${path}: '${varName}' declared UPPER_CASE but gets reassigned — use camelCase for mutable state`);
                }
            }
        }

        expect(violations, `Mutable state with UPPER_CASE naming:\n${violations.join('\n')}`).toEqual([]);
    });

});

/* ───── 2. No defensive tripId fallback (.id || .tripId) ───── */

describe('JS naming — no defensive tripId fallback', () => {

    it('No .id || .tripId fallback patterns', () => {
        // Phase 2 complete: API returns tripId consistently, all defensive fallbacks removed.
        const violations = [];

        for (const { path, content } of [...JS_FILES, ...SRC_FILES]) {
            const re = /\.id\s*\|\|\s*\w+\.tripId/g;
            let m;
            while ((m = re.exec(content)) !== null) {
                violations.push(`${path}: found '${m[0]}' — remove defensive fallback`);
            }
        }

        expect(violations, `Defensive .id || .tripId fallbacks:\n${violations.join('\n')}`).toEqual([]);
    });

});

/* ───── 3. CSS class names: kebab-case ───── */

describe('CSS naming — class names kebab-case', () => {

    it('CSS class names should be kebab-case', () => {
        const violations = [];
        // Valid: starts with lowercase, only lowercase letters, digits, hyphens (single or double for BEM)
        const validKebab = /^[a-z][a-z0-9]*(-{1,2}[a-z0-9]+)*$/;

        for (const { path, content } of CSS_FILES) {
            const classes = extractClassNames(content);
            const seen = new Set();
            for (const cls of classes) {
                if (seen.has(cls)) continue;
                seen.add(cls);
                if (!validKebab.test(cls)) {
                    violations.push(`${path}: class '.${cls}' is not kebab-case`);
                }
            }
        }

        expect(violations, `CSS class names not in kebab-case:\n${violations.join('\n')}`).toEqual([]);
    });

});

/* ───── 4. CSS custom properties: --kebab-case ───── */

describe('CSS naming — custom properties --kebab-case', () => {

    it('CSS custom properties should be --kebab-case (all lowercase with hyphens)', () => {
        const violations = [];
        // Valid: all lowercase letters, digits, and hyphens
        const validKebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

        for (const { path, content } of CSS_FILES) {
            const props = extractCustomProperties(content);
            const seen = new Set();
            for (const prop of props) {
                if (seen.has(prop)) continue;
                seen.add(prop);
                if (!validKebab.test(prop)) {
                    violations.push(`${path}: custom property '--${prop}' is not all-lowercase kebab-case`);
                }
            }
        }

        expect(violations, `CSS custom properties not in --kebab-case:\n${violations.join('\n')}`).toEqual([]);
    });

});

/* ───── 5. HTML element IDs: camelCase ───── */

describe('HTML naming — element IDs camelCase', () => {

    it('Static HTML element IDs should be camelCase', () => {
        const violations = [];
        // camelCase: starts with lowercase letter, only letters and digits
        const validCamelCase = /^[a-z][a-zA-Z0-9]*$/;
        const idRe = /\bid="([^"]+)"/g;

        for (const { path, content } of HTML_FILES) {
            let m;
            while ((m = idRe.exec(content)) !== null) {
                const id = m[1];
                // Dynamic IDs (JS-generated) use kebab-case per spec — skip those with hyphens
                if (id.includes('-')) continue;
                if (!validCamelCase.test(id)) {
                    violations.push(`${path}: id="${id}" is not camelCase`);
                }
            }
        }

        expect(violations, `HTML element IDs not in camelCase:\n${violations.join('\n')}`).toEqual([]);
    });

});

/* ───── 6. API trip identifier: uses tripId ───── */

describe('API naming — trip identifier uses tripId', () => {

    it('trips.ts SELECT should alias id AS tripId', () => {
        const content = readFile('functions/api/trips.ts');
        if (!content) return;

        expect(content, 'functions/api/trips.ts: SELECT should include "id AS tripId"')
            .toMatch(/SELECT[\s\S]*?\bid\s+AS\s+tripId\b/);
    });

    it('trips/[id].ts GET response should include tripId field', () => {
        const content = readFile('functions/api/trips/[id].ts');
        if (!content) return;

        // Either SELECT alias or explicit property assignment
        const hasTripIdAlias = /SELECT[\s\S]*?\bid\s+AS\s+tripId\b/.test(content);
        const hasTripIdAssign = /\.tripId\s*=/.test(content);

        expect(hasTripIdAlias || hasTripIdAssign,
            'functions/api/trips/[id].ts: GET response should include tripId (via SELECT alias or row.tripId assignment)'
        ).toBe(true);
    });

});
