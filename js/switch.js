(function() {
    'use strict';
    var main = document.getElementById('switchMain');

    fetch('data/trips.json')
        .then(function(r) { return r.json(); })
        .then(function(trips) {
            var html = '<div class="switch-list">';
            trips.forEach(function(t) {
                var slug = t.file.replace(/^data\/trips\//, '').replace(/\.json$/, '');
                html += '<a href="index.html?trip=' + encodeURIComponent(slug) + '" class="trip-btn">';
                html += '<strong>' + escHtml(t.name) + '</strong>';
                html += '<span class="trip-sub">' + escHtml(t.dates) + ' · ' + escHtml(t.owner) + '</span>';
                html += '</a>';
            });
            html += '</div>';
            main.innerHTML = html;
        })
        .catch(function() {
            main.innerHTML = '<div class="switch-error">無法載入行程清單</div>';
        });
})();
