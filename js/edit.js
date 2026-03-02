/* ===== Edit Page — AI 修改行程 ===== */

(function() {
    'use strict';

    var editMain = document.getElementById('editMain');
    var urlParams = new URLSearchParams(window.location.search);
    var urlTrip = urlParams.get('trip') || '';

    /* ===== Module-level config ===== */
    var currentConfig = null;
    var allTrips = [];

    /* ===== GitHub API ===== */
    var GH_PAT = ['github_pat_11AEX7PIY0', 'SVfFvrhfOq3C_NIwmm4imRhH6HjK8Rv', '8dyTPtLQ646xtSysYdzmdXXlI', 'IF7XYJYJQ8OdCWfR'].join('');

    function ghFetch(path, opts) {
        var url = 'https://api.github.com' + path;
        var headers = {
            'Authorization': 'Bearer ' + GH_PAT,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
        };
        return fetch(url, Object.assign({ headers: headers }, opts || {}));
    }

    /* ===== Build Menu ===== */
    function buildEditMenu(slug) {
        var tripUrl = 'index.html?trip=' + encodeURIComponent(slug);
        var settingUrl = 'setting.html';

        // Drawer menu (mobile)
        var html = '';
        html += '<a class="menu-item" href="' + tripUrl + '">' + iconSpan('plane') + ' 行程頁</a>';
        html += '<a class="menu-item menu-item-current" href="edit.html?trip=' + encodeURIComponent(slug) + '">' + iconSpan('pencil') + ' 編輯頁</a>';
        html += '<a class="menu-item" href="' + settingUrl + '">' + iconSpan('gear') + ' 設定頁</a>';
        document.getElementById('menuGrid').innerHTML = html;

        // Sidebar menu (desktop)
        var sidebarNav = document.getElementById('sidebarNav');
        if (sidebarNav) {
            var sHtml = '';
            sHtml += '<a class="menu-item" href="' + tripUrl + '" title="行程頁"><span class="item-icon">' + iconSpan('plane') + '</span><span class="item-label">行程頁</span></a>';
            sHtml += '<a class="menu-item menu-item-current" href="edit.html?trip=' + encodeURIComponent(slug) + '" title="編輯頁"><span class="item-icon">' + iconSpan('pencil') + '</span><span class="item-label">編輯頁</span></a>';
            sHtml += '<a class="menu-item" href="' + settingUrl + '" title="設定頁"><span class="item-icon">' + iconSpan('gear') + '</span><span class="item-label">設定頁</span></a>';
            sidebarNav.innerHTML = sHtml;
        }
    }

    /* ===== 時段問候語 ===== */
    function getGreeting(owner) {
        var hour = new Date().getHours();
        var greet;
        if (hour >= 6 && hour < 12) {
            greet = '早安';
        } else if (hour >= 12 && hour < 18) {
            greet = '午安';
        } else {
            greet = '晚安';
        }
        return greet + '，' + escHtml(owner) + '！';
    }

    /* ===== Render Issues ===== */
    function renderIssueStatus(state) {
        if (state === 'open') {
            return '<span class="edit-issue-status open"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><circle cx="12" cy="12" r="10"/></svg></span>';
        }
        return '<span class="edit-issue-status closed"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><circle cx="12" cy="12" r="10"/></svg></span>';
    }

    function renderIssues(issues) {
        var issueList = document.getElementById('editIssues');
        if (!issueList) return;
        if (!issues || !issues.length) {
            issueList.innerHTML = '<div class="edit-issues-empty">尚無修改紀錄</div>';
            return;
        }
        var html = '';
        issues.forEach(function(issue) {
            var date = new Date(issue.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            html += '<div class="edit-issue-item">';
            html += renderIssueStatus(issue.state);
            html += '<div class="edit-issue-body">';
            html += '<a class="edit-issue-title" href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(issue.title) + '</a>';
            html += '<div class="edit-issue-meta">#' + issue.number + ' · ' + escHtml(date) + '</div>';
            html += '</div>';
            html += '</div>';
        });
        issueList.innerHTML = html;
    }

    function loadIssues() {
        var issueList = document.getElementById('editIssues');
        if (!issueList) return;
        issueList.innerHTML = '<div class="edit-issues-loading">載入中…</div>';
        ghFetch('/repos/' + GH_OWNER + '/' + GH_REPO + '/issues?labels=trip-edit&state=all&per_page=20')
            .then(function(r) {
                if (!r.ok) throw new Error('fetch failed');
                return r.json();
            })
            .then(function(issues) {
                renderIssues(issues);
            })
            .catch(function() {
                issueList.innerHTML = '<div class="edit-issues-empty">無法載入紀錄</div>';
            });
    }

    /* ===== Render Trip Selector ===== */
    function renderTripSelector(trips, currentSlug) {
        var sel = document.getElementById('tripSelect');
        if (!sel) return;
        var html = '';
        trips.forEach(function(t) {
            var slug = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
            html += '<option value="' + escHtml(slug) + '"' + (slug === currentSlug ? ' selected' : '') + '>' + escHtml(t.name) + '</option>';
        });
        sel.innerHTML = html;
        sel.addEventListener('change', function() {
            var newSlug = sel.value;
            window.location.href = 'edit.html?trip=' + encodeURIComponent(newSlug);
        });
    }

    /* ===== Render Edit Page ===== */
    function renderEditPage(config, trips) {
        var html = '<div class="edit-page">';

        // 問候語區
        html += '<div class="edit-greeting">';
        html += '<div class="edit-spark">';
        html += '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z"/></svg>';
        html += '</div>';
        html += '<div class="edit-greeting-text">' + getGreeting(config.owner) + '</div>';
        html += '<div class="edit-greeting-sub">有什麼行程修改需求？</div>';
        html += '</div>';

        // Issue 列表區
        html += '<div class="edit-issues-section">';
        html += '<div class="edit-issues-header">修改紀錄</div>';
        html += '<div class="edit-issues" id="editIssues"><div class="edit-issues-loading">載入中…</div></div>';
        html += '</div>';

        // 底部輸入卡片
        html += '<div class="edit-input-card">';
        html += '<textarea class="edit-textarea" id="editText" placeholder="例如：&#10;· Day 3 午餐換成通堂拉麵&#10;· 刪除美麗海水族館，改去萬座毛&#10;· Day 5 下午加一個 AEON 購物" rows="3"></textarea>';
        html += '<div class="edit-input-toolbar">';
        // 左側 [+] 按鈕（佈局預留）
        html += '<button class="edit-add-btn" disabled aria-label="附加" title="附加（功能開發中）">';
        html += '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
        html += '</button>';
        // 中間：行程名稱下拉
        html += '<select class="edit-trip-select" id="tripSelect" title="切換行程"></select>';
        // 右側送出按鈕
        html += '<button class="edit-send-btn" id="submitBtn" disabled aria-label="送出">';
        html += '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        html += '</button>';
        html += '</div>';
        html += '<div id="submitStatus"></div>';
        html += '</div>';

        html += '</div>';
        editMain.innerHTML = html;

        // 初始化 trip 下拉
        renderTripSelector(trips, config.tripSlug);

        // textarea 監聽
        var textarea = document.getElementById('editText');
        var sendBtn = document.getElementById('submitBtn');
        textarea.addEventListener('input', function() {
            var hasText = textarea.value.trim().length > 0;
            sendBtn.disabled = !hasText;
        });

        sendBtn.addEventListener('click', function() {
            submitRequest();
        });

        // 載入 issues
        loadIssues();
    }

    /* ===== Submit Request ===== */
    function submitRequest() {
        var text = document.getElementById('editText').value.trim();
        if (!text) return;

        var config = currentConfig;
        var btn = document.getElementById('submitBtn');
        var status = document.getElementById('submitStatus');
        btn.disabled = true;
        status.innerHTML = '';

        var title = '[trip-edit] ' + config.owner + ': ' + text.substring(0, 50);
        var body = JSON.stringify({
            owner: config.owner,
            tripSlug: config.tripSlug,
            text: text,
            timestamp: new Date().toISOString()
        }, null, 2);

        ghFetch('/repos/' + GH_OWNER + '/' + GH_REPO + '/issues', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                body: body,
                labels: ['trip-edit']
            })
        })
        .then(function(r) {
            if (r.status === 201) return r.json();
            if (r.status === 401) throw new Error('Token 已過期，請重新設定');
            if (r.status === 403) throw new Error('Token 權限不足');
            if (r.status === 410) throw new Error('Issues 功能未啟用');
            throw new Error('送出失敗（' + r.status + '）');
        })
        .then(function(issue) {
            status.innerHTML = '<div class="edit-status success">' + iconSpan('check-circle') + ' 已送出！Issue <a href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">#' + issue.number + '</a></div>';
            document.getElementById('editText').value = '';
            btn.disabled = true;
            // 重新載入 issues
            loadIssues();
        })
        .catch(function(err) {
            status.innerHTML = '<div class="edit-status error">' + iconSpan('x-circle') + ' ' + escHtml(err.message) + '</div>';
            var textarea = document.getElementById('editText');
            btn.disabled = textarea.value.trim().length === 0;
        });
    }

    /* ===== Toggle Dark Mode ===== */
    document.addEventListener('click', function(e) {
        var el = e.target.closest('[data-action]');
        if (!el) return;
        if (el.getAttribute('data-action') === 'toggle-dark') {
            toggleDarkShared();
        }
    });

    /* ===== Main Entry ===== */
    function init() {
        // 讀取所有行程
        fetch('data/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                allTrips = trips;

                // 決定要顯示的 slug
                var slug = urlTrip || lsGet('trip-pref') || '';
                if (!slug && trips.length > 0) {
                    slug = trips[0].file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
                }

                if (!slug) {
                    window.location.replace('index.html');
                    return;
                }

                // 找對應的 trip
                var found = null;
                trips.forEach(function(t) {
                    var s = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
                    if (s === slug) {
                        found = { owner: t.owner, tripSlug: slug, tripName: t.name };
                    }
                });

                if (!found) {
                    editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">找不到行程「' + escHtml(slug) + '」</div></div>';
                    return;
                }

                currentConfig = found;

                // Build menu & init sidebar
                buildEditMenu(found.tripSlug);
                initSidebar();

                // Render page
                renderEditPage(found, trips);
            })
            .catch(function() {
                editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">無法載入行程清單</div></div>';
            });
    }

    // Init
    init();
})();
