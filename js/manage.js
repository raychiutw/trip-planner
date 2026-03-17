/* ===== Manage Page — 行程請求 ===== */

(function() {
    'use strict';

    var manageMain = document.getElementById('manageMain');
    var tripSelect = document.getElementById('tripSelect');
    var currentTripId = null;

    /* ===== API Helper ===== */
    function apiFetch(path, opts) {
        return fetch('/api' + path, Object.assign({
            headers: { 'Content-Type': 'application/json' }
        }, opts || {}));
    }

    /* ===== Build Request Item HTML ===== */
    function buildRequestItemHtml(req) {
        var date = new Date(req.created_at + 'Z').toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        var stateClass = req.status === 'open' ? 'open' : 'closed';
        var badgeIcon = req.status === 'open' ? iconSpan('circle-dot') : iconSpan('check-circle');
        var badgeText = req.status === 'open' ? '處理中' : '已處理';
        var mode = req.mode === 'trip-plan' ? 'plan' : 'edit';
        var modeBadgeText = mode === 'plan' ? '問建議' : '改行程';

        var html = '<div class="request-item ' + stateClass + '">';
        html += '<div class="request-item-header">';
        html += '<span class="request-badge ' + stateClass + '">' + badgeIcon + badgeText + '</span>';
        html += '<span class="request-mode-badge mode-' + mode + '">' + escHtml(modeBadgeText) + '</span>';
        html += '<span class="request-item-title">' + escHtml(req.title) + '</span>';
        html += '</div>';
        if (req.body) {
            html += '<div class="request-item-body">' + escHtml(req.body) + '</div>';
        }
        html += '<div class="request-item-meta">#' + req.id + ' · ' + escHtml(date);
        if (req.submitted_by) {
            html += ' · ' + escHtml(req.submitted_by);
        }
        html += '</div>';
        if (req.reply) {
            html += '<div class="request-reply">' + sanitizeHtml(req.reply) + '</div>';
        }
        html += '</div>';
        return html;
    }

    /* ===== Render Requests ===== */
    function renderRequests(requests) {
        var container = document.getElementById('manageRequests');
        if (!container) return;
        var inner = document.querySelector('.chat-messages-inner');
        if (!requests || !requests.length) {
            container.innerHTML = '<div class="manage-empty">尚無請求紀錄</div>';
            if (inner) inner.classList.add('chat-messages-inner--centered');
            return;
        }
        if (inner) inner.classList.remove('chat-messages-inner--centered');
        var html = '<div class="request-list">';
        requests.forEach(function(req) {
            html += buildRequestItemHtml(req);
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /* ===== Load Requests for Trip ===== */
    function loadRequests(tripId) {
        currentTripId = tripId;
        var container = document.getElementById('manageRequests');
        if (!container) return;
        container.innerHTML = '<div class="manage-loading">載入中…</div>';

        apiFetch('/requests?tripId=' + encodeURIComponent(tripId))
            .then(function(r) {
                if (r.status === 403) throw new Error('你沒有此行程的權限');
                if (!r.ok) throw new Error('載入失敗');
                return r.json();
            })
            .then(function(requests) {
                renderRequests(requests);
            })
            .catch(function(err) {
                container.innerHTML = '<div class="manage-empty">' + escHtml(err.message) + '</div>';
            });
    }

    /* ===== Render Page ===== */
    function renderPage() {
        var html = '<div class="chat-container">';

        html += '<div class="chat-messages">';
        html += '<div class="chat-messages-inner">';
        html += '<div id="manageRequests"><div class="manage-loading">載入中…</div></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="manage-input-bar">';
        html += '<div class="manage-input-card">';
        html += '<textarea class="manage-textarea" id="manageText" maxlength="65536" placeholder="例如：&#10;· Day 3 午餐換成通堂拉麵&#10;· 刪除美麗海水族館，改去萬座毛&#10;· Day 5 下午加一個 AEON 購物" rows="1"></textarea>';
        html += '<div class="manage-input-toolbar">';
        html += '<div class="manage-mode-toggle" id="requestMode" data-value="trip-edit">';
        html += '<button class="manage-mode-pill selected" data-mode="trip-edit">改行程</button>';
        html += '<button class="manage-mode-pill" data-mode="trip-plan">問建議</button>';
        html += '</div>';
        html += '<div id="submitStatus"></div>';
        html += '<button class="manage-send-btn" id="submitBtn" disabled aria-label="送出">';
        html += '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5.83L6.41 10.41 5 9l7-7 7 7-1.41 1.41L13 5.83V20h-2V5.83z"/></svg>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
        manageMain.innerHTML = html;

        // textarea 事件
        var textarea = document.getElementById('manageText');
        var sendBtn = document.getElementById('submitBtn');

        function autoResize() {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }

        textarea.addEventListener('input', function() {
            sendBtn.disabled = textarea.value.trim().length === 0;
            autoResize();
        });

        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (textarea.value.trim().length > 0) {
                    e.preventDefault();
                    submitRequest();
                }
            }
        });

        sendBtn.addEventListener('click', function() {
            submitRequest();
        });

        // mode toggle
        var modeToggle = document.getElementById('requestMode');
        modeToggle.addEventListener('click', function(e) {
            var pill = e.target.closest('.manage-mode-pill');
            if (!pill || pill.classList.contains('selected')) return;
            modeToggle.querySelectorAll('.manage-mode-pill').forEach(function(p) { p.classList.remove('selected'); });
            pill.classList.add('selected');
            modeToggle.dataset.value = pill.dataset.mode;
        });
    }

    /* ===== Submit Request ===== */
    function submitRequest() {
        var textarea = document.getElementById('manageText');
        var text = textarea.value.trim();
        if (!text || !currentTripId) return;

        var btn = document.getElementById('submitBtn');
        var status = document.getElementById('submitStatus');
        btn.disabled = true;
        status.innerHTML = '';

        var mode = document.getElementById('requestMode');
        var modeLabel = mode ? mode.dataset.value : 'trip-edit';
        var title = text.substring(0, 50);

        apiFetch('/requests', {
            method: 'POST',
            body: JSON.stringify({
                tripId: currentTripId,
                mode: modeLabel,
                title: title,
                body: text
            })
        })
        .then(function(r) {
            if (r.status === 201) return r.json();
            if (r.status === 403) throw new Error('你沒有此行程的權限');
            throw new Error('送出失敗（' + r.status + '）');
        })
        .then(function(req) {
            status.innerHTML = '<div class="manage-status success">' + iconSpan('check-circle') + ' 已送出</div>';
            textarea.value = '';
            textarea.style.height = 'auto';
            btn.disabled = true;

            // 樂觀插入到列表頂部
            var container = document.getElementById('manageRequests');
            if (container) {
                var listEl = container.querySelector('.request-list');
                if (!listEl) {
                    container.innerHTML = '<div class="request-list">' + buildRequestItemHtml(req) + '</div>';
                } else {
                    listEl.insertAdjacentHTML('afterbegin', buildRequestItemHtml(req));
                }
                var inner = document.querySelector('.chat-messages-inner');
                if (inner) inner.classList.remove('chat-messages-inner--centered');
            }
        })
        .catch(function(err) {
            status.innerHTML = '<div class="manage-status error">' + iconSpan('x-circle') + ' ' + escHtml(err.message) + '</div>';
            btn.disabled = textarea.value.trim().length === 0;
        });
    }

    /* ===== Init ===== */
    function init() {
        // 載入有權限的行程
        apiFetch('/my-trips')
            .then(function(r) {
                if (r.status === 401) {
                    manageMain.innerHTML = '<div class="manage-no-permission" style="margin:40px var(--padding-h);">請先登入</div>';
                    return null;
                }
                if (!r.ok) throw new Error('載入失敗');
                return r.json();
            })
            .then(function(trips) {
                if (!trips) return;

                if (trips.length === 0) {
                    manageMain.innerHTML = '<div class="manage-no-permission" style="margin:40px var(--padding-h);">你目前沒有任何行程權限，請聯繫管理者</div>';
                    tripSelect.style.display = 'none';
                    return;
                }

                // 填充 dropdown — 用 API 取得 name 與 published 狀態
                fetch('/api/trips?all=1')
                    .then(function(r) { return r.json(); })
                    .catch(function() { return []; })
                    .then(function(allTrips) {
                        var tripMap = {};
                        allTrips.forEach(function(t) { tripMap[t.id || t.tripId] = t; });
                        // 只保留上架且有權限的行程
                        var filtered = trips.filter(function(t) {
                            var info = tripMap[t.tripId];
                            return !info || (info.published !== 0 && info.published !== false);
                        });
                        if (filtered.length === 0) {
                            manageMain.innerHTML = '<div class="manage-no-permission" style="margin:40px var(--padding-h);">目前沒有上架的行程</div>';
                            tripSelect.style.display = 'none';
                            return;
                        }
                        if (filtered.length === 1) {
                            tripSelect.style.display = 'none';
                            var navTitle = document.getElementById('navTitle');
                            var info1 = tripMap[filtered[0].tripId];
                            if (navTitle) navTitle.textContent = info1 ? info1.name : filtered[0].tripId;
                        } else {
                            filtered.forEach(function(t) {
                                var opt = document.createElement('option');
                                opt.value = t.tripId;
                                var info = tripMap[t.tripId];
                                opt.textContent = info ? info.name : t.tripId;
                                tripSelect.appendChild(opt);
                            });
                            tripSelect.addEventListener('change', function() {
                                loadRequests(tripSelect.value);
                            });
                        }
                        renderPage();
                        loadRequests(filtered[0].tripId);

                        var closeBtn = document.getElementById('navCloseBtn');
                        if (closeBtn) {
                            closeBtn.addEventListener('click', function() {
                                window.location.href = '../index.html';
                            });
                        }
                    });
            })
            .catch(function() {
                manageMain.innerHTML = '<div class="manage-empty" style="margin:40px var(--padding-h);">無法載入行程資料</div>';
            });
    }

    init();
})();
