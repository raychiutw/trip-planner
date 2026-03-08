/* ===== Constants ===== */
var ARROW_EXPAND = '＋';
var ARROW_COLLAPSE = '－';
var DRIVING_WARN_MINUTES = 120;
var DRIVING_WARN_LABEL = '超過 2 小時';
var TRANSPORT_TYPE_ORDER = ['car', 'train', 'walking'];

/* ===== Safe Color Validation ===== */
var SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\)|var\(--[\w-]+\)|[a-z]+)$/i;
function safeColor(c) { return (c && SAFE_COLOR_RE.test(c)) ? c : 'var(--blue-light)'; }

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
    if (loc.naverQuery && /^https?:/i.test(loc.naverQuery)) {
        html += '<a href="' + escUrl(loc.naverQuery) + '" target="_blank" rel="noopener noreferrer" class="' + cls + ' naver">'
              + '<span class="n-icon">N</span> N Map</a>';
    }
    if (loc.mapcode) {
        html += '<span class="' + cls + ' mapcode">' + iconSpan('device') + ' ' + escHtml(loc.mapcode) + '</span>';
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

/* ===== Render: Blog Link ===== */
function renderBlogLink(url) {
    var safe = escUrl(url);
    if (!safe) return '';
    return iconSpan('document') + ' <a href="' + safe + '" target="_blank" rel="noopener noreferrer">網誌推薦</a>';
}

/* ===== Render: Restaurant ===== */
function renderRestaurant(r) {
    var html = '<div class="restaurant-choice">';
    var nameHtml = escHtml(r.name);
    var rUrl = escUrl(r.url);
    if (rUrl) nameHtml = '<a href="' + rUrl + '" target="_blank" rel="noopener noreferrer">' + nameHtml + '</a>';
    html += (r.category ? '<strong>' + escHtml(r.category) + '：</strong>' : '')
          + nameHtml;
    if (typeof r.googleRating === 'number') html += ' <span class="rating">★ ' + r.googleRating.toFixed(1) + '</span>';
    if (r.description) html += ' — ' + escHtml(r.description);
    if (r.price) html += '，' + escHtml(r.price);
    html += '<br>';
    if (r.location) html += renderMapLinks(r.location, true);
    var meta = '';
    if (r.hours) meta += iconSpan('clock') + ' ' + escHtml(r.hours);
    if (r.reservation) {
        if (meta) meta += ' ｜ ';
        var resUrl = escUrl(r.reservationUrl);
        if (resUrl) {
            meta += iconSpan('phone') + ' <a href="' + resUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(r.reservation) + '</a>';
        } else {
            meta += iconSpan('phone') + ' ' + escHtml(r.reservation);
        }
    }
    var blogLink = renderBlogLink(r.blogUrl);
    if (blogLink) {
        if (meta) meta += ' ｜ ';
        meta += blogLink;
    }
    if (meta) html += '<span class="restaurant-meta">' + meta + '</span>';
    html += '</div>';
    return html;
}

/* ===== Render: Shop ===== */
function renderShop(shop) {
    var html = '<div class="restaurant-choice">';
    var nameHtml = escHtml(shop.name);
    html += (shop.category ? '<strong>' + escHtml(shop.category) + '：</strong>' : '') + nameHtml;
    if (typeof shop.googleRating === 'number') html += ' <span class="rating">★ ' + shop.googleRating.toFixed(1) + '</span>';
    html += '<br>';
    if (shop.location) html += renderMapLinks(shop.location, true);
    var meta = '';
    if (shop.hours) meta += iconSpan('clock') + ' ' + escHtml(shop.hours);
    var sBlogLink = renderBlogLink(shop.blogUrl);
    if (sBlogLink) {
        if (meta) meta += ' ｜ ';
        meta += sBlogLink;
    }
    if (meta) html += '<span class="restaurant-meta">' + meta + '</span>';
    if (shop.mustBuy && shop.mustBuy.length) {
        html += '<div class="shop-must-buy">' + iconSpan('gift') + ' 必買：' + shop.mustBuy.map(escHtml).join('、') + '</div>';
    }
    html += '</div>';
    return html;
}

function gridClass(count) {
    return 'info-box-grid' + (count === 1 ? ' grid-1' : (count % 2 === 0 ? ' grid-even' : ' grid-odd'));
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
            if (box.title) html += iconSpan('parking') + ' <strong>' + escHtml(box.title) + '</strong>';
            if (box.price) html += '：' + escHtml(box.price);
            if (box.location) html += ' ' + renderMapLinks(box.location, true);
            html += '</div>';
            break;
        case 'souvenir':
            html += '<div class="info-box souvenir">';
            if (box.title) html += iconSpan('gift') + ' <strong>' + escHtml(box.title) + '</strong><br>';
            if (box.items && box.items.length) {
                box.items.forEach(function(item) {
                    html += iconSpan('gift') + ' ';
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
            var rItems = box.restaurants || [];
            var rTitle = box.title || (rItems.length > 1 ? (rItems.length + '選一') : '推薦餐廳');
            html += iconSpan('utensils') + ' <strong>' + escHtml(rTitle) + '：</strong>';
            html += '<div class="' + gridClass(rItems.length) + '">';
            rItems.forEach(function(r) { html += renderRestaurant(r); });
            html += '</div>';
            html += '</div>';
            break;
        case 'shopping':
            html += '<div class="info-box shopping">';
            var sItems = box.shops || [];
            var sTitle = box.title || (sItems.length > 1 ? '推薦購物' : '附近購物');
            html += iconSpan('shopping') + ' <strong>' + escHtml(sTitle) + '：</strong>';
            html += '<div class="' + gridClass(sItems.length) + '">';
            sItems.forEach(function(s) { html += renderShop(s); });
            html += '</div>';
            html += '</div>';
            break;
        case 'gasStation':
            html += '<div class="info-box gas-station">';
            var gsTitle = box.title || '加油站';
            html += iconSpan('gas-station') + ' <strong>' + escHtml(gsTitle) + '</strong>';
            if (typeof box.googleRating === 'number') html += ' <span class="rating">★ ' + box.googleRating.toFixed(1) + '</span>';
            if (box.station) {
                var st = box.station;
                html += '<div class="gas-station-detail">';
                html += '<strong>' + escHtml(st.name) + '</strong><br>';
                html += escHtml(st.address) + '<br>';
                if (st.hours) html += iconSpan('clock') + ' ' + escHtml(st.hours) + '<br>';
                if (st.service) html += escHtml(st.service) + '<br>';
                if (st.phone) html += iconSpan('phone') + ' ' + escHtml(st.phone);
                if (st.location) html += '<br>' + renderMapLinks(st.location, true);
                html += '</div>';
            }
            html += '</div>';
            break;
        default:
            if (box.content) html += '<div class="info-box">' + escHtml(box.content) + '</div>';
            break;
    }
    return html;
}

/* ===== Render: Timeline Helpers ===== */
function parseTimeRange(timeStr) {
    if (!timeStr) return { start: '', end: '', duration: 0 };
    var parts = timeStr.split('-');
    var start = parts[0].trim();
    var end = parts.length > 1 ? parts[1].trim() : '';
    var duration = 0;
    if (start && end) {
        var s = start.split(':'), e = end.split(':');
        if (s.length === 2 && e.length === 2) {
            duration = (parseInt(e[0]) * 60 + parseInt(e[1])) - (parseInt(s[0]) * 60 + parseInt(s[1]));
            if (duration < 0) duration += 24 * 60;
        }
    }
    return { start: start, end: end, duration: duration };
}
function fmtDuration(mins) {
    if (mins <= 0) return '';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h > 0 && m > 0) return h + ' 小時 ' + m + ' 分';
    if (h > 0) return h + ' 小時';
    return m + ' 分';
}

/* ===== Render: Timeline Event ===== */
function renderTimelineEvent(entry, idx, isLast) {
    var hasBody = entry.description || (entry.locations && entry.locations.length) || (entry.infoBoxes && entry.infoBoxes.length);
    var parsed = parseTimeRange(entry.time);
    var html = '<div class="tl-event expanded">';

    /* Arrival flag */
    html += '<div class="tl-flag tl-flag-arrive">';
    html += '<span class="tl-flag-num">' + idx + '</span>';
    html += '<span class="tl-time-start">' + escHtml(parsed.start) + '</span>';
    html += '</div>';

    /* Segment: dashed line + card */
    html += '<div class="tl-segment">';
    html += '<div class="tl-card">';

    /* Card header: title + duration */
    html += '<div class="tl-card-header">';
    html += '<span class="tl-title">';
    var titleUrl = escUrl(entry.titleUrl);
    if (titleUrl) {
        html += '<a href="' + titleUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(entry.title) + '</a>';
    } else {
        html += escHtml(entry.title || '');
    }
    html += '</span>';
    if (typeof entry.googleRating === 'number') html += ' <span class="rating">★ ' + entry.googleRating.toFixed(1) + '</span>';
    var durationText = fmtDuration(parsed.duration);
    if (durationText) html += '<span class="tl-duration">' + iconSpan('clock') + ' ' + durationText + '</span>';
    html += '</div>';

    var entryBlogLink = renderBlogLink(entry.blogUrl);
    if (entryBlogLink) html += '<div class="tl-blog">' + entryBlogLink + '</div>';

    /* Description / note */
    if (entry.note) html += '<div class="tl-desc">' + escHtml(entry.note) + '</div>';

    /* Body: description, locations, infoBoxes */
    if (hasBody) {
        html += '<div class="tl-body">';
        if (entry.description) html += '<p class="tl-desc">' + escHtml(entry.description) + '</p>';
        if (entry.locations && entry.locations.length) html += renderNavLinks(entry.locations);
        if (entry.infoBoxes && entry.infoBoxes.length) {
            entry.infoBoxes.forEach(function(box) { html += renderInfoBox(box); });
        }
        html += '</div>';
    }
    html += '</div>'; /* end tl-card */
    html += '</div>'; /* end tl-segment */

    /* Departure flag */
    if (parsed.end) {
        html += '<div class="tl-flag tl-flag-depart">';
        html += '<span class="tl-time-end">' + escHtml(parsed.end) + '</span>';
        html += '</div>';
    }

    html += '</div>'; /* end tl-event */

    /* Transit segment */
    if (entry.travel) {
        var travelText = entry.travel.text || (typeof entry.travel === 'string' ? entry.travel : '');
        var travelType = (entry.travel.type) || '';
        var travelIcon = travelType ? iconSpan(travelType) : '';
        html += '<div class="tl-segment tl-segment-transit">';
        html += '<div class="tl-transit-content">';
        if (travelIcon) html += '<span class="tl-transit-icon">' + travelIcon + '</span>';
        html += '<span class="tl-transit-text">' + escHtml(travelText) + '</span>';
        html += '<span class="tl-transit-arrow">' + iconSpan('arrow-left') + '</span>';
        html += '</div></div>';
    }

    return html;
}

/* ===== Render: Timeline ===== */
function renderTimeline(events) {
    if (!events || !events.length) return '';
    var html = '<div class="timeline">';
    events.forEach(function(ev, i) {
        html += renderTimelineEvent(ev, i + 1, i === events.length - 1);
    });
    html += '</div>';
    return html;
}

/* ===== Render: Hotel ===== */
function renderHotel(hotel) {
    var html = '';
    var nameHtml = escHtml(hotel.name || '');
    var hotelUrl = escUrl(hotel.url);
    if (hotelUrl) nameHtml = '<a href="' + hotelUrl + '" target="_blank" rel="noopener noreferrer">' + nameHtml + '</a>';
    html += '<div class="col-row">' + iconSpan('hotel') + ' ' + nameHtml + ' <span class="arrow">＋</span></div>';
    html += '<div class="col-detail">';
    var hotelBlogLink = renderBlogLink(hotel.blogUrl);
    if (hotelBlogLink) {
        html += '<div class="hotel-blog">' + hotelBlogLink + '</div>';
    }
    if (hotel.details && hotel.details.length) {
        html += '<div class="hotel-detail-grid">';
        hotel.details.forEach(function(d) { html += '<span>' + escHtml(d) + '</span>'; });
        html += '</div>';
    }
    if (hotel.breakfast) {
        html += '<div class="hotel-sub">' + iconSpan('utensils') + ' ';
        if (hotel.breakfast.included === true) {
            html += '含早餐';
            if (hotel.breakfast.note) html += '（' + escHtml(hotel.breakfast.note) + '）';
        } else if (hotel.breakfast.included === false) {
            html += '不含早餐';
        } else {
            html += '早餐：資料未提供';
        }
        html += '</div>';
    }
    if (hotel.checkout) {
        html += '<div class="hotel-sub">' + iconSpan('clock') + ' 退房 ' + escHtml(hotel.checkout) + '</div>';
    }
    if (hotel.infoBoxes && hotel.infoBoxes.length) {
        hotel.infoBoxes.forEach(function(box) { html += renderInfoBox(box); });
    }
    html += '</div>';
    return html;
}

/* ===== Transport Types ===== */
var TRANSPORT_TYPES = {
    'car': { label: '開車', icon: 'car' },
    'train': { label: '電車', icon: 'train' },
    'walking': { label: '步行', icon: 'walking' }
};

function formatMinutes(totalMins) {
    var hrs = Math.floor(totalMins / 60);
    var mins = totalMins % 60;
    return hrs > 0 ? hrs + ' 小時' + (mins > 0 ? ' ' + mins + ' 分鐘' : '') : totalMins + ' 分鐘';
}

/* ===== Driving Stats (all transport types) ===== */
function calcDrivingStats(timeline) {
    if (!timeline || !timeline.length) return null;
    var byType = {};
    var totalMinutes = 0;
    var drivingMinutes = 0;
    timeline.forEach(function(entry) {
        if (!entry.travel) return;
        var t = entry.travel;
        var type = t.type || '';
        var text = t.text || (typeof t === 'string' ? t : '');
        if (!TRANSPORT_TYPES[type]) return;
        var m = text.match(/(\d+)/);
        if (!m) return;
        var mins = parseInt(m[1], 10);
        if (!byType[type]) {
            byType[type] = { label: TRANSPORT_TYPES[type].label, icon: TRANSPORT_TYPES[type].icon, totalMinutes: 0, segments: [] };
        }
        byType[type].segments.push({ text: text, minutes: mins });
        byType[type].totalMinutes += mins;
        totalMinutes += mins;
        if (type === 'car') drivingMinutes += mins;
    });
    if (totalMinutes === 0) return null;
    return { totalMinutes: totalMinutes, drivingMinutes: drivingMinutes, byType: byType,
        // backward-compat: flat segments list (driving only)
        segments: byType['car'] ? byType['car'].segments : [] };
}

function renderTransportTypeGroups(byType) {
    var html = '';
    TRANSPORT_TYPE_ORDER.forEach(function(key) {
        var group = byType[key];
        if (!group) return;
        html += '<div class="transport-type-group">';
        html += '<div class="transport-type-label">' + iconSpan(group.icon) + ' ' + escHtml(group.label) + '：' + escHtml(formatMinutes(group.totalMinutes)) + '</div>';
        html += '<div class="driving-stats-detail">';
        group.segments.forEach(function(seg) {
            html += '<span class="driving-stats-seg">' + iconSpan(group.icon) + ' ' + escHtml(seg.text) + '</span>';
        });
        html += '</div></div>';
    });
    return html;
}

function renderDrivingStats(stats) {
    if (!stats) return '';
    var isWarning = stats.drivingMinutes > DRIVING_WARN_MINUTES;
    var cls = isWarning ? 'driving-stats driving-stats-warning' : 'driving-stats';
    var dsIcon = isWarning ? iconSpan('warning') : iconSpan('bus');
    var html = '<div class="' + cls + '">';
    html += '<div class="col-row" role="button" aria-expanded="false">' + dsIcon + ' 當日交通：' + escHtml(formatMinutes(stats.totalMinutes));
    if (isWarning) html += ' <span class="driving-stats-badge">' + DRIVING_WARN_LABEL + '</span>';
    html += ' <span class="arrow">' + ARROW_EXPAND + '</span></div>';
    html += '<div class="col-detail">';
    html += renderTransportTypeGroups(stats.byType);
    html += '</div></div>';
    return html;
}

/* ===== Trip-wide Driving Stats ===== */
function calcTripDrivingStats(days) {
    if (!days || !days.length) return null;
    var dayStats = [];
    var grandTotal = 0;
    var grandByType = {};
    days.forEach(function(day) {
        var content = day.content || {};
        var stats = calcDrivingStats(content.timeline);
        if (stats) {
            dayStats.push({ dayId: day.id, date: formatDayDate(day), label: 'Day ' + day.id, stats: stats });
            grandTotal += stats.totalMinutes;
            // Aggregate by type
            for (var emoji in stats.byType) {
                if (!stats.byType.hasOwnProperty(emoji)) continue;
                var g = stats.byType[emoji];
                if (!grandByType[emoji]) {
                    grandByType[emoji] = { label: g.label, icon: g.icon, totalMinutes: 0 };
                }
                grandByType[emoji].totalMinutes += g.totalMinutes;
            }
        }
    });
    if (!dayStats.length) return null;
    return { grandTotal: grandTotal, grandByType: grandByType, days: dayStats };
}

function renderTripDrivingStats(tripStats) {
    if (!tripStats) return '';
    var html = '<div class="driving-summary">';
    html += '<div class="driving-summary-header">' + iconSpan('bus') + ' 全旅程交通統計：' + escHtml(formatMinutes(tripStats.grandTotal)) + '</div>';
    html += '<div class="driving-summary-body">';
    // Type summary
    TRANSPORT_TYPE_ORDER.forEach(function(key) {
        var g = tripStats.grandByType[key];
        if (!g) return;
        html += '<div class="transport-type-summary">' + iconSpan(g.icon) + ' ' + escHtml(g.label) + '：' + escHtml(formatMinutes(g.totalMinutes)) + '</div>';
    });
    // Per-day breakdown
    tripStats.days.forEach(function(d) {
        var isWarning = d.stats.drivingMinutes > DRIVING_WARN_MINUTES;
        html += '<div class="driving-summary-day' + (isWarning ? ' driving-stats-warning' : '') + '">';
        html += '<div class="driving-summary-day-header"><strong>' + escHtml(d.label) + '（' + escHtml(d.date) + '）</strong>：' + escHtml(formatMinutes(d.stats.totalMinutes));
        if (isWarning) html += ' <span class="driving-stats-badge">' + DRIVING_WARN_LABEL + '</span>';
        html += '</div>';
        html += '<div class="driving-summary-day-body">';
        html += renderTransportTypeGroups(d.stats.byType);
        html += '</div></div>';
    });
    html += '</div></div>';
    return html;
}

/* ===== Render: Day Content ===== */
function renderDayContent(content, weatherId) {
    var html = '';
    var overviewHtml = '';
    if (weatherId) {
        overviewHtml += '<div class="hourly-weather" id="' + escHtml(weatherId) + '"><div class="hw-loading">' + iconSpan('hourglass') + ' 正在載入逐時天氣預報...</div></div>';
    }
    if (content.hotel) overviewHtml += renderHotel(content.hotel);
    if (content.timeline) {
        var stats = calcDrivingStats(content.timeline);
        overviewHtml += renderDrivingStats(stats);
    }
    if (overviewHtml) html += '<div class="day-overview">' + overviewHtml + '</div>';
    if (content.timeline) html += renderTimeline(content.timeline);
    return html;
}

/* ===== Render: Flights ===== */
function renderFlights(data) {
    var html = '';
    if (data.segments && data.segments.length) {
        data.segments.forEach(function(seg) {
            html += '<div class="flight-row">';
            var segIcon = (seg.label && seg.label.indexOf('回') >= 0) ? iconSpan('landing') : iconSpan('takeoff');
            html += '<span class="flight-icon">' + segIcon + '</span>';
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
        html += '<span class="flight-icon">' + iconSpan('building') + '</span>';
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
            html += '<div class="ov-card">';
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
        data.items.forEach(function(item) { html += '<li><span class="list-icon">' + iconSpan('pin') + '</span>' + escHtml(item) + '</li>'; });
        html += '</ul>';
    }
    return html;
}

/* ===== Render: Backup ===== */
function renderBackup(data) {
    var html = '';
    if (data.cards && data.cards.length) {
        html += '<div class="ov-grid ov-grid-2">';
        data.cards.forEach(function(card) {
            html += '<div class="ov-card">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.description) html += '<p>' + escHtml(card.description) + '</p>';
            if (card.weatherItems && card.weatherItems.length) {
                html += '<ul class="weather-list">';
                card.weatherItems.forEach(function(w) { html += '<li><span class="list-icon">' + iconSpan('wave') + '</span>' + escHtml(w) + '</li>'; });
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
        data.items.forEach(function(item) { html += '<li><span class="list-icon">' + iconSpan('pin') + '</span>' + escHtml(item) + '</li>'; });
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
            html += '<div class="ov-card">';
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
            if (card.address) html += '<p>' + iconSpan('location-pin') + ' ' + escHtml(card.address) + '</p>';
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
            var priorityClass = card.priority ? ' sg-priority-' + card.priority : '';
            html += '<div class="suggestion-card' + priorityClass + '">';
            if (card.title) html += '<h4>' + escHtml(card.title) + '</h4>';
            if (card.items && card.items.length) {
                card.items.forEach(function(item) { html += '<p>' + escHtml(item) + '</p>'; });
            }
            html += '</div>';
        });
    }
    return html;
}

/* ===== Validate Trip Data (structure + URL + mapcode) ===== */
function validateTripData(data) {
    var errors = [];
    var warnings = [];
    if (!data || typeof data !== 'object') { errors.push('資料不是有效的物件'); return { errors: errors, warnings: warnings }; }

    // --- Top-level structure (errors) ---
    if (!data.meta) errors.push('缺少 meta');
    else {
        if (!data.meta.title) errors.push('meta 缺少 title');
        if (!Array.isArray(data.meta.countries) || data.meta.countries.length === 0) errors.push('meta 缺少 countries（需為非空陣列，如 ["JP"]）');
    }

    if (!data.days) errors.push('缺少 days');
    else if (!Array.isArray(data.days)) errors.push('days 必須是陣列');
    else if (data.days.length === 0) errors.push('days 不得為空陣列');
    else {
        if (Number(data.days[0].id) !== 1) errors.push('行程必須從 Day 1 開始（第一天 id 應為 1）');
        data.days.forEach(function(d, i) {
            if (!d.id && d.id !== 0) errors.push('days[' + i + '] 缺少 id');
            if (!d.date) errors.push('days[' + i + '] 缺少 date');
            if (d.label && d.label.length > 8)
                warnings.push('days[' + i + '].label 超過 8 字（' + d.label.length + ' 字）：' + escHtml(d.label));
        });
    }

    if (!data.autoScrollDates || !Array.isArray(data.autoScrollDates) || data.autoScrollDates.length === 0)
        errors.push('缺少 autoScrollDates 或為空');
    if (!data.footer) errors.push('缺少 footer');
    else {
        if (!data.footer.title) errors.push('footer 缺少 title');
        if (!data.footer.dates) errors.push('footer 缺少 dates');
    }
    if (!data.suggestions) errors.push('缺少 suggestions');

    // --- Recursive walk for warnings ---
    var URL_FIELDS = ['titleUrl', 'url', 'googleQuery', 'appleQuery', 'reservationUrl', 'blogUrl', 'reserve', 'naverQuery'];
    var MAPCODE_RE = /^\d{2,4}\s\d{3}\s\d{3}\*\d{2}$/;

    function walk(obj, path) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(function(item, i) { walk(item, path + '[' + i + ']'); });
            return;
        }
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            var val = obj[key];
            // URL safety
            if (URL_FIELDS.indexOf(key) >= 0 && typeof val === 'string' && val.length > 0) {
                if (!/^(https?:|tel:)/i.test(val)) {
                    warnings.push(path + '.' + key + ' 含有不安全的 URL：' + escHtml(val));
                }
            }
            // Google Maps prefix
            if (key === 'googleQuery' && typeof val === 'string' && val.length > 0) {
                if (!/^https:\/\/maps\.google\.com\//i.test(val) && !/^https:\/\/www\.google\.com\/maps\//i.test(val)) {
                    warnings.push(path + '.' + key + ' 不符合 Google Maps URL 格式：' + escHtml(val));
                }
            }
            // Apple Maps prefix
            if (key === 'appleQuery' && typeof val === 'string' && val.length > 0) {
                if (!/^https:\/\/maps\.apple\.com\//i.test(val)) {
                    warnings.push(path + '.' + key + ' 不符合 Apple Maps URL 格式：' + escHtml(val));
                }
            }
            // Naver Maps URL
            if (key === 'naverQuery' && typeof val === 'string' && val.length > 0) {
                if (!/^https:\/\/map\.naver\.com\//i.test(val)) {
                    warnings.push(path + '.' + key + ' 不符合 Naver Maps URL 格式：' + escHtml(val));
                }
            }
            // Mapcode format
            if (key === 'mapcode' && typeof val === 'string' && val.length > 0) {
                if (!MAPCODE_RE.test(val)) {
                    warnings.push(path + '.' + key + ' 格式不符（應如 33 530 406*00）：' + escHtml(val));
                }
            }
            // Recurse
            if (typeof val === 'object') walk(val, path + '.' + key);
        }
    }
    walk(data, 'root');

    // --- Per-day weather lat/lon type check ---
    if (Array.isArray(data.days)) {
        data.days.forEach(function(day, i) {
            if (day.weather && Array.isArray(day.weather.locations)) {
                day.weather.locations.forEach(function(loc, j) {
                    if (typeof loc.lat !== 'number') warnings.push('days[' + i + '].weather.locations[' + j + '].lat 必須是 number');
                    if (typeof loc.lon !== 'number') warnings.push('days[' + i + '].weather.locations[' + j + '].lon 必須是 number');
                });
            }
        });
    }

    // --- Suggestions priority check ---
    if (data.suggestions && data.suggestions.content && Array.isArray(data.suggestions.content.cards)) {
        data.suggestions.content.cards.forEach(function(card, i) {
            if (card.priority && ['high', 'medium', 'low'].indexOf(card.priority) < 0) {
                warnings.push('suggestions.cards[' + i + '].priority 必須是 high/medium/low，目前為：' + escHtml(card.priority));
            }
        });
    }

    return { errors: errors, warnings: warnings };
}

/* ===== Validate Day (time vs hours) ===== */
function validateDay(day) {
    var warnings = [];
    if (!day || !day.content || !day.content.timeline) return warnings;
    day.content.timeline.forEach(function(entry) {
        if (!entry.time || !entry.infoBoxes) return;
        var entryTime = entry.time.split('-')[0].replace(':', '');
        var entryHour = parseInt(entryTime.substring(0, entryTime.length - 2), 10) || 0;
        entry.infoBoxes.forEach(function(box) {
            if (box.type === 'shopping' && box.shops) {
                box.shops.forEach(function(s) {
                    if (s.hours) {
                        var m3 = s.hours.match(/(\d{1,2}):(\d{2})/);
                        if (m3 && entryHour < parseInt(m3[1], 10)) {
                            warnings.push(escHtml(entry.title) + ' (' + escHtml(entry.time) + ') 可能早於 ' + escHtml(s.name) + ' 營業時間 (' + escHtml(s.hours) + ')');
                        }
                    }
                });
            }
            if (box.type === 'restaurants' && box.restaurants) {
                box.restaurants.forEach(function(r) {
                    if (r.hours) {
                        var m = r.hours.match(/(\d{1,2}):(\d{2})/);
                        if (m && entryHour < parseInt(m[1], 10)) {
                            warnings.push(escHtml(entry.title) + ' (' + escHtml(entry.time) + ') 可能早於 ' + escHtml(r.name) + ' 營業時間 (' + escHtml(r.hours) + ')');
                        }
                    }
                });
            }
            if (box.hours) {
                var m2 = box.hours.match(/(\d{1,2}):(\d{2})/);
                if (m2 && entryHour < parseInt(m2[1], 10)) {
                    warnings.push(escHtml(entry.title) + ' (' + escHtml(entry.time) + ') 可能早於營業時間 (' + escHtml(box.hours) + ')');
                }
            }
        });
    });
    return warnings;
}

/* ===== Render: Warnings ===== */
function renderWarnings(warnings) {
    if (!warnings || !warnings.length) return '';
    var html = '<div class="trip-warnings">';
    html += '<strong>' + iconSpan('warning') + ' 注意事項：</strong><ul>';
    warnings.forEach(function(w) { html += '<li>' + w + '</li>'; });
    html += '</ul></div>';
    return html;
}
// Renew all on page load
lsRenewAll();

/* ===== Date Display ===== */
function formatDayDate(day) {
    // ISO "2026-07-29" + dayOfWeek "三" → "7/29（三）"
    var d = day.date || '';
    var m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (m) {
        var month = parseInt(m[1], 10);
        var date = parseInt(m[2], 10);
        var dow = day.dayOfWeek ? '（' + day.dayOfWeek + '）' : '';
        return month + '/' + date + dow;
    }
    return d; // fallback for non-ISO dates
}

/* ===== URL Routing ===== */
function fileToSlug(f) {
    var m = f.match(/^data\/dist\/([^/]+)\/$/);
    return m ? m[1] : null;
}
function slugToFile(s) { return 'data/dist/' + s + '/'; }
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
var DIST_PATH = '';
var dayCache = {};
var weatherCache = {};
var tripStart = null;
var tripEnd = null;

function resolveAndLoad() {
    var slug = getUrlTrip();
    if (slug && /^[\w-]+$/.test(slug)) { loadTrip(slug); return; }
    var saved = loadTripPref();
    if (saved) { loadTrip(saved); return; }
    document.getElementById('tripContent').innerHTML = '<div class="trip-error">'
        + '<p>請選擇行程</p>'
        + '<a class="trip-error-link" href="setting.html">前往設定頁</a>'
        + '</div>';
}

/* ===== Skeleton + Slot Rendering ===== */
function createSkeleton(dayIds) {
    var html = '';
    dayIds.forEach(function(id) {
        html += '<section class="day-section" data-day="' + id + '">';
        html += '<div class="day-header info-header" id="day' + id + '"><h2>Day ' + id + '</h2></div>';
        html += '<div class="day-content" id="day-slot-' + id + '">';
        html += '<div class="slot-loading">' + iconSpan('hourglass') + ' 載入中...</div>';
        html += '</div></section>';
    });
    html += '<div id="footer-slot"></div>';
    return html;
}


function renderNavSlot(meta, dayIds) {
    document.title = meta.meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && meta.meta.description) metaDesc.setAttribute('content', meta.meta.description);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.meta.title);
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && meta.meta.ogDescription) ogDesc.setAttribute('content', meta.meta.ogDescription);
    var navHtml = '';
    dayIds.forEach(function(id) {
        navHtml += '<button class="dn" data-day="' + id + '" data-action="switch-day" data-target="day' + id + '">' + id + '</button>';
    });
    document.getElementById('navPills').innerHTML = navHtml;
}

function renderFooterSlot(meta) {
    var el = document.getElementById('footer-slot');
    if (!el) return;
    var f = meta.footer;
    var html = '<footer>';
    html += '<h3>' + escHtml(f.title) + '</h3>';
    html += '<p>' + escHtml(f.dates) + '</p>';
    if (f.budget) html += '<p class="footer-budget">' + escHtml(f.budget) + '</p>';
    if (f.exchangeNote) html += '<p class="footer-exchange">' + escHtml(f.exchangeNote) + '</p>';
    html += '<p>' + escHtml(f.tagline) + '</p>';
    html += '</footer>';
    el.innerHTML = html;
}


function renderDaySlot(day) {
    var slotId = 'day-slot-' + day.id;
    var el = document.getElementById(slotId);
    if (!el) return;
    var section = el.closest('.day-section');
    if (section) {
        var header = section.querySelector('.day-header');
        if (header) {
            header.innerHTML = '<h2>Day ' + day.id + ' ' + escHtml(day.label || '') + '</h2>'
                + '<span class="dh-date">' + escHtml(formatDayDate(day)) + '</span>';
        }
    }
    var html = '';
    if (typeof day.content === 'string') {
        html = stripInlineHandlers(day.content || '');
    } else {
        var warnings = validateDay(day);
        if (warnings.length) html += renderWarnings(warnings);
        var weatherId = day.weather ? 'hourly-' + day.id : null;
        html += renderDayContent(day.content || {}, weatherId);
    }
    el.innerHTML = html;
}

function fetchDay(dayId) {
    fetch(DIST_PATH + 'day-' + dayId + '.json')
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(day) {
            dayCache[dayId] = day;
            TRIP.days[dayId - 1] = day;
            renderDaySlot(day);
            initAria();
            if (day.weather) fetchWeatherForDay(day);
            tryRenderDrivingStats();
            renderInfoPanel({ autoScrollDates: TRIP.autoScrollDates, days: TRIP.days });
        })
        .catch(function() {
            var el = document.getElementById('day-slot-' + dayId);
            if (el) el.innerHTML = '<div class="slot-error">' + iconSpan('warning') + ' ' + escHtml('Day ' + dayId + ' 載入失敗') + '</div>';
        });
}

function tryRenderDrivingStats() {
    if (!TRIP || !TRIP.days) return;
    var allLoaded = TRIP.days.every(function(d) { return d && d.content; });
    if (!allLoaded) return;
    var tripStats = calcTripDrivingStats(TRIP.days);
    if (tripStats) {
        TRIP.driving = { title: '全旅程交通統計', content: tripStats };
    }
}

function loadTrip(slug) {
    TRIP = {};
    dayCache = {};
    weatherCache = {};
    DIST_PATH = 'data/dist/' + slug + '/';

    if (!/^[\w-]+$/.test(slug)) {
        document.getElementById('tripContent').innerHTML = '<div class="trip-error">\u274c \u7121\u6548\u7684\u884c\u7a0b\u6a94\u8def\u5f91</div>';
        return;
    }

    setUrlTrip(slug);
    saveTripPref(slug);

    fetch(DIST_PATH + 'index.json')
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(manifest) {
            return fetch(DIST_PATH + 'meta.json')
                .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(function(meta) {
                    TRIP.meta = meta.meta;
                    TRIP.footer = meta.footer;
                    TRIP.autoScrollDates = meta.autoScrollDates;

                    if (meta.autoScrollDates && meta.autoScrollDates.length) {
                        tripStart = meta.autoScrollDates[0];
                        tripEnd = meta.autoScrollDates[meta.autoScrollDates.length - 1];
                    }

                    var dayIds = manifest
                        .filter(function(k) { return k.indexOf('day-') === 0; })
                        .map(function(k) { return parseInt(k.replace('day-', '')); })
                        .sort(function(a, b) { return a - b; });
                    TRIP.days = dayIds.map(function(id) { return { id: id }; });

                    document.getElementById('tripContent').innerHTML = createSkeleton(dayIds);
                    renderNavSlot(meta, dayIds);
                    renderFooterSlot(meta);
                    initAria();
                    alignStickyNav();
                    initNavOverflow();
                    renderInfoPanel({ autoScrollDates: meta.autoScrollDates, days: TRIP.days });

                    var fab = document.getElementById('editFab');
                    if (fab) fab.href = 'edit.html?trip=' + encodeURIComponent(slug);

                    var infoKeys = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'];
                    infoKeys.forEach(function(key) {
                        if (manifest.indexOf(key) === -1) return;
                        fetch(DIST_PATH + key + '.json')
                            .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                            .then(function(data) { TRIP[key] = data; })
                            .catch(function() { console.warn(key + ' 載入失敗'); });
                    });

                    var hash = window.location.hash.replace('#', '');
                    var hashDay = hash && hash.match(/^day(\d+)$/);
                    var initialDay = dayIds[0] || 1;
                    if (hashDay && dayIds.indexOf(parseInt(hashDay[1])) !== -1) {
                        initialDay = parseInt(hashDay[1]);
                    } else if (meta.autoScrollDates) {
                        var todayStr = new Date().toISOString().split('T')[0];
                        var idx = meta.autoScrollDates.indexOf(todayStr);
                        if (idx >= 0 && dayIds[idx]) initialDay = dayIds[idx];
                    }
                    switchDay(initialDay);
                    initNavTracking();
                    // Preload remaining days in background for stats & driving
                    dayIds.forEach(function(id) { if (id !== initialDay && !dayCache[id]) fetchDay(id); });
                });
        })
        .catch(function() {
            lsRemove('trip-pref');
            document.getElementById('tripContent').innerHTML = '<div class="trip-error">'
                + '<p>行程不存在：' + escHtml(slug) + '</p>'
                + '<a class="trip-error-link" href="setting.html">選擇其他行程</a>'
                + '</div>';
        });
}

/* ===== Info Panel (desktop right sidebar) ===== */
function renderCountdown(autoScrollDates) {
    if (!autoScrollDates || !autoScrollDates.length) return '';
    var start = autoScrollDates[0];
    var end = autoScrollDates[autoScrollDates.length - 1];
    var today = new Date(); today.setHours(0,0,0,0);
    var startDate = new Date(start + 'T00:00:00');
    var endDate = new Date(end + 'T00:00:00');
    var html = '<div class="info-card countdown-card">';
    if (today < startDate) {
        var diff = Math.ceil((startDate - today) / 86400000);
        html += '<div class="countdown-number">' + diff + '</div>';
        html += '<div class="countdown-label">天後出發</div>';
        html += '<div class="countdown-date">' + escHtml(start) + '</div>';
    } else if (today <= endDate) {
        var dayN = Math.floor((today - startDate) / 86400000) + 1;
        html += '<div class="countdown-number">Day ' + dayN + '</div>';
        html += '<div class="countdown-label">旅行進行中</div>';
    } else {
        html += '<div class="countdown-number">' + iconSpan('plane') + '</div>';
        html += '<div class="countdown-label">旅程已結束</div>';
    }
    html += '</div>';
    return html;
}

function renderTripStatsCard(data) {
    var html = '<div class="info-card stats-card">';
    html += '<div class="stats-card-title">行程統計</div>';
    // Total days
    html += '<div class="stats-row"><span class="stats-label">天數</span><span class="stats-value">' + data.days.length + ' 天</span></div>';
    // Total spots
    var spots = 0;
    data.days.forEach(function(day) {
        var tl = (day.content || {}).timeline;
        if (tl) spots += tl.length;
    });
    html += '<div class="stats-row"><span class="stats-label">景點數</span><span class="stats-value">' + spots + ' 個</span></div>';
    // Transport summary by type
    var tripStats = calcTripDrivingStats(data.days);
    if (tripStats && tripStats.grandByType) {
        var typeOrder = ['car', 'train', 'walking'];
        typeOrder.forEach(function(emoji) {
            var g = tripStats.grandByType[emoji];
            if (!g) return;
            html += '<div class="stats-row"><span class="stats-label">' + iconSpan(g.icon) + ' ' + escHtml(g.label) + '</span><span class="stats-value">' + escHtml(formatMinutes(g.totalMinutes)) + '</span></div>';
        });
    }
    // Total budget
    var totalBudget = 0;
    var currency = '';
    data.days.forEach(function(day) {
        var budget = (day.content || {}).budget;
        if (budget && budget.items) {
            budget.items.forEach(function(item) { totalBudget += (item.amount || 0); });
            if (!currency && budget.currency) currency = budget.currency;
        }
    });
    if (totalBudget > 0) {
        html += '<div class="stats-row"><span class="stats-label">預估預算</span><span class="stats-value">' + escHtml(currency + ' ' + totalBudget.toLocaleString()) + '</span></div>';
    }
    html += '</div>';
    return html;
}

function renderInfoPanel(data) {
    var panel = document.getElementById('infoPanel');
    if (!panel) return;
    var html = '';
    html += renderCountdown(data.autoScrollDates);
    html += renderTripStatsCard(data);
    panel.innerHTML = html;
}

/* ===== Info Bottom Sheet (mobile) ===== */
function openInfoSheet() {
    var backdrop = document.getElementById('infoBottomSheet');
    if (!backdrop) return;
    var panel = document.getElementById('infoSheet');
    // Reset to default 50dvh
    if (panel) panel.style.height = '';
    backdrop.classList.add('open');
}
function closeInfoSheet() {
    var backdrop = document.getElementById('infoBottomSheet');
    if (!backdrop) return;
    backdrop.classList.remove('open');
}

(function initInfoSheet() {
    var backdrop = document.getElementById('infoBottomSheet');
    if (!backdrop) return;

    backdrop.addEventListener('click', closeInfoSheet);
    // Block scroll on backdrop (touch + mouse wheel)
    backdrop.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
    backdrop.addEventListener('wheel', function(e) {
        e.preventDefault();
    }, { passive: false });

    var panel = document.getElementById('infoSheet');
    if (!panel) return;
    panel.addEventListener('click', function(e) { e.stopPropagation(); });

    // Allow scrolling inside sheet body but block scroll passthrough to page
    var sheetBody = panel.querySelector('.info-sheet-body');
    if (sheetBody) {
        sheetBody.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: true });
        sheetBody.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: true });
    }

    // X close button
    var closeBtn = document.getElementById('sheetCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeInfoSheet);

    // Drag handle to resize / close
    var handle = panel.querySelector('.sheet-handle');
    var header = panel.querySelector('.sheet-header');
    var _dragStartY = 0;
    var _dragStartH = 0;
    var _dragging = false;
    var maxH = function() { return window.innerHeight * 0.75; };
    var minH = function() { return window.innerHeight * 0.25; };

    function onDragStart(y) {
        _dragging = true;
        _dragStartY = y;
        _dragStartH = panel.offsetHeight;
        panel.classList.add('dragging');
    }
    function onDragMove(y) {
        if (!_dragging) return;
        var delta = _dragStartY - y; // positive = drag up
        var newH = Math.min(Math.max(_dragStartH + delta, 0), maxH());
        panel.style.height = newH + 'px';
    }
    function onDragEnd() {
        if (!_dragging) return;
        _dragging = false;
        panel.classList.remove('dragging');
        // Close if dragged below 25vh
        if (panel.offsetHeight < minH()) {
            panel.style.height = '';
            closeInfoSheet();
        }
    }

    // Touch events on handle + header
    [handle, header].forEach(function(el) {
        if (!el) return;
        el.addEventListener('touchstart', function(e) {
            onDragStart(e.touches[0].clientY);
        }, { passive: true });
        el.addEventListener('touchmove', function(e) {
            if (_dragging) {
                e.preventDefault();
                onDragMove(e.touches[0].clientY);
            }
        }, { passive: false });
        el.addEventListener('touchend', onDragEnd, { passive: true });
    });
})();

/* ===== Speed Dial ===== */
function toggleSpeedDial() {
    var dial = document.getElementById('speedDial');
    if (dial) dial.classList.toggle('open');
}
function closeSpeedDial() {
    var dial = document.getElementById('speedDial');
    if (dial) dial.classList.remove('open');
}
var DIAL_RENDERERS = {
    flights: renderFlights, checklist: renderChecklist,
    backup: renderBackup, emergency: renderEmergency,
    suggestions: renderSuggestions, driving: renderTripDrivingStats
};
function openSpeedDialContent(contentKey) {
    closeSpeedDial();
    if (!TRIP) return;
    var sheetBody = document.getElementById('bottomSheetBody');
    var sheetTitle = document.getElementById('sheetTitle');
    if (!sheetBody) return;
    var html = '';
    var section = TRIP[contentKey];
    var fn = DIAL_RENDERERS[contentKey];
    if (section && section.content && fn) {
        if (sheetTitle) sheetTitle.textContent = section.title || '';
        html = fn(section.content);
    } else {
        if (sheetTitle) sheetTitle.textContent = '';
    }
    sheetBody.innerHTML = html || '<p style="color:var(--gray);text-align:center;">無相關資料</p>';
    openInfoSheet();
}

(function initSpeedDial() {
    var trigger = document.getElementById('speedDialTrigger');
    if (trigger) trigger.addEventListener('click', toggleSpeedDial);
    var backdrop = document.getElementById('speedDialBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeSpeedDial);
})();

function scrollNavPillIntoView(btn) {
    var nav = btn.closest('.dh-nav');
    if (!nav) return;
    var left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
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
    if (arrow) arrow.textContent = isOpen ? ARROW_COLLAPSE : ARROW_EXPAND;
}
function toggleDark() {
    toggleDarkShared();
}
var _manualScrollTs = 0;
function scrollToSec(id) {
    var el = document.getElementById(id);
    if (!el) return;
    _manualScrollTs = Date.now();
    var nav = document.getElementById('stickyNav');
    var navH = nav.offsetHeight;
    var navTop = parseFloat(getComputedStyle(nav).top) || 0;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH - navTop;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + id);
}
function switchDay(dayId) {
    // Ensure target day is loaded
    if (!dayCache[dayId]) fetchDay(dayId);
    // Scroll to the day header
    var header = document.getElementById('day' + dayId);
    if (header) {
        _manualScrollTs = Date.now();
        header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Update pill + hash
    var pills = document.querySelectorAll('#stickyNav .dh-nav .dn[data-day]');
    pills.forEach(function(btn) { btn.classList.toggle('active', parseInt(btn.getAttribute('data-day')) === dayId); });
    var activeBtn = document.querySelector('#stickyNav .dh-nav .dn.active');
    if (activeBtn) scrollNavPillIntoView(activeBtn);
    history.replaceState(null, '', '#day' + dayId);
}
function toggleHw(el) {
    var p = el.closest('.hourly-weather');
    p.classList.toggle('hw-open');
    var isOpen = p.classList.contains('hw-open');
    var arrow = el.querySelector('.hw-summary-arrow');
    if (arrow) arrow.textContent = isOpen ? ARROW_COLLAPSE : ARROW_EXPAND;
    if (isOpen) {
        var g = p.querySelector('.hw-grid');
        if (g) { var now = new Date().getHours(), tb = g.querySelector('.hw-now') || g.querySelector('[data-hour="' + Math.max(6, Math.min(21, now)) + '"]'); if (tb) g.scrollLeft = tb.offsetLeft - g.offsetLeft; }
    }
}
function togglePrint() {
    var entering = !document.body.classList.contains('print-mode');
    if (entering && document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
    }
    document.body.classList.toggle('print-mode');
    if (entering && TRIP && TRIP.days) {
        TRIP.days.forEach(function(d) { if (!dayCache[d.id]) fetchDay(d.id); });
    }
    if (!entering && document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
    }
}

/* ===== Switch Trip File ===== */
function switchTripFile() {
    window.location.href = 'setting.html';
}

/* ===== ARIA Init ===== */
function initAria() {
    document.querySelectorAll('.col-row').forEach(function(el) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-expanded', 'false');
    });

}

/* ===== Sticky Nav Alignment (dynamic scroll-margin) ===== */
function alignStickyNav() {
    var nav = document.getElementById('stickyNav');
    if (!nav) return;
    var navH = nav.offsetHeight;
    var navTop = parseFloat(getComputedStyle(nav).top) || 0;
    var margin = (navH + navTop + 4) + 'px';
    document.querySelectorAll('.day-header, .info-header').forEach(function(h) {
        h.style.scrollMarginTop = margin;
    });
}
var _alignNavTicking = false;
window.addEventListener('resize', function() {
    if (!_alignNavTicking) {
        requestAnimationFrame(function() { alignStickyNav(); _alignNavTicking = false; });
        _alignNavTicking = true;
    }
});

/* ===== Day Nav Active Pill + Sticky Nav Update ===== */
function initNavTracking() {
    var headers = [];
    if (!TRIP) return;
    for (var i = 1; i <= TRIP.days.length; i++) { var h = document.getElementById('day' + i); if (h) headers.push(h); }
    var navPills = document.querySelectorAll('#stickyNav .dh-nav .dn[data-day]');
    if (!navPills.length) return;
    var nav = document.getElementById('stickyNav');
    var navH = nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0);
    // Remove old listener if any
    if (window._navScrollHandler) window.removeEventListener('scroll', window._navScrollHandler);
    var ticking = false;
    window._navScrollHandler = function() {
        if (!ticking) { requestAnimationFrame(function() {
            var rects = headers.map(function(h) { return h.getBoundingClientRect().top; });
            var current = -1;
            for (var i = 0; i < rects.length; i++) { if (rects[i] <= navH + 10) current = i; }
            navPills.forEach(function(btn) { btn.classList.toggle('active', current >= 0 && parseInt(btn.getAttribute('data-day')) === current + 1); });
            var activeBtn = document.querySelector('#stickyNav .dh-nav .dn.active');
            if (activeBtn) scrollNavPillIntoView(activeBtn);
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


/* ===== Nav Pills Overflow: Arrows & Gradient Masks ===== */
function initNavOverflow() {
    var wrap = document.getElementById('navWrap');
    var nav = document.getElementById('navPills');
    var arrowL = document.getElementById('navArrowL');
    var arrowR = document.getElementById('navArrowR');
    if (!wrap || !nav || !arrowL || !arrowR) return;

    // Clean up previous listeners
    if (window._navOverflowCleanup) window._navOverflowCleanup();

    function updateNavOverflow() {
        var canScrollLeft = nav.scrollLeft > 2;
        var canScrollRight = nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 2;
        wrap.classList.toggle('can-scroll-left', canScrollLeft);
        wrap.classList.toggle('can-scroll-right', canScrollRight);
        arrowL.setAttribute('aria-hidden', canScrollLeft ? 'false' : 'true');
        arrowR.setAttribute('aria-hidden', canScrollRight ? 'false' : 'true');
    }

    function scrollNavPage(dir) {
        var pageWidth = nav.clientWidth;
        nav.scrollBy({ left: dir * pageWidth, behavior: 'smooth' });
    }

    function onClickL() { scrollNavPage(-1); }
    function onClickR() { scrollNavPage(1); }

    arrowL.addEventListener('click', onClickL);
    arrowR.addEventListener('click', onClickR);
    nav.addEventListener('scroll', updateNavOverflow, { passive: true });

    if (window._navOverflowResizeObserver) window._navOverflowResizeObserver.disconnect();
    if (window.ResizeObserver) {
        window._navOverflowResizeObserver = new ResizeObserver(updateNavOverflow);
        window._navOverflowResizeObserver.observe(nav);
    }
    window.addEventListener('resize', updateNavOverflow, { passive: true });

    window._navOverflowCleanup = function() {
        arrowL.removeEventListener('click', onClickL);
        arrowR.removeEventListener('click', onClickR);
        nav.removeEventListener('scroll', updateNavOverflow);
        window.removeEventListener('resize', updateNavOverflow);
        if (window._navOverflowResizeObserver) {
            window._navOverflowResizeObserver.disconnect();
            window._navOverflowResizeObserver = null;
        }
    };

    updateNavOverflow();
}

/* ===== Auto-scroll to today ===== */
function autoScrollToday(dates) {
    if (!dates || !dates.length) return;
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    var idx = dates.indexOf(todayStr);
    if (idx >= 0) {
        switchDay(idx + 1);
    }
}

/* ===== Central Event Delegation ===== */
document.addEventListener('click', function(e) {
    var t = e.target;

    // 1. data-action buttons (nav, toggles) — menu handled by menu.js
    var actionEl = t.closest('[data-action]');
    if (actionEl) {
        switch (actionEl.getAttribute('data-action')) {
            case 'scroll-to':  scrollToSec(actionEl.getAttribute('data-target')); break;
            case 'switch-day': switchDay(parseInt(actionEl.getAttribute('data-day'))); break;
            case 'toggle-dark': toggleDark(); break;
            case 'toggle-print': togglePrint(); break;
            case 'switch-trip': switchTripFile(); break;
            case 'toggle-hw':  toggleHw(actionEl); break;
            case 'speed-dial-item': openSpeedDialContent(actionEl.getAttribute('data-content')); break;
        }
        return;
    }

    // 2. Collapsible row expand/collapse (from JSON content)
    var colRow = t.closest('.col-row');
    if (colRow) {
        if (t.tagName === 'A' || t.closest('a')) return;
        toggleCol(colRow);
    }
});

/* ===== Hourly Weather API (Open-Meteo) ===== */
var WMO={0:'weather-clear',1:'weather-sun-cloud',2:'weather-partly',3:'weather-cloudy',45:'weather-fog',48:'weather-fog',51:'weather-rain-sun',53:'weather-rain-sun',55:'weather-rain',56:'weather-rain',57:'weather-rain',61:'weather-rain-sun',63:'weather-rain',65:'weather-rain',66:'weather-rain',67:'weather-rain',71:'weather-snow',73:'weather-snow',75:'weather-snow',77:'weather-snow',80:'weather-rain-sun',81:'weather-rain',82:'weather-rain',85:'weather-snow',86:'weather-snow',95:'weather-thunder',96:'weather-thunder',99:'weather-thunder'};

function getLocIdx(day,h){for(var i=day.locations.length-1;i>=0;i--)if(h>=day.locations[i].start)return i;return 0;}

function renderHourly(c,m,day){
    var now=new Date(),ch=now.getHours();
    var minT=99,maxT=-99,minR=100,maxR=0,iconCount={},bestIcon='weather-clear';
    for(var h=0;h<24;h++){var t=Math.round(m.temps[h]),r=m.rains[h],ic=WMO[m.codes[h]]||'question';if(t<minT)minT=t;if(t>maxT)maxT=t;if(r<minR)minR=r;if(r>maxR)maxR=r;iconCount[ic]=(iconCount[ic]||0)+1;}
    var maxCnt=0;for(var k in iconCount)if(iconCount[k]>maxCnt){maxCnt=iconCount[k];bestIcon=k;}
    var locs=day.locations.map(function(l){return escHtml(l.name);}).filter(function(v,i,a){return a.indexOf(v)===i;}).join('→');
    var html='<div class="hw-summary" data-action="toggle-hw">'+iconSpan(bestIcon)+' '+minT+'~'+maxT+'°C &nbsp;・&nbsp; '+iconSpan('raindrop')+minR+'~'+maxR+'% &nbsp;・&nbsp; '+locs+'<span class="hw-summary-arrow">＋</span></div>';
    html+='<div class="hw-detail"><div class="hourly-weather-header"><span class="hourly-weather-title">'+iconSpan('timer')+' 7日內預報 — '+escHtml(day.label)+'</span><span class="hw-update-time">'+ch+':'+String(now.getMinutes()).padStart(2,'0')+'</span></div><div class="hw-grid">';
    for(var h=0;h<=23;h++){
        var li=getLocIdx(day,h),wIcon=WMO[m.codes[h]]||'question',temp=Math.round(m.temps[h]),rain=m.rains[h],isNow=(h===ch);
        html+='<div class="hw-block'+(isNow?' hw-now':'')+'" data-hour="'+h+'"><div class="hw-block-time">'+(isNow?'▶ ':'')+h+':00</div>';
        if(day.locations.length>1)html+='<div class="hw-block-loc hw-loc-'+li+'">'+escHtml(day.locations[li].name)+'</div>';
        html+='<div class="hw-block-icon">'+iconSpan(wIcon)+'</div><div class="hw-block-temp">'+temp+'°C</div><div class="hw-block-rain'+(rain>=50?' hw-rain-high':'')+'">'+iconSpan('raindrop')+rain+'%</div></div>';
    }
    html+='</div></div>';c.innerHTML=html;
    var nowBlock=c.querySelector('.hw-now');
    if(nowBlock){var grid=c.querySelector('.hw-grid');if(grid)grid.scrollLeft=nowBlock.offsetLeft-grid.offsetLeft;}
}

function makeDefaultMg(){var mg={temps:[],rains:[],codes:[]};for(var h=0;h<24;h++){mg.temps.push(0);mg.rains.push(0);mg.codes.push(0);}return mg;}

function toDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function fetchWeatherForDay(day) {
    if (!day.weather || !day.weather.locations || !day.weather.locations.length) return;
    var dayDate = day.date;
    if (!dayDate || dayDate.indexOf('-') === -1) return;

    // Check if day.date is within forecast range (today ~ today+16)
    var todayD = new Date(); todayD.setHours(0,0,0,0);
    var limitD = new Date(todayD.getTime() + 16*86400000);
    var fetchStart = tripStart && tripStart > toDateStr(todayD) ? tripStart : toDateStr(todayD);
    var fetchEnd = tripEnd && tripEnd < toDateStr(limitD) ? tripEnd : toDateStr(limitD);
    if (dayDate > fetchEnd || dayDate < fetchStart) {
        var c = document.getElementById('hourly-' + day.id);
        if (c) renderHourly(c, makeDefaultMg(), day.weather);
        return;
    }

    // Collect unique coordinates for this day
    var locKeys = [];
    day.weather.locations.forEach(function(l) {
        var k = l.lat + ',' + l.lon;
        if (locKeys.indexOf(k) === -1) locKeys.push(k);
    });

    // Fetch missing coordinates, use cache for hits
    Promise.all(locKeys.map(function(k) {
        if (weatherCache[k]) return Promise.resolve({ key: k, data: weatherCache[k] });
        var parts = k.split(',');
        var params = new URLSearchParams({ latitude: parts[0], longitude: parts[1], hourly: 'temperature_2m,precipitation_probability,weather_code', start_date: fetchStart, end_date: fetchEnd, timezone: 'Asia/Tokyo' });
        return fetch('https://api.open-meteo.com/v1/forecast?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(d) { weatherCache[k] = d; return { key: k, data: d }; });
    })).then(function(results) {
        var cache = {};
        results.forEach(function(r) { cache[r.key] = r.data; });
        var c = document.getElementById('hourly-' + day.id);
        if (!c) return;
        var sample = cache[locKeys[0]];
        if (!sample || !sample.hourly) { renderHourly(c, makeDefaultMg(), day.weather); return; }
        var dayOffset = sample.hourly.time.indexOf(dayDate + 'T00:00');
        if (dayOffset < 0) { renderHourly(c, makeDefaultMg(), day.weather); return; }
        var mg = { temps: [], rains: [], codes: [] };
        for (var h = 0; h < 24; h++) {
            var li = getLocIdx(day.weather, h), l = day.weather.locations[li], d = cache[l.lat + ',' + l.lon];
            var idx = dayOffset + h;
            if (d && d.hourly && idx < d.hourly.temperature_2m.length) {
                mg.temps.push(d.hourly.temperature_2m[idx]);
                mg.rains.push(d.hourly.precipitation_probability[idx]);
                mg.codes.push(d.hourly.weather_code[idx]);
            } else { mg.temps.push(0); mg.rains.push(0); mg.codes.push(0); }
        }
        renderHourly(c, mg, day.weather);
    }).catch(function(e) {
        var c = document.getElementById('hourly-' + day.id);
        if (c) c.innerHTML = '<div class="hw-error">天氣資料載入失敗：' + escHtml(e.message) + '</div>';
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

// Initial load — resolve from URL → localStorage → default
resolveAndLoad();

/* ===== Module Exports (Node.js / Vitest only) ===== */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        safeColor: safeColor,
        renderMapLinks: renderMapLinks,
        renderNavLinks: renderNavLinks,
        renderBlogLink: renderBlogLink,
        renderRestaurant: renderRestaurant,
        renderShop: renderShop,
        renderInfoBox: renderInfoBox,
        renderTimelineEvent: renderTimelineEvent,
        renderTimeline: renderTimeline,
        renderHotel: renderHotel,
        renderDayContent: renderDayContent,
        renderFlights: renderFlights,
        renderChecklist: renderChecklist,
        renderBackup: renderBackup,
        renderEmergency: renderEmergency,
        renderSuggestions: renderSuggestions,
        calcDrivingStats: calcDrivingStats,
        renderDrivingStats: renderDrivingStats,
        calcTripDrivingStats: calcTripDrivingStats,
        renderTripDrivingStats: renderTripDrivingStats,
        renderWarnings: renderWarnings,
        validateTripData: validateTripData,
        validateDay: validateDay,
        fileToSlug: fileToSlug,
        slugToFile: slugToFile,
        APPLE_SVG: APPLE_SVG,
        TRANSPORT_TYPES: TRANSPORT_TYPES,
        formatMinutes: formatMinutes,
        renderCountdown: renderCountdown,
        renderTripStatsCard: renderTripStatsCard,
        loadTrip: loadTrip,
        resolveAndLoad: resolveAndLoad,
        createSkeleton: createSkeleton,
        WMO: WMO,
        getLocIdx: getLocIdx,
        renderHourly: renderHourly,
        makeDefaultMg: makeDefaultMg,
        toDateStr: toDateStr,
        fetchWeatherForDay: fetchWeatherForDay
    };
}
