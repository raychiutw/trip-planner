/* ===== Setting Page ===== */

(function() {
    'use strict';

    /* ===== Render Trip List ===== */
    function renderTripList(trips, currentSlug) {
        var container = document.getElementById('tripList');
        if (!container) return;
        var html = '';
        trips.forEach(function(t) {
            var slug = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
            var isActive = slug === currentSlug;
            html += '<button class="trip-btn' + (isActive ? ' active' : '') + '" data-slug="' + escHtml(slug) + '">';
            html += '<strong>' + escHtml(t.name) + '</strong>';
            html += '<span class="trip-sub">' + escHtml(t.dates) + ' · ' + escHtml(t.owner) + '</span>';
            html += '</button>';
        });
        container.innerHTML = html;

        container.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-slug]');
            if (!btn) return;
            var slug = btn.getAttribute('data-slug');
            lsSet('trip-pref', slug);
            window.location.href = 'index.html';
        });
    }

    /* ===== Color Mode ===== */
    function applyColorMode(mode) {
        if (mode === 'dark') {
            document.body.classList.add('dark');
        } else if (mode === 'light') {
            document.body.classList.remove('dark');
        } else {
            // auto
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        }
        // update theme-color meta
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', document.body.classList.contains('dark') ? '#7D4A36' : '#C4704F');
        }
    }

    function renderColorMode(currentMode) {
        var grid = document.getElementById('colorModeGrid');
        if (!grid) return;

        var modes = [
            { key: 'light', label: '淺色', desc: 'Light' },
            { key: 'auto',  label: '自動', desc: 'Auto' },
            { key: 'dark',  label: '深色', desc: 'Dark' }
        ];

        var html = '';
        modes.forEach(function(m) {
            var isActive = m.key === currentMode;
            html += '<button class="color-mode-card' + (isActive ? ' active' : '') + '" data-mode="' + m.key + '">';
            html += '<div class="color-mode-preview color-mode-' + m.key + '">';
            html += '<div class="cmp-top"></div>';
            html += '<div class="cmp-bottom"><div class="cmp-input"></div><div class="cmp-dot"></div></div>';
            html += '</div>';
            html += '<div class="color-mode-label">' + escHtml(m.label) + '</div>';
            html += '<div class="color-mode-desc">' + escHtml(m.desc) + '</div>';
            html += '</button>';
        });
        grid.innerHTML = html;

        grid.addEventListener('click', function(e) {
            var card = e.target.closest('[data-mode]');
            if (!card) return;
            var mode = card.getAttribute('data-mode');
            lsSet('color-mode', mode);
            applyColorMode(mode);
            grid.querySelectorAll('.color-mode-card').forEach(function(c) {
                c.classList.toggle('active', c.getAttribute('data-mode') === mode);
            });
        });
    }

    /* ===== Init Color Mode from localStorage ===== */
    function initColorMode() {
        var saved = lsGet('color-mode');
        if (saved === 'light' || saved === 'dark' || saved === 'auto') {
            applyColorMode(saved);
            return saved;
        }
        // 舊版相容：讀取 dark 標記
        if (lsGet('dark') === '1') {
            return 'dark';
        }
        return 'auto';
    }

    /* ===== Main Entry ===== */
    function init() {
        // X close button → back to index
        var closeBtn = document.getElementById('navCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                window.location.href = 'index.html';
            });
        }

        var colorMode = initColorMode();

        fetch('data/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                var currentSlug = lsGet('trip-pref') || '';
                if (!currentSlug && trips.length > 0) {
                    currentSlug = trips[0].file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
                }
                renderTripList(trips, currentSlug);
                renderColorMode(colorMode);
            })
            .catch(function() {
                var container = document.getElementById('tripList');
                if (container) container.innerHTML = '<div style="color:var(--gray);padding:16px">無法載入行程清單</div>';
                renderColorMode(colorMode);
            });
    }

    init();
})();
