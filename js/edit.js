/* ===== Edit Page — AI 修改行程 ===== */

(function() {
    'use strict';

    var editMain = document.getElementById('editMain');
    var urlParams = new URLSearchParams(window.location.search);
    var urlTrip = urlParams.get('trip') || '';

    /* ===== Config Helpers ===== */
    function getEditConfig() {
        return lsGet('edit-config');
    }
    function saveEditConfig(config) {
        lsSet('edit-config', config);
    }
    function clearEditConfig() {
        lsRemove('edit-config');
    }

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
    function ghFetch(path, opts) {
        var config = getEditConfig();
        if (!config || !config.token) return Promise.reject(new Error('未設定 Token'));
        var url = 'https://api.github.com' + path;
        var headers = {
            'Authorization': 'Bearer ' + config.token,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
        };
        return fetch(url, Object.assign({ headers: headers }, opts || {}));
    }

    /* ===== Render: Setup Flow ===== */
    function renderSetup() {
        editMain.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray);">載入行程清單...</div>';

        fetch('data/trips.json')
            .then(function(r) { return r.json(); })
            .then(function(trips) {
                renderTripSelection(trips);
            })
            .catch(function() {
                editMain.innerHTML = '<div class="edit-status error">無法載入行程清單</div>';
            });
    }

    function renderTripSelection(trips) {
        var html = '<div class="setup-step">';
        html += '<h3>選擇你的行程</h3>';
        html += '<p>請選擇你要編輯的行程：</p>';
        html += '<div class="setup-trip-list">';
        trips.forEach(function(t) {
            var slug = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
            html += '<button class="trip-btn" data-slug="' + escHtml(slug) + '" data-name="' + escHtml(t.name) + '" data-owner="' + escHtml(t.owner) + '">';
            html += '<strong>' + escHtml(t.name) + '</strong>';
            html += '<span class="trip-sub">' + escHtml(t.dates) + ' · ' + escHtml(t.owner) + '</span>';
            html += '</button>';
        });
        html += '</div></div>';
        editMain.innerHTML = html;

        editMain.querySelectorAll('.trip-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var slug = btn.getAttribute('data-slug');
                var name = btn.getAttribute('data-name');
                var owner = btn.getAttribute('data-owner');
                renderTokenInput(slug, name, owner);
            });
        });
    }

    function renderTokenInput(tripSlug, tripName, owner) {
        var html = '<div class="setup-step">';
        html += '<h3>設定 Token</h3>';
        html += '<p>請向 Ray 索取專屬 Token。此 Token 只能建立修改請求，無法修改任何網站檔案。</p>';
        html += '<div class="setup-input-group">';
        html += '<label>GitHub Personal Access Token</label>';
        html += '<input type="password" class="setup-input" id="tokenInput" placeholder="ghp_xxxxxxxxxxxx" autocomplete="off">';
        html += '</div>';
        html += '<button class="edit-btn edit-btn-primary" id="verifyBtn">驗證並儲存</button>';
        html += '<button class="edit-btn edit-btn-secondary" id="backBtn">← 重新選擇</button>';
        html += '<div id="tokenStatus"></div>';
        html += '</div>';
        editMain.innerHTML = html;

        document.getElementById('backBtn').addEventListener('click', function() {
            renderSetup();
        });

        document.getElementById('verifyBtn').addEventListener('click', function() {
            var token = document.getElementById('tokenInput').value.trim();
            if (!token) {
                document.getElementById('tokenStatus').innerHTML = '<div class="edit-status error">請輸入 Token</div>';
                return;
            }
            var btn = document.getElementById('verifyBtn');
            btn.disabled = true;
            btn.textContent = '驗證中...';

            fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO, {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/vnd.github+json'
                }
            })
            .then(function(r) {
                if (r.ok) {
                    saveEditConfig({
                        token: token,
                        owner: owner,
                        tripSlug: tripSlug,
                        tripName: tripName
                    });
                    checkAndRender();
                } else {
                    document.getElementById('tokenStatus').innerHTML = '<div class="edit-status error">Token 驗證失敗（' + r.status + '）。請確認 Token 是否正確。</div>';
                    btn.disabled = false;
                    btn.textContent = '驗證並儲存';
                }
            })
            .catch(function() {
                document.getElementById('tokenStatus').innerHTML = '<div class="edit-status error">網路錯誤，請稍後再試。</div>';
                btn.disabled = false;
                btn.textContent = '驗證並儲存';
            });
        });
    }

    /* ===== Render: Forbidden ===== */
    function renderForbidden(config) {
        var html = '<div class="edit-forbidden">';
        html += '<div class="edit-forbidden-icon">⛔</div>';
        html += '<h3>此行程屬於其他人</h3>';
        html += '<p>你只能編輯《' + escHtml(config.tripName) + '》</p>';
        html += '<a href="index.html?trip=' + encodeURIComponent(config.tripSlug) + '" class="edit-btn edit-btn-primary" style="display:inline-block;width:auto;padding:12px 24px;text-decoration:none;">前往我的行程</a>';
        html += '</div>';
        editMain.innerHTML = html;
    }

    /* ===== Render: Edit Form ===== */
    function renderEditForm(config) {
        var html = '';

        // Bound info
        html += '<div class="edit-bound">';
        html += '<div class="edit-bound-info"><strong>' + escHtml(config.owner) + '</strong> — ' + escHtml(config.tripName) + '</div>';
        html += '<button class="edit-gear" id="gearBtn" title="重新設定">⚙️</button>';
        html += '</div>';

        // Textarea
        html += '<textarea class="edit-textarea" id="editText" placeholder="例如：\n· Day 3 午餐換成通堂拉麵\n· 刪除美麗海水族館，改去萬座毛\n· Day 5 下午加一個 AEON 購物"></textarea>';

        // Submit
        html += '<button class="edit-btn edit-btn-primary" id="submitBtn">送出修改請求</button>';
        html += '<div id="submitStatus"></div>';

        // History
        html += renderHistory();

        editMain.innerHTML = html;

        document.getElementById('gearBtn').addEventListener('click', function() {
            clearEditConfig();
            renderSetup();
        });

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

        var config = getEditConfig();
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
            document.getElementById('submitStatus').innerHTML = '<div class="edit-status success">✅ 已送出！Issue <a href="' + escUrl(issue.html_url) + '" target="_blank" rel="noopener noreferrer">#' + issue.number + '</a></div>';
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
            document.getElementById('submitStatus').innerHTML = '<div class="edit-status error">❌ ' + escHtml(err.message) + '</div>';
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

    /* ===== Main Entry ===== */
    function checkAndRender() {
        var config = getEditConfig();

        if (!config) {
            renderSetup();
            return;
        }

        // Ownership check
        if (urlTrip && config.tripSlug !== urlTrip) {
            renderForbidden(config);
            return;
        }

        renderEditForm(config);
    }

    // Init
    checkAndRender();
})();
