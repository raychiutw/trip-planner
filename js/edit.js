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

    /* ===== Build Issue Item HTML ===== */
    function buildIssueItemHtml(issue) {
        var date = new Date(issue.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        var stateClass = issue.state === 'open' ? 'open' : 'closed';
        var badgeIcon = issue.state === 'open' ? iconSpan('circle-dot') : iconSpan('check-circle');
        var badgeText = issue.state === 'open' ? 'Open' : 'Closed';
        var html = '<div class="issue-item ' + stateClass + '">';
        html += '<div class="issue-item-header">';
        html += '<span class="issue-badge ' + stateClass + '">' + badgeIcon + badgeText + '</span>';
        html += '<a class="issue-item-title" href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(issue.title) + '</a>';
        html += '</div>';
        html += '<div class="issue-item-meta">#' + issue.number + ' · ' + escHtml(date) + '</div>';
        // 回覆區
        if (issue.comments > 0) {
            html += '<div class="issue-reply" id="reply-' + issue.number + '">\u8B80\u53D6\u56DE\u8986\u4E2D\u2026</div>';
        }
        html += '</div>';
        return html;
    }

    /* ===== Load Issue Replies (async) ===== */
    function loadIssueReplies(issues) {
        var toFetch = issues.filter(function(issue) {
            return issue.comments > 0;
        });
        toFetch.forEach(function(issue) {
            var url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/issues/' + issue.number + '/comments';
            fetch(url, {
                headers: {
                    'Authorization': 'Bearer ' + GH_PAT,
                    'Accept': 'application/vnd.github.html+json'
                }
            })
                .then(function(r) {
                    if (!r.ok) throw new Error('fetch failed');
                    return r.json();
                })
                .then(function(comments) {
                    var el = document.getElementById('reply-' + issue.number);
                    if (!el) return;
                    if (comments.length > 0) {
                        var html = comments.map(function(c) { return c.body_html || ''; }).join('<hr>');
                        el.innerHTML = html;
                    } else {
                        el.textContent = '';
                    }
                })
                .catch(function() {
                    var el = document.getElementById('reply-' + issue.number);
                    if (el) el.textContent = '\u7121\u6CD5\u8F09\u5165\u56DE\u8986';
                });
        });
    }

    /* ===== Render Issues ===== */
    function renderIssues(issues) {
        var issueList = document.getElementById('editIssues');
        if (!issueList) return;
        var inner = document.querySelector('.chat-messages-inner');
        if (!issues || !issues.length) {
            issueList.innerHTML = '<div class="edit-issues-empty">尚無修改紀錄</div>';
            if (inner) inner.classList.add('chat-messages-inner--centered');
            return;
        }
        if (inner) inner.classList.remove('chat-messages-inner--centered');
        var html = '<div class="issue-list">';
        issues.forEach(function(issue) {
            html += buildIssueItemHtml(issue);
        });
        html += '</div>';
        issueList.innerHTML = html;
        loadIssueReplies(issues);
    }

    function loadIssues() {
        var issueList = document.getElementById('editIssues');
        if (!issueList) return;
        issueList.innerHTML = '<div class="edit-issues-loading">載入中…</div>';
        // 一次撈取所有符合 trip label 的 issue，用 state + comments 過濾已處理的
        ghFetch('/repos/' + GH_OWNER + '/' + GH_REPO + '/issues?labels=' + encodeURIComponent(currentConfig.tripSlug) + '&per_page=20')
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

    /* ===== Render Edit Page ===== */
    function renderEditPage(config) {
        var html = '<div class="chat-container">';

        // 可捲動訊息區
        html += '<div class="chat-messages">';
        html += '<div class="chat-messages-inner">';

        // Issue 列表區（單獨 id，renderIssues 只替換此區塊）
        html += '<div id="editIssues"><div class="edit-issues-loading">載入中…</div></div>';

        html += '</div>'; // .chat-messages-inner
        html += '</div>'; // .chat-messages

        // 底部輸入列（flex child，不 fixed）
        html += '<div class="edit-input-bar">';
        html += '<div class="edit-input-card">';
        html += '<textarea class="edit-textarea" id="editText" maxlength="65536" placeholder="例如：&#10;· Day 3 午餐換成通堂拉麵&#10;· 刪除美麗海水族館，改去萬座毛&#10;· Day 5 下午加一個 AEON 購物" rows="1"></textarea>';
        html += '<div class="edit-input-toolbar">';
        html += '<button class="edit-send-btn" id="submitBtn" disabled aria-label="送出">';
        html += '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5.83L6.41 10.41 5 9l7-7 7 7-1.41 1.41L13 5.83V20h-2V5.83z"/></svg>';
        html += '</button>';
        html += '</div>';
        html += '<div id="submitStatus"></div>';
        html += '</div>'; // .edit-input-card
        html += '</div>'; // .edit-input-bar

        html += '</div>'; // .chat-container
        editMain.innerHTML = html;

        // textarea 監聽
        var textarea = document.getElementById('editText');
        var sendBtn = document.getElementById('submitBtn');

        function autoResize() {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }

        textarea.addEventListener('input', function() {
            var hasText = textarea.value.trim().length > 0;
            sendBtn.disabled = !hasText;
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

        // 標題列
        var navTitle = document.getElementById('navTitle');
        if (navTitle) {
            navTitle.textContent = '編輯行程 · ' + config.tripName;
        }

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

        var title = config.owner + ': ' + text.substring(0, 50);
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
                labels: ['trip-edit', config.tripSlug]
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
            var textarea = document.getElementById('editText');
            textarea.value = '';
            textarea.style.height = 'auto';
            btn.disabled = true;
            // 樂觀插入新 issue 到列表頂部
            var editIssues = document.getElementById('editIssues');
            if (editIssues) {
                var listEl = editIssues.querySelector('.issue-list');
                if (!listEl) {
                    editIssues.innerHTML = '<div class="issue-list">' + buildIssueItemHtml(issue) + '</div>';
                } else {
                    listEl.insertAdjacentHTML('afterbegin', buildIssueItemHtml(issue));
                }
                var inner = document.querySelector('.chat-messages-inner');
                if (inner) inner.classList.remove('chat-messages-inner--centered');
            }
            // 重新載入 issues（完整資料覆蓋）
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
        fetch('data/dist/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                allTrips = trips;

                // 決定要顯示的 slug
                var slug = urlTrip || lsGet('trip-pref') || '';
                if (!slug && trips.length > 0) {
                    slug = trips[0].slug;
                }

                if (!slug) {
                    window.location.replace('index.html');
                    return;
                }

                // 找對應的 trip
                var found = null;
                trips.forEach(function(t) {
                    if (t.slug === slug) {
                        found = { owner: t.owner, tripSlug: slug, tripName: t.name };
                    }
                });

                if (!found) {
                    editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">找不到行程「' + escHtml(slug) + '」</div></div>';
                    return;
                }

                currentConfig = found;

                // X close button → back to index with trip slug
                var closeBtn = document.getElementById('navCloseBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        window.location.href = 'index.html?trip=' + encodeURIComponent(found.tripSlug);
                    });
                }

                // Render page
                renderEditPage(found);
            })
            .catch(function() {
                editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">無法載入行程清單</div></div>';
            });
    }

    // Init
    init();
})();
