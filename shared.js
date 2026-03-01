/* ===== Shared Utility Functions ===== */

/* ===== HTML Escape ===== */
function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== URL Safe Validation ===== */
function escUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    if (/^(https?:|tel:)/i.test(s)) return s;
    return '';
}

/* ===== Sanitize HTML (strip scripts/iframes/on*) ===== */
function sanitizeHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,form').forEach(function(el) { el.remove(); });
    doc.querySelectorAll('*').forEach(function(el) {
        Array.from(el.attributes).forEach(function(attr) {
            if (attr.name.indexOf('on') === 0) el.removeAttribute(attr.name);
            if (attr.name === 'href' || attr.name === 'src' || attr.name === 'action') {
                var val = (attr.value || '').trim().toLowerCase();
                if (val && !/^(https?:|tel:|mailto:|#)/.test(val)) el.removeAttribute(attr.name);
            }
        });
        if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
            el.setAttribute('rel', 'noopener noreferrer');
        }
    });
    return doc.body.innerHTML;
}

/* ===== Strip Inline Handlers ===== */
function stripInlineHandlers(html) {
    return html.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
}

/* ===== LocalStorage Helper (trip-planner- prefix, 6-month expiry) ===== */
var LS_PREFIX = 'trip-planner-';
var LS_TTL = 180 * 86400000; // 6 months

function lsSet(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ v: value, exp: Date.now() + LS_TTL }));
}
function lsGet(key) {
    try {
        var d = JSON.parse(localStorage.getItem(LS_PREFIX + key));
        if (d && d.exp > Date.now()) return d.v;
        localStorage.removeItem(LS_PREFIX + key);
        return null;
    } catch(e) { return null; }
}
function lsRemove(key) {
    localStorage.removeItem(LS_PREFIX + key);
}
function lsRenewAll() {
    var newExp = Date.now() + LS_TTL;
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(LS_PREFIX) === 0) {
            try {
                var d = JSON.parse(localStorage.getItem(k));
                if (d && d.exp) { d.exp = newExp; localStorage.setItem(k, JSON.stringify(d)); }
            } catch(e) {}
        }
    }
}

/* ===== Dark Mode Toggle ===== */
function toggleDarkShared() {
    document.body.classList.toggle('dark');
    var isDark = document.body.classList.contains('dark');
    lsSet('dark', isDark ? '1' : '0');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#7D4A36' : '#C4704F');
    return isDark;
}

/* ===== Init Dark Mode from localStorage ===== */
if (lsGet('dark') === '1') {
    document.body.classList.add('dark');
    var _dmeta = document.querySelector('meta[name="theme-color"]');
    if (_dmeta) _dmeta.setAttribute('content', '#7D4A36');
}

/* ===== GitHub Repo Constants ===== */
var GH_OWNER = 'raychiutw';
var GH_REPO = 'trip-planner';

/* ===== Module Exports (Node.js / Vitest only) ===== */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escHtml: escHtml,
        escUrl: escUrl,
        sanitizeHtml: sanitizeHtml,
        stripInlineHandlers: stripInlineHandlers,
        LS_PREFIX: LS_PREFIX,
        LS_TTL: LS_TTL,
        lsSet: lsSet,
        lsGet: lsGet,
        lsRemove: lsRemove,
        lsRenewAll: lsRenewAll,
        toggleDarkShared: toggleDarkShared,
        GH_OWNER: GH_OWNER,
        GH_REPO: GH_REPO
    };
}
