import { describe, it, expect, beforeEach, vi } from 'vitest';

const app = require('../../js/app.js');

beforeEach(() => {
    localStorage.clear();
    document.getElementById('tripContent').innerHTML = '';
    // Reset URL params
    var url = new URL(window.location);
    url.searchParams.delete('trip');
    history.replaceState(null, '', url);
});

/* ===== 4.2 loadTrip 失敗時清除 trip-pref 並顯示訊息 ===== */
describe('loadTrip failure', () => {
    it('clears trip-pref and shows error message with setting link on fetch failure', async () => {
        // Set a trip-pref
        lsSet('trip-pref', 'nonexistent-trip');

        // Mock fetch to fail
        var originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });

        app.loadTrip('nonexistent-trip');

        // Wait for async fetch to resolve
        await new Promise(r => setTimeout(r, 50));

        // trip-pref should be cleared
        expect(lsGet('trip-pref')).toBeNull();

        // Error message should be shown
        var content = document.getElementById('tripContent').innerHTML;
        expect(content).toContain('trip-error');
        expect(content).toContain('行程不存在');
        expect(content).toContain('setting.html');
        expect(content).toContain('trip-error-link');

        globalThis.fetch = originalFetch;
    });
});

/* ===== 4.3 resolveAndLoad 無 trip-pref 時顯示選擇行程訊息 ===== */
describe('resolveAndLoad without trip-pref', () => {
    it('shows select-trip message when no URL param and no trip-pref', () => {
        // Ensure no trip-pref
        lsRemove('trip-pref');

        app.resolveAndLoad();

        var content = document.getElementById('tripContent').innerHTML;
        expect(content).toContain('trip-error');
        expect(content).toContain('請選擇行程');
        expect(content).toContain('setting.html');
        expect(content).toContain('trip-error-link');
    });

    it('calls loadTrip when URL has ?trip= param', async () => {
        var url = new URL(window.location);
        url.searchParams.set('trip', 'test-trip');
        history.replaceState(null, '', url);

        var originalFetch = globalThis.fetch;
        var fetchUrls = [];
        globalThis.fetch = (url) => {
            fetchUrls.push(url);
            if (url.includes('trips.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ tripId: 'test-trip', published: true }]) });
            }
            return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        };

        app.resolveAndLoad();
        await new Promise(r => setTimeout(r, 50));

        expect(fetchUrls.some(u => u.includes('trips.json'))).toBe(true);
        globalThis.fetch = originalFetch;
    });

    it('calls loadTrip when localStorage has trip-pref', async () => {
        lsSet('trip-pref', 'saved-trip');

        var originalFetch = globalThis.fetch;
        var fetchUrls = [];
        globalThis.fetch = (url) => {
            fetchUrls.push(url);
            if (url.includes('trips.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ tripId: 'saved-trip', published: true }]) });
            }
            return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        };

        app.resolveAndLoad();
        await new Promise(r => setTimeout(r, 50));

        expect(fetchUrls.some(u => u.includes('trips.json'))).toBe(true);
        expect(fetchUrls.some(u => u.includes('saved-trip'))).toBe(true);
        globalThis.fetch = originalFetch;
    });
});
