/* ===== Admin Page — 權限管理 ===== */

(function() {
    'use strict';

    var tripSelect = document.getElementById('tripSelect');
    var permissionList = document.getElementById('permissionList');
    var emailInput = document.getElementById('emailInput');
    var addBtn = document.getElementById('addBtn');
    var addStatus = document.getElementById('addStatus');
    var currentTripId = '';

    /* ===== API Helper ===== */
    function apiFetch(path, opts) {
        return fetch('/api' + path, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, opts || {}));
    }

    /* ===== Load Trip List from trips.json ===== */
    function loadTrips() {
        fetch('../data/dist/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                tripSelect.innerHTML = '<option value="">-- 選擇行程 --</option>';
                trips.forEach(function(t) {
                    var opt = document.createElement('option');
                    opt.value = t.tripId;
                    var label = t.name || t.tripId;
                    if (t.published === false) label = '(已下架) ' + label;
                    opt.textContent = label;
                    tripSelect.appendChild(opt);
                });
            })
            .catch(function() {
                tripSelect.innerHTML = '<option value="">無法載入行程</option>';
            });
    }

    /* ===== Load Permissions ===== */
    function loadPermissions(tripId) {
        currentTripId = tripId;
        if (!tripId) {
            permissionList.innerHTML = '<div class="admin-empty">請先選擇行程</div>';
            return;
        }

        permissionList.innerHTML = '<div class="admin-empty">載入中…</div>';

        apiFetch('/permissions?tripId=' + encodeURIComponent(tripId))
            .then(function(r) {
                if (r.status === 403) throw new Error('僅管理者可操作');
                if (!r.ok) throw new Error('載入失敗');
                return r.json();
            })
            .then(function(perms) {
                if (!perms || !perms.length) {
                    permissionList.innerHTML = '<div class="admin-empty">尚未授權任何成員</div>';
                    return;
                }

                var html = '<div class="admin-permission-list">';
                perms.forEach(function(p) {
                    html += '<div class="admin-permission-item" data-id="' + p.id + '">';
                    html += '<span class="admin-permission-email">' + escHtml(p.email) + '</span>';
                    html += '<span class="admin-permission-role">' + escHtml(p.role) + '</span>';
                    html += '<button class="admin-remove-btn" data-id="' + p.id + '" data-email="' + escHtml(p.email) + '" aria-label="移除">';
                    html += '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
                    html += '</button>';
                    html += '</div>';
                });
                html += '</div>';
                permissionList.innerHTML = html;
            })
            .catch(function(err) {
                permissionList.innerHTML = '<div class="admin-empty">' + escHtml(err.message) + '</div>';
            });
    }

    /* ===== Add Permission ===== */
    function addPermission() {
        var email = emailInput.value.trim().toLowerCase();
        if (!email || !currentTripId) return;

        addBtn.disabled = true;
        addStatus.innerHTML = '';

        apiFetch('/permissions', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                tripId: currentTripId,
                role: 'member'
            })
        })
        .then(function(r) {
            if (r.status === 201) return r.json();
            if (r.status === 409) throw new Error('此 email 已有權限');
            if (r.status === 403) throw new Error('僅管理者可操作');
            return r.json().then(function(data) {
                throw new Error(data.error || '新增失敗');
            });
        })
        .then(function() {
            addStatus.innerHTML = '<div class="admin-status success">已新增 ' + escHtml(email) + '</div>';
            emailInput.value = '';
            loadPermissions(currentTripId);
        })
        .catch(function(err) {
            addStatus.innerHTML = '<div class="admin-status error">' + escHtml(err.message) + '</div>';
        })
        .finally(function() {
            addBtn.disabled = false;
        });
    }

    /* ===== Remove Permission ===== */
    function removePermission(id, email) {
        if (!confirm('確定移除 ' + email + ' 的權限？')) return;

        apiFetch('/permissions/' + id, { method: 'DELETE' })
            .then(function(r) {
                if (!r.ok) throw new Error('移除失敗');
                loadPermissions(currentTripId);
            })
            .catch(function(err) {
                alert(err.message);
            });
    }

    /* ===== Event Listeners ===== */
    tripSelect.addEventListener('change', function() {
        addStatus.innerHTML = '';
        loadPermissions(tripSelect.value);
    });

    addBtn.addEventListener('click', addPermission);
    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addPermission();
    });

    permissionList.addEventListener('click', function(e) {
        var btn = e.target.closest('.admin-remove-btn');
        if (!btn) return;
        removePermission(btn.dataset.id, btn.dataset.email);
    });

    var closeBtn = document.getElementById('navCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            window.location.href = '../index.html';
        });
    }

    /* ===== Init ===== */
    loadTrips();
})();
