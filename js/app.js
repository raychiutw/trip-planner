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

/* ===== Render: Restaurant ===== */
function renderRestaurant(r) {
    var html = '<div class="restaurant-choice">';
    var nameHtml = escHtml(r.name);
    var rUrl = escUrl(r.url);
    if (rUrl) nameHtml = '<a href="' + rUrl + '" target="_blank" rel="noopener noreferrer">' + nameHtml + '</a>';
    html += (r.category ? '<strong>' + escHtml(r.category) + '：</strong>' : '')
          + nameHtml;
    if (r.desc) html += ' — ' + escHtml(r.desc);
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
    var blogUrl = escUrl(r.blogUrl);
    if (blogUrl) {
        if (meta) meta += ' ｜ ';
        meta += iconSpan('document') + ' <a href="' + blogUrl + '" target="_blank" rel="noopener noreferrer">網誌推薦</a>';
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
            var rCount = box.restaurants ? box.restaurants.length : 0;
            var rTitle = box.title || (rCount > 1 ? (rCount + '選一') : '推薦餐廳');
            html += iconSpan('utensils') + ' <strong>' + escHtml(rTitle) + '：</strong>';
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
    var html = '<div class="tl-event expanded">';
    var headCls = 'tl-head';
    html += '<div class="' + headCls + '">';
    html += '<span class="tl-time">' + escHtml(ev.time || '') + '</span>';
    html += '<span class="tl-title">';
    var titleUrl = escUrl(ev.titleUrl);
    if (titleUrl) {
        html += '<a href="' + titleUrl + '" target="_blank" rel="noopener noreferrer">' + escHtml(ev.title) + '</a>';
    } else {
        html += escHtml(ev.title || '');
    }
    html += '</span>';
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
    html += '<div class="col-row">' + iconSpan('hotel') + ' ' + nameHtml + ' <span class="arrow">＋</span></div>';
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
    html += '<div class="col-row">' + iconSpan('wallet') + ' ' + escHtml(budget.summary || '') + ' <span class="arrow">＋</span></div>';
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
        budget.notes.forEach(function(n) { html += '<li><span class="list-icon">' + iconSpan('pin') + '</span>' + escHtml(n) + '</li>'; });
        html += '</ul>';
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
    timeline.forEach(function(ev) {
        if (!ev.transit) return;
        var t = ev.transit;
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

function renderDrivingStats(stats) {
    if (!stats) return '';
    var isWarning = stats.drivingMinutes > 120;
    var cls = isWarning ? 'driving-stats driving-stats-warning' : 'driving-stats';
    var dsIcon = isWarning ? iconSpan('warning') : iconSpan('bus');
    var html = '<div class="' + cls + '">';
    html += '<div class="col-row" role="button" aria-expanded="false">' + dsIcon + ' 當日交通：' + escHtml(formatMinutes(stats.totalMinutes));
    if (isWarning) html += ' <span class="driving-stats-badge">超過 2 小時</span>';
    html += ' <span class="arrow">＋</span></div>';
    html += '<div class="col-detail">';
    var typeOrder = ['car', 'train', 'walking'];
    typeOrder.forEach(function(emoji) {
        var group = stats.byType[emoji];
        if (!group) return;
        html += '<div class="transport-type-group">';
        html += '<div class="transport-type-label">' + iconSpan(group.icon) + ' ' + escHtml(group.label) + '：' + escHtml(formatMinutes(group.totalMinutes)) + '</div>';
        html += '<div class="driving-stats-detail">';
        group.segments.forEach(function(seg) {
            html += '<span class="driving-stats-seg">' + iconSpan(group.icon) + ' ' + escHtml(seg.text) + '</span>';
        });
        html += '</div></div>';
    });
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
            dayStats.push({ dayId: day.id, date: day.date, label: 'Day ' + day.id, stats: stats });
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
    html += '<div class="col-row" role="button" aria-expanded="false">' + iconSpan('bus') + ' 全旅程交通統計：' + escHtml(formatMinutes(tripStats.grandTotal)) + ' <span class="arrow">＋</span></div>';
    html += '<div class="col-detail">';
    // Type summary
    var typeOrder = ['car', 'train', 'walking'];
    typeOrder.forEach(function(emoji) {
        var g = tripStats.grandByType[emoji];
        if (!g) return;
        html += '<div class="transport-type-summary">' + iconSpan(g.icon) + ' ' + escHtml(g.label) + '：' + escHtml(formatMinutes(g.totalMinutes)) + '</div>';
    });
    // Per-day breakdown
    tripStats.days.forEach(function(d) {
        var isWarning = d.stats.drivingMinutes > 120;
        html += '<div class="driving-summary-day' + (isWarning ? ' driving-stats-warning' : '') + '">';
        html += '<div class="col-row" role="button" aria-expanded="false"><strong>' + escHtml(d.label) + '（' + escHtml(d.date) + '）</strong>：' + escHtml(formatMinutes(d.stats.totalMinutes));
        if (isWarning) html += ' <span class="driving-stats-badge">超過 2 小時</span>';
        html += ' <span class="arrow">＋</span></div>';
        html += '<div class="col-detail">';
        typeOrder.forEach(function(emoji) {
            var group = d.stats.byType[emoji];
            if (!group) return;
            html += '<div class="transport-type-group">';
            html += '<div class="transport-type-label">' + iconSpan(group.icon) + ' ' + escHtml(group.label) + '：' + escHtml(formatMinutes(group.totalMinutes)) + '</div>';
            html += '<div class="driving-stats-detail">';
            group.segments.forEach(function(seg) {
                html += '<span class="driving-stats-seg">' + iconSpan(group.icon) + ' ' + escHtml(seg.text) + '</span>';
            });
            html += '</div></div>';
        });
        html += '</div></div>';
    });
    html += '</div></div>';
    return html;
}

/* ===== Render: Day Content ===== */
function renderDayContent(content, weatherId) {
    var html = '';
    if (weatherId) {
        html += '<div class="hourly-weather" id="' + escHtml(weatherId) + '"><div class="hw-loading">' + iconSpan('hourglass') + ' 正在載入逐時天氣預報...</div></div>';
    }
    if (content.hotel) html += renderHotel(content.hotel);
    if (content.timeline) {
        var stats = calcDrivingStats(content.timeline);
        html += renderDrivingStats(stats);
    }
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
            if (card.desc) html += '<p>' + escHtml(card.desc) + '</p>';
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
    else if (!data.meta.title) errors.push('meta 缺少 title');

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

    if (!data.weather || !Array.isArray(data.weather) || data.weather.length === 0)
        errors.push('缺少 weather 或為空');
    if (!data.autoScrollDates || !Array.isArray(data.autoScrollDates) || data.autoScrollDates.length === 0)
        errors.push('缺少 autoScrollDates 或為空');
    if (!data.footer) errors.push('缺少 footer');
    else {
        if (!data.footer.title) errors.push('footer 缺少 title');
        if (!data.footer.dates) errors.push('footer 缺少 dates');
    }

    // --- Recursive walk for warnings ---
    var URL_FIELDS = ['titleUrl', 'url', 'googleQuery', 'appleQuery', 'reservationUrl', 'blogUrl', 'reserve'];
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

    // --- Weather lat/lon type check ---
    if (Array.isArray(data.weather)) {
        data.weather.forEach(function(w, i) {
            if (Array.isArray(w.locations)) {
                w.locations.forEach(function(loc, j) {
                    if (typeof loc.lat !== 'number') warnings.push('weather[' + i + '].locations[' + j + '].lat 必須是 number');
                    if (typeof loc.lon !== 'number') warnings.push('weather[' + i + '].locations[' + j + '].lon 必須是 number');
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
    var html = '<div class="trip-warnings">';
    html += '<strong>' + iconSpan('warning') + ' 注意事項：</strong><ul>';
    warnings.forEach(function(w) { html += '<li>' + w + '</li>'; });
    html += '</ul></div>';
    return html;
}
// Renew all on page load
lsRenewAll();

/* ===== URL Routing ===== */
var DEFAULT_SLUG = 'okinawa-trip-2026-Ray';
function fileToSlug(f) { var m = f.match(/^data\/trips\/(.+)\.json$/); return m ? m[1] : null; }
function slugToFile(s) { return 'data/trips/' + s + '.json'; }
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
    // 2. localStorage has preference (6-month expiry)
    var saved = loadTripPref();
    if (saved) { loadTrip(slugToFile(saved)); return; }
    // 3. Default
    loadTrip(slugToFile(DEFAULT_SLUG));
}

function loadTrip(filename) {
    TRIP_FILE = filename;

    // Update URL + save preference
    var slug = fileToSlug(filename);
    if (slug) { setUrlTrip(slug); saveTripPref(slug); }

    // Only allow relative paths (prevent fetching external URLs)
    if (/^https?:\/\//i.test(filename) || filename.indexOf('..') !== -1) {
        document.getElementById('tripContent').innerHTML = '<div class="trip-error">\u274c \u7121\u6548\u7684\u884c\u7a0b\u6a94\u8def\u5f91</div>';
        return;
    }
    fetch(filename)
        .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(data) { TRIP = data; renderTrip(data); })
        .catch(function(e) {
            document.getElementById('tripContent').innerHTML = '<div class="trip-error">\u274c \u8f09\u5165\u5931\u6557\uff1a' + escHtml(filename) + '</div>';
        });
}

function renderTrip(data) {
    var safe = stripInlineHandlers;

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
        html += '<div class="day-header info-header" id="day' + id + '">'
              + '<h2>Day ' + id + ' ' + escHtml(day.label || '') + '</h2>'
              + '<span class="dh-date">' + escHtml(day.date) + '</span></div>';
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

    // Trip-wide driving stats (independent card)
    var tripDrivingStats = calcTripDrivingStats(data.days);
    if (tripDrivingStats) {
        html += '<section>';
        html += '<div class="day-header info-header" id="sec-driving"><h2>' + iconSpan('bus') + ' 交通統計</h2></div>';
        html += '<div class="day-content">' + renderTripDrivingStats(tripDrivingStats) + '</div>';
        html += '</section>';
    }

    // Footer
    html += '<footer>';
    html += '<h3>' + escHtml(data.footer.title) + '</h3>';
    html += '<p>' + escHtml(data.footer.dates) + '</p>';
    if (data.footer.budget) html += '<p class="footer-budget">' + escHtml(data.footer.budget) + '</p>';
    if (data.footer.exchangeNote) html += '<p class="footer-exchange">' + escHtml(data.footer.exchangeNote) + '</p>';
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

    // Dynamic scroll-margin for sticky nav offset
    alignStickyNav();

    // Re-init nav scroll tracking
    initNavTracking();

    // Init nav pills overflow arrows
    initNavOverflow();

    // Render info panel (desktop ≥1200px only)
    renderInfoPanel(data);

    // Update FAB link with current trip slug
    var fab = document.getElementById('editFab');
    if (fab) fab.href = 'edit.html?trip=' + encodeURIComponent(fileToSlug(TRIP_FILE));
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

function renderSuggestionSummaryCard(suggestions) {
    if (!suggestions || !suggestions.content || !suggestions.content.cards) return '';
    var counts = { high: 0, medium: 0, low: 0 };
    suggestions.content.cards.forEach(function(card) {
        var p = card.priority;
        if (p && counts.hasOwnProperty(p) && card.items) {
            counts[p] += card.items.length;
        }
    });
    var html = '<div class="info-card">';
    html += '<div class="info-label">建議摘要</div>';
    html += '<div class="sg-summary">';
    html += '<div class="sg-summary-row sg-priority-high">高優先：' + counts.high + ' 項</div>';
    html += '<div class="sg-summary-row sg-priority-medium">中優先：' + counts.medium + ' 項</div>';
    html += '<div class="sg-summary-row sg-priority-low">低優先：' + counts.low + ' 項</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function renderInfoPanel(data) {
    var panel = document.getElementById('infoPanel');
    if (!panel) return;
    // Only render if panel is visible (≥1200px)
    if (panel.offsetParent === null && panel.offsetWidth === 0) return;
    var html = '';
    html += renderCountdown(data.autoScrollDates);
    html += renderTripStatsCard(data);
    html += renderSuggestionSummaryCard(data.suggestions);
    panel.innerHTML = html;
}

function buildMenu(data) {
    var slug = (data && data.tripSlug) ? data.tripSlug : (lsGet('trip-pref') || '');
    var editUrl = slug ? 'edit.html?trip=' + encodeURIComponent(slug) : 'edit.html';

    // Drawer menu (mobile)
    var html = '';
    // 區段一：頁面切換
    html += '<a class="menu-item menu-item-current" href="index.html">' + iconSpan('plane') + ' 行程頁</a>';
    html += '<a class="menu-item" href="' + editUrl + '">' + iconSpan('pencil') + ' 編輯頁</a>';
    html += '<a class="menu-item" href="setting.html">' + iconSpan('gear') + ' 設定頁</a>';
    html += '<div class="menu-sep"></div>';
    // 區段二：功能跳轉
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-flight">' + iconSpan('plane') + ' 航班資訊</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-driving">' + iconSpan('bus') + ' 交通統計</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-checklist">' + iconSpan('check-circle') + ' 出發前確認</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-suggestions">' + iconSpan('lightbulb') + ' 行程建議</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-backup">' + iconSpan('refresh') + ' 颱風/雨天備案</button>';
    html += '<button class="menu-item" data-action="scroll-to" data-target="sec-emergency">' + iconSpan('emergency') + ' 緊急聯絡</button>';
    html += '<div class="menu-sep"></div>';
    html += '<button class="menu-item" data-action="toggle-print">' + iconSpan('printer') + ' 列印模式</button>';
    document.getElementById('menuGrid').innerHTML = html;

    // Sidebar menu (desktop)
    var sidebarNav = document.getElementById('sidebarNav');
    if (sidebarNav) {
        var sHtml = '';
        // 區段一：頁面切換
        sHtml += '<a class="menu-item menu-item-current" href="index.html" title="行程頁"><span class="item-icon">' + iconSpan('plane') + '</span><span class="item-label">行程頁</span></a>';
        sHtml += '<a class="menu-item" href="' + editUrl + '" title="編輯頁"><span class="item-icon">' + iconSpan('pencil') + '</span><span class="item-label">編輯頁</span></a>';
        sHtml += '<a class="menu-item" href="setting.html" title="設定頁"><span class="item-icon">' + iconSpan('gear') + '</span><span class="item-label">設定頁</span></a>';
        sHtml += '<div class="menu-sep"></div>';
        // 區段二：功能跳轉
        var navItems = [
            { icon: 'plane', label: '航班資訊', target: 'sec-flight' },
            { icon: 'bus', label: '交通統計', target: 'sec-driving' },
            { icon: 'check-circle', label: '出發前確認', target: 'sec-checklist' },
            { icon: 'lightbulb', label: '行程建議', target: 'sec-suggestions' },
            { icon: 'refresh', label: '颱風/雨天備案', target: 'sec-backup' },
            { icon: 'emergency', label: '緊急聯絡', target: 'sec-emergency' }
        ];
        navItems.forEach(function(item) {
            sHtml += '<button class="menu-item" data-action="scroll-to" data-target="' + item.target + '" title="' + escHtml(item.label) + '">'
                   + '<span class="item-icon">' + iconSpan(item.icon) + '</span>'
                   + '<span class="item-label">' + escHtml(item.label) + '</span></button>';
        });
        sHtml += '<div class="menu-sep"></div>';
        sHtml += '<button class="menu-item" data-action="toggle-print" title="列印模式"><span class="item-icon">' + iconSpan('printer') + '</span><span class="item-label">列印模式</span></button>';
        sidebarNav.innerHTML = sHtml;
    }
}

/* ===== Menu functions provided by menu.js: isDesktop, toggleSidebar, closeMobileMenuIfOpen, updateDarkBtnText, toggleMenu ===== */

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
    if (arrow) arrow.textContent = isOpen ? '－' : '＋';
}
function toggleDark() {
    closeMobileMenuIfOpen();
    var isDark = toggleDarkShared();
    updateDarkBtnText(isDark);
}
var _manualScrollTs = 0;
function scrollToSec(id) {
    var el = document.getElementById(id);
    if (!el) return;
    _manualScrollTs = Date.now();
    closeMobileMenuIfOpen();
    var nav = document.getElementById('stickyNav');
    var navH = nav.offsetHeight;
    var navTop = parseFloat(getComputedStyle(nav).top) || 0;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH - navTop;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', '#' + id);
}
function scrollToDay(n) { scrollToSec('day' + n); }
function toggleHw(el) {
    var p = el.closest('.hourly-weather');
    p.classList.toggle('hw-open');
    var isOpen = p.classList.contains('hw-open');
    var arrow = el.querySelector('.hw-summary-arrow');
    if (arrow) arrow.textContent = isOpen ? '-' : '+';
    if (isOpen) {
        var g = p.querySelector('.hw-grid');
        if (g) { var now = new Date().getHours(), tb = g.querySelector('.hw-now') || g.querySelector('[data-hour="' + Math.max(6, Math.min(21, now)) + '"]'); if (tb) g.scrollLeft = tb.offsetLeft - g.offsetLeft; }
    }
}
function togglePrint() {
    closeMobileMenuIfOpen();
    var entering = !document.body.classList.contains('print-mode');
    if (entering && document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
        updateDarkBtnText(false);
    }
    document.body.classList.toggle('print-mode');
    if (!entering && document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
        updateDarkBtnText(true);
    }
}

/* ===== Switch Trip File ===== */
function switchTripFile() {
    closeMobileMenuIfOpen();
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
window.addEventListener('resize', alignStickyNav);
var _sidebarEl = document.getElementById('sidebar');
if (_sidebarEl) _sidebarEl.addEventListener('transitionend', alignStickyNav);

/* ===== Day Nav Active Pill + Sticky Nav Update ===== */
function initNavTracking() {
    var headers = [];
    if (!TRIP) return;
    for (var i = 1; i <= TRIP.days.length; i++) { var h = document.getElementById('day' + i); if (h) headers.push(h); }
    var navPills = document.querySelectorAll('#stickyNav .dh-nav .dn[data-day]');
    if (!navPills.length) return;
    var nav = document.getElementById('stickyNav');
    var navH = nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0);
    var infoStart = document.getElementById('sec-flight');
    // Remove old listener if any
    if (window._navScrollHandler) window.removeEventListener('scroll', window._navScrollHandler);
    var ticking = false;
    window._navScrollHandler = function() {
        if (!ticking) { requestAnimationFrame(function() {
            // Batch reads
            var rects = headers.map(function(h) { return h.getBoundingClientRect().top; });
            var infoRect = infoStart ? infoStart.getBoundingClientRect().top : Infinity;
            // Batch writes
            var inInfo = infoRect <= navH + 10;
            var current = -1;
            if (!inInfo) { for (var i = 0; i < rects.length; i++) { if (rects[i] <= navH + 10) current = i; } }
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

    arrowL.addEventListener('click', function() { scrollNavPage(-1); });
    arrowR.addEventListener('click', function() { scrollNavPage(1); });
    nav.addEventListener('scroll', updateNavOverflow, { passive: true });

    if (window._navOverflowResizeObserver) window._navOverflowResizeObserver.disconnect();
    if (window.ResizeObserver) {
        window._navOverflowResizeObserver = new ResizeObserver(updateNavOverflow);
        window._navOverflowResizeObserver.observe(nav);
    }
    window.addEventListener('resize', updateNavOverflow, { passive: true });
    updateNavOverflow();
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
            var nav = document.getElementById('stickyNav');
            var navH = nav.offsetHeight + (parseFloat(getComputedStyle(nav).top) || 0);
            window.scrollTo({ top: el.offsetTop - navH, behavior: 'auto' });
        }
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
            case 'toggle-dark': toggleDark(); break;
            case 'toggle-print': togglePrint(); break;
            case 'switch-trip': switchTripFile(); break;
            case 'toggle-hw':  toggleHw(actionEl); break;
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
function initWeather(weatherDays) {
    var WMO={0:'weather-clear',1:'weather-sun-cloud',2:'weather-partly',3:'weather-cloudy',45:'weather-fog',48:'weather-fog',51:'weather-rain-sun',53:'weather-rain-sun',55:'weather-rain',56:'weather-rain',57:'weather-rain',61:'weather-rain-sun',63:'weather-rain',65:'weather-rain',66:'weather-rain',67:'weather-rain',71:'weather-snow',73:'weather-snow',75:'weather-snow',77:'weather-snow',80:'weather-rain-sun',81:'weather-rain',82:'weather-rain',85:'weather-snow',86:'weather-snow',95:'weather-thunder',96:'weather-thunder',99:'weather-thunder'};

    function getLocIdx(day,h){for(var i=day.locations.length-1;i>=0;i--)if(h>=day.locations[i].start)return i;return 0;}

    function renderHourly(c,m,day){
        var now=new Date(),ch=now.getHours();
        var minT=99,maxT=-99,minR=100,maxR=0,iconCount={},bestIcon='weather-clear';
        for(var h=0;h<24;h++){var t=Math.round(m.temps[h]),r=m.rains[h],ic=WMO[m.codes[h]]||'question';if(t<minT)minT=t;if(t>maxT)maxT=t;if(r<minR)minR=r;if(r>maxR)maxR=r;iconCount[ic]=(iconCount[ic]||0)+1;}
        var maxCnt=0;for(var k in iconCount)if(iconCount[k]>maxCnt){maxCnt=iconCount[k];bestIcon=k;}
        var locs=day.locations.map(function(l){return escHtml(l.name);}).filter(function(v,i,a){return a.indexOf(v)===i;}).join('→');
        var html='<div class="hw-summary" data-action="toggle-hw">'+iconSpan(bestIcon)+' '+minT+'~'+maxT+'°C &nbsp;・&nbsp; '+iconSpan('raindrop')+minR+'~'+maxR+'% &nbsp;・&nbsp; '+locs+'<span class="hw-summary-arrow">+</span></div>';
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

    // Batch: collect unique locations across all days, fetch once per location with full date range
    var locMap={},minDate=null,maxDate=null;
    weatherDays.forEach(function(day){
        if(!minDate||day.date<minDate)minDate=day.date;
        if(!maxDate||day.date>maxDate)maxDate=day.date;
        day.locations.forEach(function(l){var k=l.lat+','+l.lon;if(!locMap[k])locMap[k]={lat:l.lat,lon:l.lon};});
    });

    // 檢查 maxDate 是否在今天 + 16 天預報範圍內
    var todayD=new Date(),limitD=new Date(todayD.getTime()+16*24*60*60*1000);
    var limitStr=limitD.getFullYear()+'-'+String(limitD.getMonth()+1).padStart(2,'0')+'-'+String(limitD.getDate()).padStart(2,'0');
    if(maxDate>limitStr){
        weatherDays.forEach(function(day){var c=document.getElementById(day.id);if(c)renderHourly(c,makeDefaultMg(),day);});
        return;
    }

    var locKeys=Object.keys(locMap);
    Promise.all(locKeys.map(function(k){
        var l=locMap[k];
        var params = new URLSearchParams({ latitude: l.lat, longitude: l.lon, hourly: 'temperature_2m,precipitation_probability,weather_code', start_date: minDate, end_date: maxDate, timezone: 'Asia/Tokyo' });
        return fetch('https://api.open-meteo.com/v1/forecast?' + params.toString())
            .then(function(r){return r.json();})
            .then(function(d){return{key:k,data:d};});
    })).then(function(results){
        var cache={};results.forEach(function(r){cache[r.key]=r.data;});
        weatherDays.forEach(function(day){
            var c=document.getElementById(day.id);if(!c)return;
            // Find hour offset for this day's date in the API response
            var sample=cache[locKeys[0]];
            if(!sample||!sample.hourly){renderHourly(c,makeDefaultMg(),day);return;}
            var dayOffset=sample.hourly.time.indexOf(day.date+'T00:00');
            if(dayOffset<0){renderHourly(c,makeDefaultMg(),day);return;}
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
            if(c)c.innerHTML='<div class="hw-error">天氣資料載入失敗：'+escHtml(e.message)+'</div>';
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

// Initial load — resolve from URL → localStorage → default
resolveAndLoad();

/* ===== Module Exports (Node.js / Vitest only) ===== */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        safeColor: safeColor,
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
        renderSuggestionSummaryCard: renderSuggestionSummaryCard
    };
}
