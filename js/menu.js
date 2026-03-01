/* ===== Menu / Sidebar System ===== */
/* Depends on shared.js (lsGet, lsSet) */

/* ===== Desktop Detection ===== */
function isDesktop() { return !/Mobi|Android.*Mobile|iPhone|iPod|Opera Mini/i.test(navigator.userAgent); }

/* ===== Sidebar Init / Toggle ===== */
function initSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (lsGet('sidebar-collapsed') === '1') {
        sidebar.classList.add('collapsed');
    }
}

function toggleSidebar() {
    if (!isDesktop()) { toggleMenu(); return; }
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    lsSet('sidebar-collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
}

/* ===== Mobile Menu Close Helper ===== */
function closeMobileMenuIfOpen() {
    if (isDesktop()) return;
    var menu = document.getElementById('menuDrop');
    var backdrop = document.getElementById('menuBackdrop');
    if (menu && menu.classList.contains('open')) {
        menu.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
    }
}

/* ===== Dark Mode Button Text ===== */
function updateDarkBtnText(isDark) {
    var btns = document.querySelectorAll('[data-action="toggle-dark"]');
    btns.forEach(function(btn) {
        var label = btn.querySelector('.item-label');
        if (label) {
            btn.querySelector('.item-icon').textContent = isDark ? '☀️' : '🌙';
            label.textContent = isDark ? '淺色模式' : '深色模式';
            btn.setAttribute('title', isDark ? '淺色模式' : '深色模式');
        } else {
            btn.textContent = isDark ? '☀️ 淺色模式' : '🌙 深色模式';
        }
    });
}

/* ===== Toggle Menu (mobile drawer) ===== */
function toggleMenu() {
    var menu = document.getElementById('menuDrop');
    var backdrop = document.getElementById('menuBackdrop');
    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
    } else {
        menu.classList.add('open');
        backdrop.classList.add('open');
        document.body.classList.add('menu-open');
        document.body.style.overflow = 'hidden';
    }
}

/* ===== Swipe Gesture for Menu ===== */
var _swipeStartX = 0, _swipeStartY = 0;
document.addEventListener('touchstart', function(e) {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', function(e) {
    if (isDesktop()) return;
    var dx = e.changedTouches[0].clientX - _swipeStartX;
    var dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    var isOpen = document.body.classList.contains('menu-open');
    if (dx > 0 && !isOpen && _swipeStartX < 40) toggleMenu();
    else if (dx < 0 && isOpen) toggleMenu();
}, { passive: true });

/* ===== Backdrop + Menu Toggle Click Delegation ===== */
document.addEventListener('click', function(e) {
    var t = e.target;
    if (t.id === 'menuBackdrop') { toggleMenu(); return; }
    var actionEl = t.closest('[data-action]');
    if (actionEl) {
        var action = actionEl.getAttribute('data-action');
        if (action === 'toggle-menu') { e.stopPropagation(); toggleMenu(); }
        else if (action === 'toggle-sidebar') { e.stopPropagation(); toggleSidebar(); }
    }
});

/* ===== Resize: close mobile drawer on desktop switch ===== */
window.addEventListener('resize', function() {
    if (isDesktop()) {
        var menu = document.getElementById('menuDrop');
        var backdrop = document.getElementById('menuBackdrop');
        if (menu && menu.classList.contains('open')) {
            menu.classList.remove('open');
            backdrop.classList.remove('open');
            document.body.classList.remove('menu-open');
            document.body.style.overflow = '';
        }
    }
});

/* ===== Init ===== */
initSidebar();

/* ===== Module Exports (Node.js / Vitest only) ===== */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isDesktop: isDesktop,
        initSidebar: initSidebar,
        toggleSidebar: toggleSidebar,
        closeMobileMenuIfOpen: closeMobileMenuIfOpen,
        updateDarkBtnText: updateDarkBtnText,
        toggleMenu: toggleMenu
    };
}
