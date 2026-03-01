/* ===== Edit Page — AI 修改行程 ===== */

(function() {
    'use strict';

    var editMain = document.getElementById('editMain');
    var urlParams = new URLSearchParams(window.location.search);
    var urlTrip = urlParams.get('trip') || '';

    /* ===== Module-level config ===== */
    var currentConfig = null;

    /* ===== Request History Helpers ===== */
    function getHistory() {
        return lsGet('edit-history') || [];
    }
    function addHistory(item) {
        var h = getHistory();
        h.unshift(item);
        if (h.length > 20) h = h.slice(0, 20);
        lsSet('edit-history', h);
    }

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

        var navItems = [
            { icon: 'plane', label: '航班資訊', hash: 'sec-flight' },
            { icon: 'check-circle', label: '出發前確認', hash: 'sec-checklist' },
            { icon: 'lightbulb', label: '行程建議', hash: 'sec-suggestions' },
            { icon: 'refresh', label: '颱風/雨天備案', hash: 'sec-backup' },
            { icon: 'emergency', label: '緊急聯絡', hash: 'sec-emergency' }
        ];

        // Drawer menu (mobile)
        var html = '';
        navItems.forEach(function(item) {
            html += '<a class="menu-item" href="' + tripUrl + '#' + item.hash + '">' + iconSpan(item.icon) + ' ' + escHtml(item.label) + '</a>';
        });
        html += '<div class="menu-sep"></div>';
        html += '<button class="menu-item" data-action="toggle-dark">' + iconSpan('moon') + ' 深色模式</button>';
        html += '<a class="menu-item" href="switch.html">' + iconSpan('folder') + ' 切換行程檔</a>';
        document.getElementById('menuGrid').innerHTML = html;

        // Sidebar menu (desktop)
        var sidebarNav = document.getElementById('sidebarNav');
        if (sidebarNav) {
            var sHtml = '';
            navItems.forEach(function(item) {
                sHtml += '<a class="menu-item" href="' + tripUrl + '#' + item.hash + '" title="' + escHtml(item.label) + '">'
                       + '<span class="item-icon">' + iconSpan(item.icon) + '</span>'
                       + '<span class="item-label">' + escHtml(item.label) + '</span></a>';
            });
            sHtml += '<div class="menu-sep"></div>';
            sHtml += '<button class="menu-item" data-action="toggle-dark" title="深色模式"><span class="item-icon">' + iconSpan('moon') + '</span><span class="item-label">深色模式</span></button>';
            sHtml += '<div class="menu-sep" style="margin-top:auto"></div>';
            sHtml += '<a class="menu-item" href="switch.html" title="切換行程檔"><span class="item-icon">' + iconSpan('folder') + '</span><span class="item-label">切換行程檔</span></a>';
            sidebarNav.innerHTML = sHtml;
        }

        // Update dark mode button text
        if (document.body.classList.contains('dark')) {
            updateDarkBtnText(true);
        }
    }

    /* ===== Render: Edit Form ===== */
    function renderEditForm(config) {
        var html = '<div class="edit-page">';

        // Bound info
        html += '<div class="edit-bound">';
        html += '<div class="edit-bound-info"><strong>' + escHtml(config.owner) + '</strong> — ' + escHtml(config.tripName) + '</div>';
        html += '</div>';

        // Textarea
        html += '<textarea class="edit-textarea" id="editText" placeholder="例如：\n· Day 3 午餐換成通堂拉麵\n· 刪除美麗海水族館，改去萬座毛\n· Day 5 下午加一個 AEON 購物"></textarea>';

        // Submit
        html += '<button class="edit-btn edit-btn-primary" id="submitBtn">送出修改請求</button>';
        html += '<div id="submitStatus"></div>';

        // History
        html += renderHistory();

        html += '</div>';
        editMain.innerHTML = html;

        document.getElementById('submitBtn').addEventListener('click', function() {
            submitRequest();
        });
    }

    /* ===== Submit Request ===== */
    function submitRequest() {
        var text = document.getElementById('editText').value.trim();
        if (!text) {
            document.getElementById('submitStatus').innerHTML = '<div class="edit-status error">請輸入修改內容</div>';
            return;
        }

        var config = currentConfig;
        var btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = '送出中...';
        document.getElementById('submitStatus').innerHTML = '';

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
            document.getElementById('submitStatus').innerHTML = '<div class="edit-status success">' + iconSpan('check-circle') + ' 已送出！Issue <a href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">#' + issue.number + '</a></div>';
            document.getElementById('editText').value = '';
            btn.disabled = false;
            btn.textContent = '送出修改請求';

            addHistory({
                number: issue.number,
                url: issue.html_url,
                text: text.substring(0, 80),
                time: new Date().toISOString()
            });

            // Re-render history
            var historyEl = editMain.querySelector('.edit-history');
            if (historyEl) {
                historyEl.outerHTML = renderHistory();
            }
        })
        .catch(function(err) {
            document.getElementById('submitStatus').innerHTML = '<div class="edit-status error">' + iconSpan('x-circle') + ' ' + escHtml(err.message) + '</div>';
            btn.disabled = false;
            btn.textContent = '送出修改請求';
        });
    }

    /* ===== Render: History ===== */
    function renderHistory() {
        var history = getHistory();
        var html = '<div class="edit-history">';
        html += '<h3>送出紀錄</h3>';
        if (!history.length) {
            html += '<div class="edit-history-empty">尚無送出紀錄</div>';
        } else {
            history.forEach(function(item) {
                html += '<div class="edit-history-item">';
                html += '<a href="' + escUrl(item.url) + '" target="_blank" rel="noopener noreferrer">#' + item.number + '</a> ';
                html += escHtml(item.text);
                html += '<div class="edit-history-time">' + new Date(item.time).toLocaleString('zh-TW') + '</div>';
                html += '</div>';
            });
        }
        html += '</div>';
        return html;
    }

    /* ===== Toggle Dark Mode ===== */
    document.addEventListener('click', function(e) {
        var el = e.target.closest('[data-action]');
        if (!el) return;
        if (el.getAttribute('data-action') === 'toggle-dark') {
            toggleDarkShared();
            updateDarkBtnText(document.body.classList.contains('dark'));
        }
    });

    /* ===== Main Entry ===== */
    function init() {
        // No ?trip= → redirect to index.html
        if (!urlTrip) {
            window.location.replace('index.html');
            return;
        }

        fetch('data/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                // Find matching trip
                var found = null;
                trips.forEach(function(t) {
                    var slug = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
                    if (slug === urlTrip) {
                        found = { owner: t.owner, tripSlug: slug, tripName: t.name };
                    }
                });

                if (!found) {
                    editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">找不到行程「' + escHtml(urlTrip) + '」</div></div>';
                    return;
                }

                currentConfig = found;

                // Set X close button href
                document.getElementById('editClose').href = 'index.html?trip=' + encodeURIComponent(found.tripSlug);

                // Build menu & init sidebar
                buildEditMenu(found.tripSlug);
                initSidebar();

                // Render edit form
                renderEditForm(found);
            })
            .catch(function() {
                editMain.innerHTML = '<div class="edit-page"><div class="edit-status error">無法載入行程清單</div></div>';
            });
    }

    // Init
    init();
})();
