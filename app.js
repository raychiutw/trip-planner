/* ===== Utility ===== */
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

/* ===== Apple SVG Icon ===== */
var APPLE_SVG = '<svg viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';

/* ===== Render: Map Links ===== */
function renderMapLinks(loc, inline) {
    var cls = inline ? 'map-link map-link-inline' : 'map-link';
    var html = '';
    var gq = escUrl(loc.googleQuery || loc.url || '') || ('https://maps.google.com/?q=' + encodeURIComponent(loc.name || ''));
    if (!/^https?:/i.test(gq)) gq = 'https://maps.google.com/?q=' + encodeURIComponent(loc.name || '');
    html += '<a href="' + escUrl(gq) + '" target="_blank" rel="noopener noreferrer" class="' + cls + '">'
          + '<span class="g-icon">G</span> Map</a>';
    var aq = escUrl(loc.appleQuery || '') || ('https://maps.apple.com/?q=' + encodeURIComponent(loc.name || ''));
    if (!/^https?:/i.test(aq)) aq = 'https://maps.apple.com/?q=' + encodeURIComponent(loc.name || '');
    html += '<a href="' + escUrl(aq) + '" target="_blank" rel="noopener noreferrer" class="' + cls + ' apple">'
          + '<span class="apple-icon">' + APPLE_SVG + '</span> Map</a>';
    if (loc.mapcode) {
        html += '<span class="' + cls + ' mapcode">📟 ' + escHtml(loc.mapcode) + '</span>';
    }
    return html;
}

/* ===== Render: Nav Links ===== */
function renderNavLinks(locations) {
    if (!locations || !locations.length) return '';
    var html = '<div class="nav-links">';
    locations.forEach(function(loc) {
        if (loc.label) html += '<strong>' + escHtml(loc.label) + '：</strong>';
        html += renderMapLinks(loc, true);
    });
    html += '</div>';
    return html;
}

/* ===== Render: Restaurant ===== */
function renderRestaurant(r) {
    var html = '<div class="restaurant-choice">';
    var nameHtml = escHtml(r.name);
    var rUrl = escUrl(r.url);
    if (rUrl) nameHtml = '<a href="' + rUrl + '" target="_blank" rel="noopener noreferrer">' + nameHtml + '</a>';
    html += (r.emoji ? r.emoji + ' ' : '')
          + (r.category ? '<strong>' + escHtml(r.category) + '：</strong>' : '')
          + nameHtml;
    if (r.desc) html += ' — ' + escHtml(r.desc);
    if (r.price) html += '，' + escHtml(r.price);
    html += '<br>';
    if (r.location) html += renderMapLinks(r.location, true);
    var meta = '';
    if (r.hours) meta += '⏰ ' + escHtml(r.hours);
    if (r.reservation) {
        if (meta) meta += ' ｜ ';
        var resUrl = escUrl(r.reservationUrl);
        if (resUrl) {
            meta += '📞 <a href="' + resUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(r.reservation) + '</a>';
        } else {
            meta += '📞 ' + escHtml(r.reservation);
        }
    }
    var blogUrl = escUrl(r.blogUrl);
    if (blogUrl) {
        if (meta) meta += ' ｜ ';
        meta += '📝 <a href="' + blogUrl + '" target="_blank" rel="noopener noreferrer">網誌推薦</a>';
    }
    if (meta) html += '<span class="restaurant-meta">' + meta + '</span>';
    html += '</div>';
    return html;
}

/* ===== Render: Info Box ===== */
function renderInfoBox(box) {
    var html = '';
    switch (box.type) {
        case 'reservation':
            html += '<div class="info-box reservation">';
            if (box.title) html += '<strong>' + escHtml(box.title) + '</strong><br>';
            if (box.items && box.items.length) {
                box.items.forEach(function(item) {
                    html += escHtml(item) + '<br>';
                });
            }
            if (box.notes) html += escHtml(box.notes);
            html += '</div>';
            break;
        case 'parking':
            html += '<div class="info-box parking">';
            if (box.title) html += '🅿️ <strong>' + escHtml(box.title) + '</strong>';
            if (box.price) html += '：' + escHtml(box.price);
            if (box.location) html += ' ' + renderMapLinks(box.location, true);
            html += '</div>';
            break;
        case 'souvenir':
            html += '<div class="info-box souvenir">';
            if (box.title) html += '🎁 <strong>' + escHtml(box.title) + '</strong><br>';
            if (box.items && box.items.length) {
                box.items.forEach(function(item) {
                    html += (item.emoji || '🏪') + ' ';
                    var itemUrl = escUrl(item.url);
                    if (itemUrl) {
                        html += '<a href="' + itemUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(item.name) + '</a>';
                    } else {
                        html += escHtml(item.name);
                    }
                    if (item.note) html += '（' + escHtml(item.note) + '）';
                    if (item.location) html += ' ' + renderMapLinks(item.location, true);
                    html += '<br>';
                });
            }
            html += '</div>';
            break;
        case 'restaurants':
            html += '<div class="info-box restaurants">';
            var rCount = box.restaurants ? box.restaurants.length : 0;
            var rTitle = box.title || (rCount > 1 ? ('🍽️ ' + rCount + '選一') : '🍽️ 推薦餐廳');
            html += '🍽️ <strong>' + escHtml(rTitle) + '：</strong>';
            if (box.restaurants && box.restaurants.length) {
                box.restaurants.forEach(function(r) { html += renderRestaurant(r); });
            }
            html += '</div>';
            break;
        default:
            if (box.content) html += '<div class="info-box">' + escHtml(box.content) + '</div>';
            break;
    }
    return html;
}

/* ===== Render: Timeline Event ===== */
function renderTimelineEvent(ev) {
    var hasBody = ev.description || (ev.locations && ev.locations.length) || (ev.infoBoxes && ev.infoBoxes.length);
    var html = '<div class="tl-event">';
    var headCls = 'tl-head' + (hasBody ? ' clickable' : '');
    html += '<div class="' + headCls + '">';
    html += '<span class="tl-time">' + escHtml(ev.time || '') + '</span>';
    html += '<span class="tl-title">';
    if (ev.emoji) html += ev.emoji + ' ';
    var titleUrl = escUrl(ev.titleUrl);
    if (titleUrl) {
        html += '<a href="' + titleUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(ev.title) + '</a>';
    } else {
        html += escHtml(ev.title || '');
    }
    html += '</span>';
    if (hasBody) html += '<span class="tl-arrow">＋</span>';
    html += '</div>';
    if (ev.note) html += '<div class="tl-desc">' + escHtml(ev.note) + '</div>';
    if (hasBody) {
        html += '<div class="tl-body">';
        if (ev.description) html += '<p class="tl-desc">' + escHtml(ev.description) + '</p>';
        if (ev.locations && ev.locations.length) html += renderNavLinks(ev.locations);
        if (ev.infoBoxes && ev.infoBoxes.length) {
            ev.infoBoxes.forEach(function(box) { html += renderInfoBox(box); });
        }
        html += '</div>';
    }
    if (ev.transit) {
        html += '<div class="tl-transit">⤷ '
              + (ev.transit.emoji ? ev.transit.emoji + ' ' : '')
              + escHtml(ev.transit.text || ev.transit)
              + '</div>';
    }
    html += '</div>';
    return html;
}

/* ===== Render: Timeline ===== */
function renderTimeline(events) {
    if (!events || !events.length) return '';
    var html = '<div class="timeline">';
    events.forEach(function(ev) { html += renderTimelineEvent(ev); });
    html += '</div>';
    return html;
}

/* ===== Render: Hotel ===== */
function renderHotel(hotel) {
    var html = '';
    var nameHtml = escHtml(hotel.name || '');
    var hotelUrl = escUrl(hotel.url);
    if (hotelUrl) nameHtml = '<a href="' + hotelUrl + '" target="_blank" rel="noopener noreferrer">' + nameHtml + '</a>';
    html += '<div class="col-row">🏨 ' + nameHtml + ' <span class="arrow">＋</span></div>';
    html += '<div class="col-detail">';
    if (hotel.details && hotel.details.length) {
        html += '<div class="hotel-detail-grid">';
        hotel.details.forEach(function(d) { html += '<span>' + escHtml(d) + '</span>'; });
        html += '</div>';
    }
    if (hotel.subs && hotel.subs.length) {
        hotel.subs.forEach(function(sub) {
            html += '<div class="hotel-sub">';
            if (sub.label) html += '<strong>' + escHtml(sub.label) + '：</strong>';
            if (sub.text) html += escHtml(sub.text);
            if (sub.location) html += ' ' + renderMapLinks(sub.location, true);
            if (sub.items && sub.items.length) {
                sub.items.forEach(function(item) { html += '<br>' + escHtml(item); });
            }
            html += '</div>';
        });
    }
    html += '</div>';
    return html;
}

/* ===== Render: Budget ===== */
function renderBudget(budget) {
    var html = '';
    html += '<div class="col-row">💰 ' + escHtml(budget.summary || '') + ' <span class="arrow">＋</span></div>';
    html += '<div class="col-detail">';
    if (budget.items && budget.items.length) {
        html += '<table class="budget-table">';
        budget.items.forEach(function(item) {
            html += '<tr><td>' + escHtml(item.label) + '</td><td>' + escHtml(item.amount) + '</td></tr>';
        });
        if (budget.total) {
            html += '<tr class="budget-total"><td>' + escHtml(budget.total.label || '小計') + '</td><td>' + escHtml(budget.total.amount) + '</td></tr>';
        }
        html += '</table>';
    }
    if (budget.notes && budget.notes.length) {
        html += '<ul class="notes-list">';
        budget.notes.forEach(function(n) { html += '<li>' + escHtml(n) + '</li>'; });
        html += '</ul>';
    }
    html += '</div>';
    return html;
}

/* ===== Render: Day Content ===== */
function renderDayContent(content, weatherId) {
    var html = '';
    if (weatherId) {
        html += '<div class="hourly-weather" id="' + escHtml(weatherId) + '"><div class="hw-loading">⏳ 正在載入逐時天氣預報...</div></div>';
    }
    if (content.hotel) html += renderHotel(content.hotel);
    if (content.timeline) html += renderTimeline(content.timeline);
    if (content.budget) html += renderBudget(content.budget);
    return html;
}

/* ===== Render: Flights ===== */
function renderFlights(data) {
    var html = '';
    if (data.segments && data.segments.length) {
        data.segments.forEach(function(seg) {
            html += '<div class="flight-row">';
            html += '<span class="flight-icon">' + (seg.icon || '✈️') + '</span>';
            html += '<div class="flight-info">';
            if (seg.label) html += '<span class="flight-label">' + escHtml(seg.label) + '</span>';
            if (seg.flightNo) html += '<span class="flight-route">' + escHtml(seg.flightNo) + '</span>';
            if (seg.route) html += '<span class="flight-route">' + escHtml(seg.route) + '</span>';
            if (seg.time) html += '<span class="flight-time">' + escHtml(seg.time) + '</span>';
            html += '</div></div>';
        });
    }
    if (data.airline) {
        html += '<div class="flight-row">';
        html += '<span class="flight-icon">' + (data.airline.icon || '🏢') + '</span>';
        html += '<div class="flight-info"><span class="flight-label">' + escHtml(data.airline.name || '') + '</span>';
        if (data.airline.note) html += '<span class="flight-time">' + escHtml(data.airline.note) + '</span>';
        html += '</div></div>';
    }
    return html;
}

/* ===== Render: Checklist ===== */
function renderChecklist(data) {
    var html = '';
    if (data.cards && data.cards.length) {
        html += '<div class="ov-grid">';
        data.cards.forEach(function(card) {
            html += '<div class="ov-card" style="background:' + escHtml(card.color || 'var(--blue-light)') + ';">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.items && card.items.length) {
                html += '<p>';
                card.items.forEach(function(item) { html += escHtml(item) + '<br>'; });
                html += '</p>';
            }
            html += '</div>';
        });
        html += '</div>';
    } else if (data.items && data.items.length) {
        html += '<ul class="notes-list">';
        data.items.forEach(function(item) { html += '<li>' + escHtml(item) + '</li>'; });
        html += '</ul>';
    }
    return html;
}

/* ===== Render: Backup ===== */
function renderBackup(data) {
    var html = '';
    if (data.cards && data.cards.length) {
        html += '<div class="ov-grid">';
        data.cards.forEach(function(card) {
            html += '<div class="ov-card" style="background:' + escHtml(card.color || 'var(--blue-light)') + ';">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.desc) html += '<p>' + escHtml(card.desc) + '</p>';
            if (card.weatherItems && card.weatherItems.length) {
                html += '<ul class="weather-list">';
                card.weatherItems.forEach(function(w) { html += '<li>' + escHtml(w) + '</li>'; });
                html += '</ul>';
            }
            if (card.items && card.items.length) {
                html += '<p>';
                card.items.forEach(function(item) { html += escHtml(item) + '<br>'; });
                html += '</p>';
            }
            html += '</div>';
        });
        html += '</div>';
    } else if (data.items && data.items.length) {
        html += '<ul class="notes-list">';
        data.items.forEach(function(item) { html += '<li>' + escHtml(item) + '</li>'; });
        html += '</ul>';
    }
    return html;
}

/* ===== Render: Emergency ===== */
function renderEmergency(data) {
    var html = '';
    if (data.cards && data.cards.length) {
        html += '<div class="ov-grid">';
        data.cards.forEach(function(card) {
            html += '<div class="ov-card" style="background:' + escHtml(card.color || 'var(--blue-light)') + ';">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.contacts && card.contacts.length) {
                card.contacts.forEach(function(c) {
                    html += '<p>';
                    var cUrl = escUrl(c.url || ('tel:' + (c.phone || '')));
                    if (cUrl) {
                        html += '<a href="' + cUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(c.label || c.phone) + '</a>';
                    } else {
                        html += escHtml(c.label || c.phone || '');
                    }
                    if (c.note) html += '：' + escHtml(c.note);
                    html += '</p>';
                });
            }
            if (card.address) html += '<p>📍 ' + escHtml(card.address) + '</p>';
            if (card.notes && card.notes.length) {
                card.notes.forEach(function(n) { html += '<p>' + escHtml(n) + '</p>'; });
            }
            if (card.items && card.items.length) {
                html += '<p>';
                card.items.forEach(function(item) { html += escHtml(item) + '<br>'; });
                html += '</p>';
            }
            html += '</div>';
        });
        html += '</div>';
    }
    return html;
}

/* ===== Render: Suggestions ===== */
function renderSuggestions(data) {
    var html = '';
    if (data.cards && data.cards.length) {
        data.cards.forEach(function(card) {
            var cls = 'suggestion-card';
            if (card.priority) cls += ' ' + card.priority;
            html += '<div class="' + cls + '">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.items && card.items.length) {
                card.items.forEach(function(item) { html += '<p>' + escHtml(item) + '</p>'; });
            }
            html += '</div>';
        });
    }
    return html;
}

/* ===== Validate Day (time vs hours) ===== */
function validateDay(day) {
    var warnings = [];
    if (!day || !day.content || !day.content.timeline) return warnings;
    day.content.timeline.forEach(function(ev) {
        if (!ev.time || !ev.infoBoxes) return;
        var evTime = ev.time.split('-')[0].replace(':', '');
        var evHour = parseInt(evTime.substring(0, evTime.length - 2), 10) || 0;
        ev.infoBoxes.forEach(function(box) {
            if (box.type === 'restaurants' && box.restaurants) {
                box.restaurants.forEach(function(r) {
                    if (r.hours) {
                        var m = r.hours.match(/(\d{1,2}):(\d{2})/);
                        if (m && evHour < parseInt(m[1], 10)) {
                            warnings.push(escHtml(ev.title) + ' (' + escHtml(ev.time) + ') 可能早於 ' + escHtml(r.name) + ' 營業時間 (' + escHtml(r.hours) + ')');
                        }
                    }
                });
            }
            if (box.hours) {
                var m2 = box.hours.match(/(\d{1,2}):(\d{2})/);
                if (m2 && evHour < parseInt(m2[1], 10)) {
                    warnings.push(escHtml(ev.title) + ' (' + escHtml(ev.time) + ') 可能早於營業時間 (' + escHtml(box.hours) + ')');
                }
            }
        });
    });
    return warnings;
}

/* ===== Render: Warnings ===== */
function renderWarnings(warnings) {
    if (!warnings || !warnings.length) return '';
    var html = '<div class="trip-warnings" style="background:#FFEBEE;border-left:4px solid #D32F2F;padding:10px 14px;margin:8px 0;border-radius:6px;font-size:var(--fs-md);color:#D32F2F;">';
    html += '<strong>⚠️ 注意事項：</strong><ul style="margin:4px 0 0 16px;">';
    warnings.forEach(function(w) { html += '<li>' + w + '</li>'; });
    html += '</ul></div>';
    return html;
}
function sanitizeHtml(html) {
    // Strip <script>, <iframe>, on* attributes from user-uploaded content
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,form').forEach(function(el) { el.remove(); });
    doc.querySelectorAll('*').forEach(function(el) {
        Array.from(el.attributes).forEach(function(attr) {
            if (attr.name.indexOf('on') === 0) el.removeAttribute(attr.name);
            if (attr.name === 'href' || attr.name === 'src' || attr.name === 'action') {
                var val = (attr.value || '').trim().toLowerCase();
                if (val.indexOf('javascript:') === 0 || val.indexOf('data:text/html') === 0) el.removeAttribute(attr.name);
            }
        });
        // Add rel="noopener noreferrer" to target="_blank" links
        if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
            el.setAttribute('rel', 'noopener noreferrer');
        }
    });
    return doc.body.innerHTML;
}
// Strip legacy inline onclick from trusted JSON content (defence-in-depth)
function stripInlineHandlers(html) {
    return html.replace(/\s+onclick="[^"]*"/g, '');
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
// Renew all on page load
lsRenewAll();

/* ===== URL Routing ===== */
var DEFAULT_SLUG = 'okinawa-trip-2026-Ray';
function fileToSlug(f) { var m = f.match(/^data\/(.+)\.json$/); return m ? m[1] : null; }
function slugToFile(s) { return 'data/' + s + '.json'; }
function getUrlTrip() { return new URLSearchParams(window.location.search).get('trip'); }
function setUrlTrip(slug) {
    var url = new URL(window.location);
    if (slug) url.searchParams.set('trip', slug); else url.searchParams.delete('trip');
    history.replaceState(null, '', url);
}
function saveTripPref(slug) { lsSet('trip-pref', slug); }
function loadTripPref() { return lsGet('trip-pref'); }

/* ===== Trip Data Loading ===== */
var TRIP = null;
var TRIP_FILE = '';
var IS_CUSTOM = false;

// Migrate old keys to trip-planner- prefix
(function() {
    // Migrate old 'tripFile'
    var old = localStorage.getItem('tripFile');
    if (old && !lsGet('trip-pref')) {
        var s = fileToSlug(old);
        if (s) saveTripPref(s);
    }
    localStorage.removeItem('tripFile');
    // Migrate old 'tripPref' (unprefixed)
    try {
        var p = JSON.parse(localStorage.getItem('tripPref'));
        if (p && p.slug) {
            if (!lsGet('trip-pref')) saveTripPref(p.slug);
            localStorage.removeItem('tripPref');
        }
    } catch(e) {}
    // Migrate old 'dark' (unprefixed)
    var oldDark = localStorage.getItem('dark');
    if (oldDark !== null) {
        if (lsGet('dark') === null) lsSet('dark', oldDark);
        localStorage.removeItem('dark');
    }
})();

function resolveAndLoad() {
    // 1. URL has ?trip= param
    var slug = getUrlTrip();
    if (slug && /^[\w-]+$/.test(slug)) { loadTrip(slugToFile(slug)); return; }
    // 2. sessionStorage has custom trip (this session only)
    var ck = sessionStorage.getItem('customTripKey');
    if (ck && sessionStorage.getItem('tripData:' + ck)) { loadTrip(ck); return; }
    // 3. localStorage has preference (6-month expiry)
    var saved = loadTripPref();
    if (saved) { loadTrip(slugToFile(saved)); return; }
    // 4. Default
    loadTrip(slugToFile(DEFAULT_SLUG));
}

function loadTrip(filename) {
    TRIP_FILE = filename;
    IS_CUSTOM = filename.indexOf('custom:') === 0;

    if (IS_CUSTOM) {
        // Custom upload: sessionStorage only, no URL change
        setUrlTrip(null);
        var raw = sessionStorage.getItem('tripData:' + filename);
        if (raw) {
            try { var data = JSON.parse(raw); TRIP = data; renderTrip(data); return; }
            catch(e) { /* fall through to error */ }
        }
        document.getElementById('tripContent').innerHTML = '<div style="text-align:center;padding:40px;color:#D32F2F;">\u274c \u81ea\u8a02\u884c\u7a0b\u5df2\u904e\u671f\uff0c\u8acb\u91cd\u65b0\u4e0a\u50b3</div>';
        sessionStorage.removeItem('customTripKey');
        return;
    }

    // Normal file: update URL + save preference
    var slug = fileToSlug(filename);
    if (slug) { setUrlTrip(slug); saveTripPref(slug); }
    sessionStorage.removeItem('customTripKey');

    // Only allow relative paths (prevent fetching external URLs)
    if (/^https?:\/\//i.test(filename) || filename.indexOf('..') !== -1) {
        document.getElementById('tripContent').innerHTML = '<div style="text-align:center;padding:40px;color:#D32F2F;">\u274c \u7121\u6548\u7684\u884c\u7a0b\u6a94\u8def\u5f91</div>';
        return;
    }
    fetch(filename + '?t=' + Date.now())
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data) { TRIP = data; renderTrip(data); })
        .catch(function(e) {
            document.getElementById('tripContent').innerHTML = '<div style="text-align:center;padding:40px;color:#D32F2F;">\u274c \u8f09\u5165\u5931\u6557\uff1a' + escHtml(filename) + '</div>';
        });
}

function renderTrip(data) {
    // Sanitize content: custom uploads get full sanitization, trusted JSON strips leftover inline handlers
    var safe = IS_CUSTOM ? sanitizeHtml : stripInlineHandlers;

    // Update page title & meta tags
    document.title = data.meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && data.meta.description) metaDesc.setAttribute('content', data.meta.description);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', data.meta.title);
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && data.meta.ogDescription) ogDesc.setAttribute('content', data.meta.ogDescription);

    // Build nav pills (day.id is numeric, safe)
    var navHtml = '';
    data.days.forEach(function(day) {
        var id = parseInt(day.id) || 0;
        navHtml += '<button class="dn" data-day="' + id + '" data-action="scroll-to" data-target="day' + id + '">D' + id + '</button>';
    });
    document.getElementById('navPills').innerHTML = navHtml;

    // Build sections
    var html = '';

    // Day sections
    data.days.forEach(function(day) {
        var id = parseInt(day.id) || 0;
        html += '<section>';
        html += '<div class="day-header" id="day' + id + '"><h2>Day ' + id + '</h2><div class="dh-right">' + escHtml(day.date) + '</div></div>';
        html += '<div class="day-content">';
        if (typeof day.content === 'string') {
            html += safe(day.content || '');
        } else {
            var warnings = validateDay(day);
            if (warnings.length) html += renderWarnings(warnings);
            // 找出對應此天的 weather id
            var weatherId = null;
            if (data.weather) {
                data.weather.forEach(function(w) { if (w.date === day.date || w.dayId === id) weatherId = w.id; });
            }
            html += renderDayContent(day.content || {}, weatherId);
        }
        html += '</div>';
        html += '</section>';
    });

    // Info sections
    var infoSections = [
        { key: 'flights', id: 'sec-flight' },
        { key: 'checklist', id: 'sec-checklist' },
        { key: 'suggestions', id: 'sec-suggestions' },
        { key: 'backup', id: 'sec-backup' },
        { key: 'emergency', id: 'sec-emergency' }
    ];
    infoSections.forEach(function(sec) {
        var d = data[sec.key];
        if (!d) return;
        html += '<section>';
        html += '<div class="day-header info-header" id="' + sec.id + '"><h2>' + escHtml(d.title) + '</h2></div>';
        html += '<div class="day-content">';
        if (typeof d.content === 'string') {
            html += safe(d.content || '');
        } else {
            if (sec.key === 'flights') html += renderFlights(d.content || {});
            else if (sec.key === 'checklist') html += renderChecklist(d.content || {});
            else if (sec.key === 'suggestions') html += renderSuggestions(d.content || {});
            else if (sec.key === 'backup') html += renderBackup(d.content || {});
            else if (sec.key === 'emergency') html += renderEmergency(d.content || {});
        }
        html += '</div>';
        html += '</section>';
    });

    // Footer
    html += '<footer>';
    html += '<h3>' + escHtml(data.footer.title) + '</h3>';
    html += '<p>' + escHtml(data.footer.dates) + '</p>';
    if (data.footer.budget) html += '<p style="font-weight:600;">' + escHtml(data.footer.budget) + '</p>';
    if (data.footer.exchangeNote) html += '<p style="color:var(--gray);">' + escHtml(data.footer.exchangeNote) + '</p>';
    html += '<p>' + escHtml(data.footer.tagline) + '</p>';
    html += '</footer>';

    document.getElementById('tripContent').innerHTML = html;

    // Build menu
    buildMenu(data);

    // Init ARIA
    initAria();

    // Init weather
    if (data.weather && data.weather.length) initWeather(data.weather);

    // Hash anchor or auto-scroll to today
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        scrollToSec(hash);
    } else {
        autoScrollToday(data.autoScrollDates);
    }

    // Re-init nav scroll tracking
    initNavTracking();
}

function buildMenu(data) {
    var html = '<div class="menu-col">';
    data.days.forEach(function(day) {
        var id = parseInt(day.id) || 0;
        html += '<button class="menu-item" data-action="scroll-to" data-target="day' + id + '">📍 Day ' + id + '</button>';
    });
    html += '</div><div class="menu-col">';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-flight">✈️ 航班資訊</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-checklist">✅ 出發前確認</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-suggestions">💡 行程建議</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-backup">🔄 颱風/雨天備案</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-emergency">🆘 緊急聯絡</button>';
    html += '<div class="menu-sep"></div>';
    html += '<button class="menu-item" data-action="toggle-dark">🌙 深色模式</button>';
    html += '<button class="menu-item" data-action="toggle-print">🖨️ 列印模式</button>';
    html += '<button class="menu-item" data-action="switch-trip">📂 切換行程檔</button>';
    html += '</div>';
    document.getElementById('menuGrid').innerHTML = html;
    // Update dark mode button text
    if (document.body.classList.contains('dark')) {
        var btn = document.querySelector('[data-action="toggle-dark"]');
        if (btn) btn.textContent = '☀️ 淺色模式';
    }
}

/* ===== Toggle Functions ===== */
function toggleEv(e, el) {
    if (e.target.tagName === 'A' || e.target.closest('a')) return;
    var ev = el.closest('.tl-event');
    ev.classList.toggle('expanded');
    var isExpanded = ev.classList.contains('expanded');
    el.setAttribute('aria-expanded', isExpanded);
    var arrow = el.querySelector('.tl-arrow');
    if (arrow) arrow.textContent = isExpanded ? '－' : '＋';
}
function toggleCol(el) {
    el.classList.toggle('open');
    var detail = el.nextElementSibling;
    if (detail) detail.classList.toggle('open');
    var isOpen = el.classList.contains('open');
    el.setAttribute('aria-expanded', isOpen);
    var arrow = el.querySelector('.arrow');
    if (arrow) arrow.textContent = isOpen ? '－' : '＋';
}
function toggleDark() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    document.body.classList.toggle('dark');
    var isDark = document.body.classList.contains('dark');
    lsSet('dark', isDark ? '1' : '0');
    var btn = document.querySelector('[data-action="toggle-dark"]');
    if (btn) btn.textContent = isDark ? '☀️ 淺色模式' : '🌙 深色模式';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#1565C0' : '#0077B6');
}
if (lsGet('dark') === '1') {
    document.body.classList.add('dark');
    var dmeta = document.querySelector('meta[name="theme-color"]');
    if (dmeta) dmeta.setAttribute('content', '#1565C0');
}
var _manualScrollTs = 0;
function scrollToSec(id) {
    var el = document.getElementById(id);
    if (!el) return;
    _manualScrollTs = Date.now();
    var navH = document.getElementById('stickyNav').offsetHeight;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + id);
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
}
function scrollToDay(n) { scrollToSec('day' + n); }
function toggleMenu() {
    var menu = document.getElementById('menuDrop');
    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        document.body.style.overflow = '';
    } else {
        menu.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}
function toggleHw(el) {
    var p = el.closest('.hourly-weather');
    p.classList.toggle('hw-open');
    if (p.classList.contains('hw-open')) {
        var g = p.querySelector('.hw-grid');
        if (g) { var now = new Date().getHours(), tb = g.querySelector('.hw-now') || g.querySelector('[data-hour="' + Math.max(6, Math.min(21, now)) + '"]'); if (tb) g.scrollLeft = tb.offsetLeft - g.offsetLeft; }
    }
}
function togglePrint() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    var entering = !document.body.classList.contains('print-mode');
    if (entering && document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
        var btn = document.querySelector('[data-action="toggle-dark"]');
        if (btn) btn.textContent = '🌙 深色模式';
    }
    document.body.classList.toggle('print-mode');
    if (!entering && document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
        var btn2 = document.querySelector('[data-action="toggle-dark"]');
        if (btn2) btn2.textContent = '☀️ 淺色模式';
    }
}

/* ===== Switch Trip File ===== */
function switchTripFile() {
    document.getElementById('menuDrop').classList.remove('open'); document.body.style.overflow = '';
    fetch('data/trips.json?t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(trips) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:400;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:var(--white);border-radius:12px;padding:20px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
            box.innerHTML = '<h3 style="margin:0 0 12px;font-size:1.1rem;color:var(--text);">📂 選擇行程</h3>';
            trips.forEach(function(t) {
                var btn = document.createElement('button');
                btn.className = 'menu-item';
                btn.style.cssText = 'width:100%;text-align:left;padding:12px;margin-bottom:4px;border-radius:8px;border:1.5px solid var(--blue-light);';
                btn.innerHTML = '<strong>' + escHtml(t.name) + '</strong><br><span style="font-size:0.85em;color:var(--gray);">' + escHtml(t.dates) + '</span>';
                if (TRIP_FILE === t.file) btn.style.borderColor = 'var(--blue)';
                btn.onclick = function() { document.body.removeChild(overlay); loadTrip(t.file); window.scrollTo({top:0,behavior:'smooth'}); };
                box.appendChild(btn);
            });
            // Show current custom trip if active
            if (TRIP_FILE.indexOf('custom:') === 0 && TRIP) {
                var customBtn = document.createElement('button');
                customBtn.className = 'menu-item';
                customBtn.style.cssText = 'width:100%;text-align:left;padding:12px;margin-bottom:4px;border-radius:8px;border:1.5px solid var(--blue);';
                customBtn.innerHTML = '<strong>\ud83d\udcce ' + escHtml(TRIP_FILE.replace('custom:', '')) + '</strong><br><span style="font-size:0.85em;color:var(--gray);">\u81ea\u8a02\u4e0a\u50b3\uff08\u50c5\u9650\u672c\u6b21 session\uff09</span>';
                customBtn.onclick = function() { document.body.removeChild(overlay); };
                box.appendChild(customBtn);
            }
            // Upload custom
            var upBtn = document.createElement('button');
            upBtn.className = 'menu-item';
            upBtn.style.cssText = 'width:100%;text-align:center;padding:10px;margin-top:8px;color:var(--gray);';
            upBtn.textContent = '📁 上傳自訂 JSON 檔案';
            upBtn.onclick = function() {
                document.body.removeChild(overlay);
                var input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = function(e) {
                    var file = e.target.files[0]; if (!file) return;
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        try {
                            var data = JSON.parse(ev.target.result);
                            TRIP = data;
                            var key = 'custom:' + file.name;
                            TRIP_FILE = key;
                            IS_CUSTOM = true;
                            sessionStorage.setItem('customTripKey', key);
                            sessionStorage.setItem('tripData:' + key, ev.target.result);
                            setUrlTrip(null);
                            renderTrip(data);
                            window.scrollTo({top:0,behavior:'smooth'});
                        }
                        catch(err) { alert('JSON 格式錯誤：' + err.message); }
                    };
                    reader.readAsText(file);
                };
                input.click();
            };
            box.appendChild(upBtn);
            // Close btn
            var closeBtn = document.createElement('button');
            closeBtn.className = 'menu-item';
            closeBtn.style.cssText = 'width:100%;text-align:center;padding:8px;margin-top:4px;color:var(--gray);';
            closeBtn.textContent = '✕ 關閉';
            closeBtn.onclick = function() { document.body.removeChild(overlay); };
            box.appendChild(closeBtn);
            overlay.appendChild(box);
            overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
            document.body.appendChild(overlay);
        })
        .catch(function() { alert('無法載入行程清單'); });
}

/* ===== ARIA Init ===== */
function initAria() {
    document.querySelectorAll('.col-row').forEach(function(el) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.tl-head.clickable').forEach(function(el) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
    });
}

/* ===== Day Nav Active Pill + Sticky Nav Update ===== */
function initNavTracking() {
    var headers = [];
    if (!TRIP) return;
    for (var i = 1; i <= TRIP.days.length; i++) { var h = document.getElementById('day' + i); if (h) headers.push(h); }
    var navPills = document.querySelectorAll('#stickyNav .dh-nav .dn[data-day]');
    if (!navPills.length) return;
    var navH = document.getElementById('stickyNav').offsetHeight;
    var infoStart = document.getElementById('sec-flight');
    // Remove old listener if any
    if (window._navScrollHandler) window.removeEventListener('scroll', window._navScrollHandler);
    var ticking = false;
    window._navScrollHandler = function() {
        if (!ticking) { requestAnimationFrame(function() {
            var inInfo = infoStart && infoStart.getBoundingClientRect().top <= navH + 10;
            var current = -1;
            if (!inInfo) { for (var i = 0; i < headers.length; i++) { if (headers[i].getBoundingClientRect().top <= navH + 10) current = i; } }
            navPills.forEach(function(btn) { btn.classList.toggle('active', current >= 0 && parseInt(btn.getAttribute('data-day')) === current + 1); });
            if (current >= 0 && Date.now() - _manualScrollTs > 600) {
                var newHash = '#day' + (current + 1);
                if (window.location.hash !== newHash) history.replaceState(null, '', newHash);
            }
            ticking = false;
        }); ticking = true; }
    };
    window.addEventListener('scroll', window._navScrollHandler, { passive: true });
    // Trigger once immediately to set initial state
    window._navScrollHandler();
}

/* ===== Auto-scroll to today ===== */
function autoScrollToday(dates) {
    if (!dates || !dates.length) return;
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    var idx = dates.indexOf(todayStr);
    if (idx >= 0) {
        var el = document.getElementById('day' + (idx + 1));
        if (el) {
            var navH = document.getElementById('stickyNav').offsetHeight;
            window.scrollTo({ top: el.offsetTop - navH, behavior: 'auto' });
        }
    }
}

/* ===== Central Event Delegation ===== */
document.addEventListener('click', function(e) {
    var t = e.target;

    // 1. data-action buttons (menu, nav, toggles)
    var actionEl = t.closest('[data-action]');
    if (actionEl) {
        switch (actionEl.getAttribute('data-action')) {
            case 'toggle-menu': e.stopPropagation(); toggleMenu(actionEl); break;
            case 'scroll-to':  scrollToSec(actionEl.getAttribute('data-target')); break;
            case 'toggle-dark': toggleDark(); break;
            case 'toggle-print': togglePrint(); break;
            case 'switch-trip': switchTripFile(); break;
            case 'toggle-hw':  toggleHw(actionEl); break;
        }
        return;
    }

    // 2. Timeline event expand/collapse (from JSON content)
    var tlHead = t.closest('.tl-head.clickable');
    if (tlHead) {
        if (t.tagName === 'A' || t.closest('a')) return;
        toggleEv(e, tlHead);
        return;
    }

    // 3. Collapsible row expand/collapse (from JSON content)
    var colRow = t.closest('.col-row');
    if (colRow) {
        if (t.tagName === 'A' || t.closest('a')) return;
        toggleCol(colRow);
    }
});

/* ===== Hourly Weather API (Open-Meteo) ===== */
function initWeather(weatherDays) {
    var WMO={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',77:'🌨️',80:'🌦️',81:'🌧️',82:'🌧️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'};

    function getLocIdx(day,h){for(var i=day.locations.length-1;i>=0;i--)if(h>=day.locations[i].start)return i;return 0;}

    function renderHourly(c,m,day){
        var now=new Date(),ch=now.getHours();
        var minT=99,maxT=-99,minR=100,maxR=0,iconCount={},bestIcon='☀️';
        for(var h=0;h<24;h++){var t=Math.round(m.temps[h]),r=m.rains[h],ic=WMO[m.codes[h]]||'❓';if(t<minT)minT=t;if(t>maxT)maxT=t;if(r<minR)minR=r;if(r>maxR)maxR=r;iconCount[ic]=(iconCount[ic]||0)+1;}
        var maxCnt=0;for(var k in iconCount)if(iconCount[k]>maxCnt){maxCnt=iconCount[k];bestIcon=k;}
        var locs=day.locations.map(function(l){return l.name;}).filter(function(v,i,a){return a.indexOf(v)===i;}).join('→');
        var html='<div class="hw-summary" data-action="toggle-hw">'+bestIcon+' '+minT+'~'+maxT+'°C &nbsp;・&nbsp; 💧'+minR+'~'+maxR+'% &nbsp;・&nbsp; '+locs+'<span class="hw-summary-arrow">▸</span></div>';
        html+='<div class="hw-detail"><div class="hourly-weather-header"><span class="hourly-weather-title">⏱️ 逐時天氣 — '+day.label+'</span><span class="hw-update-time">'+ch+':'+String(now.getMinutes()).padStart(2,'0')+'</span></div><div class="hw-grid">';
        for(var h=0;h<=23;h++){
            var li=getLocIdx(day,h),icon=WMO[m.codes[h]]||'❓',temp=Math.round(m.temps[h]),rain=m.rains[h],isNow=(h===ch);
            html+='<div class="hw-block'+(isNow?' hw-now':'')+'" data-hour="'+h+'"><div class="hw-block-time">'+(isNow?'▶ ':'')+h+':00</div>';
            if(day.locations.length>1)html+='<div class="hw-block-loc hw-loc-'+li+'">'+day.locations[li].name+'</div>';
            html+='<div class="hw-block-icon">'+icon+'</div><div class="hw-block-temp">'+temp+'°C</div><div class="hw-block-rain'+(rain>=50?' hw-rain-high':'')+'">💧'+rain+'%</div></div>';
        }
        html+='</div></div>';c.innerHTML=html;
    }

    // Batch: collect unique locations across all days, fetch once per location with full date range
    var locMap={},minDate=null,maxDate=null;
    weatherDays.forEach(function(day){
        if(!minDate||day.date<minDate)minDate=day.date;
        if(!maxDate||day.date>maxDate)maxDate=day.date;
        day.locations.forEach(function(l){var k=l.lat+','+l.lon;if(!locMap[k])locMap[k]={lat:l.lat,lon:l.lon};});
    });
    var locKeys=Object.keys(locMap);
    Promise.all(locKeys.map(function(k){
        var l=locMap[k];
        return fetch('https://api.open-meteo.com/v1/forecast?latitude='+l.lat+'&longitude='+l.lon+'&hourly=temperature_2m,precipitation_probability,weather_code&start_date='+minDate+'&end_date='+maxDate+'&timezone=Asia/Tokyo')
            .then(function(r){return r.json();})
            .then(function(d){return{key:k,data:d};});
    })).then(function(results){
        var cache={};results.forEach(function(r){cache[r.key]=r.data;});
        weatherDays.forEach(function(day){
            var c=document.getElementById(day.id);if(!c)return;
            // Find hour offset for this day's date in the API response
            var sample=cache[locKeys[0]];
            if(!sample||!sample.hourly)return;
            var dayOffset=sample.hourly.time.indexOf(day.date+'T00:00');
            if(dayOffset<0)return;
            var mg={temps:[],rains:[],codes:[]};
            for(var h=0;h<24;h++){
                var li=getLocIdx(day,h),l=day.locations[li],d=cache[l.lat+','+l.lon];
                var idx=dayOffset+h;
                if(d&&d.hourly&&idx<d.hourly.temperature_2m.length){
                    mg.temps.push(d.hourly.temperature_2m[idx]);
                    mg.rains.push(d.hourly.precipitation_probability[idx]);
                    mg.codes.push(d.hourly.weather_code[idx]);
                }else{mg.temps.push(0);mg.rains.push(0);mg.codes.push(0);}
            }
            renderHourly(c,mg,day);
        });
    }).catch(function(e){
        weatherDays.forEach(function(day){
            var c=document.getElementById(day.id);
            if(c)c.innerHTML='<div class="hw-error">天氣資料載入失敗：'+e.message+'</div>';
        });
    });
}

window.addEventListener('beforeprint', function() {
    document.body.classList.add('print-mode');
    if (document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
    }
});
window.addEventListener('afterprint', function() {
    document.body.classList.remove('print-mode');
    if (document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
    }
});

// Initial load — resolve from URL → sessionStorage → localStorage → default
resolveAndLoad();

/* ===== Module Exports (Node.js / Vitest only) ===== */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escHtml: escHtml,
        escUrl: escUrl,
        stripInlineHandlers: stripInlineHandlers,
        renderMapLinks: renderMapLinks,
        renderNavLinks: renderNavLinks,
        renderRestaurant: renderRestaurant,
        renderInfoBox: renderInfoBox,
        renderTimelineEvent: renderTimelineEvent,
        renderTimeline: renderTimeline,
        renderHotel: renderHotel,
        renderBudget: renderBudget,
        renderDayContent: renderDayContent,
        renderFlights: renderFlights,
        renderChecklist: renderChecklist,
        renderBackup: renderBackup,
        renderEmergency: renderEmergency,
        renderSuggestions: renderSuggestions,
        renderWarnings: renderWarnings,
        validateDay: validateDay,
        fileToSlug: fileToSlug,
        slugToFile: slugToFile,
        APPLE_SVG: APPLE_SVG
    };
}
