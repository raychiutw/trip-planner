#!/usr/bin/env node
// migrate-md-to-d1.js — 將 data/trips-md/ 中所有行程遷移到 D1 資料庫
// 使用方式：node scripts/migrate-md-to-d1.js [tripId1 tripId2 ...]
// 若不指定 tripId，遷移全部 7 個行程

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var execSync = require('child_process').execSync;

var srcBase = path.join(__dirname, '..', 'data', 'trips-md');

// ─── 從 trip-build.js 複製的 helpers & parsers ───

function readFile(dir, name) {
  return fs.readFileSync(path.join(dir, name), 'utf8');
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

function buildLocationFromMaps(mapsStr, mapcode, appleOverride, label, naverUrl) {
  var parts = mapsStr.split(' | ');
  var name, query;
  if (parts.length === 2) {
    name = parts[0].trim();
    query = parts[1].trim();
  } else {
    name = query = mapsStr.trim();
  }
  var loc = {};
  if (label) loc.label = label;
  loc.name = name;
  loc.googleQuery = 'https://www.google.com/maps/search/' + percentEncode(query);
  loc.appleQuery = 'https://maps.apple.com/?q=' + percentEncode(appleOverride || query);
  if (mapcode) loc.mapcode = mapcode;
  if (naverUrl) loc.naverQuery = naverUrl;
  return loc;
}

function parseFrontmatter(text) {
  var m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { meta: {}, body: text };
  var meta = {};
  m[1].split('\n').forEach(function(line) {
    var idx = line.indexOf(': ');
    if (idx > 0) {
      var key = line.substring(0, idx).trim();
      var val = line.substring(idx + 2).trim();
      meta[key] = val;
    }
  });
  return { meta: meta, body: text.substring(m[0].length).trim() };
}

function splitTableRow(line) {
  var result = [];
  var current = '';
  var chars = line.split('');
  for (var i = 0; i < chars.length; i++) {
    if (chars[i] === '\\' && i + 1 < chars.length && chars[i + 1] === '|') {
      current += '|';
      i++;
    } else if (chars[i] === '|') {
      result.push(current.trim());
      current = '';
    } else {
      current += chars[i];
    }
  }
  if (current.trim()) result.push(current.trim());
  if (result.length && result[0] === '') result.shift();
  if (result.length && result[result.length - 1] === '') result.pop();
  return result;
}

function parseNumOrStr(val) {
  var n = Number(val);
  return isNaN(n) ? val : n;
}

function parseTableRows(tableLines) {
  if (tableLines.length < 3) return [];
  var headers = splitTableRow(tableLines[0]);
  var rows = [];
  for (var i = 2; i < tableLines.length; i++) {
    var cells = splitTableRow(tableLines[i]);
    var obj = {};
    headers.forEach(function(h, j) {
      if (cells[j] !== undefined && cells[j] !== '') {
        obj[h] = cells[j];
      }
    });
    rows.push(obj);
  }
  return rows;
}

function parseMeta(text) {
  var parsed = parseFrontmatter(text);
  var m = parsed.meta;
  var result = {
    meta: {
      title: m.title || '',
      description: m.description || '',
    },
    footer: {},
    autoScrollDates: []
  };
  if (m.name) result.meta.name = m.name;
  if (m.owner) result.meta.owner = m.owner;
  if (m.ogDescription) result.meta.ogDescription = m.ogDescription;
  if (m.foodPreferences) {
    result.meta.foodPreferences = m.foodPreferences.split(', ').map(function(s) { return s.trim(); });
  }
  if (m.selfDrive != null) result.meta.selfDrive = m.selfDrive === 'true';
  if (m.countries) {
    result.meta.countries = m.countries.split(', ').map(function(s) { return s.trim(); });
  }
  result.meta.published = m.published !== 'false';
  if (m.autoScrollDates) {
    result.autoScrollDates = m.autoScrollDates.split(', ').map(function(s) { return s.trim(); });
  }
  var body = parsed.body;
  var footerMatch = body.match(/## Footer\n([\s\S]*?)(?:\n## |$)/);
  if (footerMatch) {
    footerMatch[1].split('\n').forEach(function(line) {
      if (line.startsWith('- ')) {
        var idx = line.indexOf(': ', 2);
        if (idx > 0) {
          result.footer[line.substring(2, idx)] = line.substring(idx + 2);
        }
      }
    });
  }
  return result;
}

function parseRestaurantInfoBox(title, lines) {
  var tableLines = lines.filter(function(l) { return l.startsWith('|'); });
  var rows = parseTableRows(tableLines);
  var restaurants = rows.map(function(r) {
    var rest = {};
    if (r.category) rest.category = r.category;
    if (r.name) rest.name = r.name;
    if (r.hours) rest.hours = r.hours;
    if (r.reservation) {
      if (r.reservation.charAt(0) === '{') {
        try { rest.reservation = JSON.parse(r.reservation); } catch(e) { rest.reservation = r.reservation; }
      } else {
        rest.reservation = r.reservation;
      }
    }
    if (r.description) rest.description = r.description;
    if (r.price) rest.price = r.price;
    if (r.rating) rest.googleRating = parseNumOrStr(r.rating);
    if (r.maps) {
      rest.location = buildLocationFromMaps(r.maps, r.mapcode || null, r.appleMaps || null, null, r.naver || null);
      rest.maps = r.maps.split(' | ')[0].trim();
      if (r.mapcode) rest.mapcode = r.mapcode;
    }
    rest.note = r.note || '';
    if (r.reservationUrl) rest.reservationUrl = r.reservationUrl;
    rest.source = r.source || '';
    return rest;
  });
  return { type: 'restaurants', title: title, restaurants: restaurants };
}

function parseShoppingInfoBox(title, lines) {
  var tableLines = lines.filter(function(l) { return l.startsWith('|'); });
  var rows = parseTableRows(tableLines);
  var shops = rows.map(function(r) {
    var shop = {};
    if (r.category) shop.category = r.category;
    if (r.name) shop.name = r.name;
    if (r.hours) shop.hours = r.hours;
    if (r.mustBuy) {
      shop.mustBuy = r.mustBuy.split(', ').map(function(s) { return s.trim(); });
    }
    if (r.maps) {
      shop.location = buildLocationFromMaps(r.maps, r.mapcode || null, r.appleMaps || null, null, r.naver || null);
      shop.maps = r.maps.split(' | ')[0].trim();
      if (r.mapcode) shop.mapcode = r.mapcode;
    }
    if (r.rating) shop.googleRating = parseNumOrStr(r.rating);
    shop.note = r.note || '';
    shop.source = r.source || '';
    return shop;
  });
  return { type: 'shopping', title: title, shops: shops };
}

function parseParkingInfoBox(title, lines) {
  var box = { type: 'parking', title: title };
  var mapsQuery = null;
  var mapcode = null;
  lines.forEach(function(line) {
    if (line.startsWith('- price: ')) box.price = line.substring(9).trim();
    else if (line.startsWith('- note: ')) box.note = line.substring(8).trim();
    else if (line.startsWith('- maps: ')) mapsQuery = line.substring(8).trim();
    else if (line.startsWith('- mapcode: ')) mapcode = line.substring(11).trim();
  });
  if (box.note === undefined) box.note = '';
  if (mapsQuery) {
    box.location = buildLocationFromMaps(mapsQuery, mapcode);
    box.maps = mapsQuery.split(' | ')[0].trim();
    if (mapcode) box.mapcode = mapcode;
  }
  return box;
}

function parseInfoBox(heading, lines, level) {
  var prefix = level === 3 ? '### ' : '#### ';
  var hText = heading.substring(prefix.length).trim();
  var colonIdx = hText.indexOf(': ');
  var type = colonIdx > 0 ? hText.substring(0, colonIdx).trim() : hText;
  var boxTitle = colonIdx > 0 ? hText.substring(colonIdx + 2).trim() : '';
  if (type === 'restaurants') return parseRestaurantInfoBox(boxTitle, lines);
  if (type === 'shopping') return parseShoppingInfoBox(boxTitle, lines);
  if (type === 'parking') return parseParkingInfoBox(boxTitle, lines);
  return null;
}

function parseHotel(heading, lines) {
  var name = heading.substring('## Hotel: '.length).trim();
  var hotel = { name: name };
  var hasBreakfast = false;
  var hasCheckout = false;
  var hotelSource = '';
  var infoBoxList = [];
  var currentInfoBox = null;

  lines.forEach(function(line) {
    if (line.startsWith('### ')) {
      if (currentInfoBox) infoBoxList.push(currentInfoBox);
      currentInfoBox = { heading: line, lines: [] };
    } else if (currentInfoBox) {
      currentInfoBox.lines.push(line);
    } else if (line.startsWith('- checkout: ')) {
      hotel.checkout = line.substring(12).trim();
      hasCheckout = true;
    } else if (line.startsWith('- rating: ')) {
      hotel.googleRating = parseNumOrStr(line.substring(10).trim());
    } else if (line.startsWith('- source: ')) {
      hotelSource = line.substring(10).trim();
    } else if (line.startsWith('- details: ')) {
      hotel.details = line.substring(11).split(', ').map(function(s) { return s.trim(); });
    } else if (line.startsWith('- note: ')) {
      hotel.note = line.substring(8).trim();
    } else if (line.startsWith('- breakfast: ')) {
      var bVal = line.substring(13).trim();
      hasBreakfast = true;
      if (bVal.startsWith('true')) {
        hotel.breakfast = { included: true };
        var bNote = bVal.substring(4).trim();
        if (bNote) hotel.breakfast.note = bNote;
      } else if (bVal.startsWith('false')) {
        hotel.breakfast = { included: false };
        var bNote2 = bVal.substring(5).trim();
        if (bNote2) hotel.breakfast.note = bNote2;
      } else {
        hotel.breakfast = { included: null };
      }
    }
  });
  if (currentInfoBox) infoBoxList.push(currentInfoBox);

  if (!hasBreakfast) hotel.breakfast = { included: null };
  hotel.source = hotelSource || 'ai';
  if (hotel.note === undefined) hotel.note = '';

  // Parse sub infoBoxes (shopping, parking)
  hotel._infoBoxes = infoBoxList.map(function(ib) {
    return parseInfoBox(ib.heading, ib.lines, 3);
  }).filter(Boolean);

  return hotel;
}

function buildEvent(raw) {
  var heading = raw.heading.substring(4).trim();
  var timeMatch = heading.match(/^(\S+)\s+(.+)$/);
  var time = '', title = heading;
  if (timeMatch) {
    time = timeMatch[1];
    title = timeMatch[2];
  }

  var ev = { time: time, title: title };
  var description = '';
  var mapsList = [];
  var currentMaps = null;
  var infoBoxes = [];
  var currentInfoBox = null;
  var hasSource = false;

  raw.lines.forEach(function(line) {
    if (line.startsWith('#### ')) {
      if (currentInfoBox) infoBoxes.push(currentInfoBox);
      currentInfoBox = { heading: line, lines: [] };
    } else if (currentInfoBox) {
      currentInfoBox.lines.push(line);
    } else if (line.startsWith('- note: ')) {
      ev.note = line.substring(8).trim();
    } else if (line.startsWith('- source: ')) {
      ev.source = line.substring(10).trim();
      hasSource = true;
    } else if (line.startsWith('- maps: ')) {
      if (currentMaps) mapsList.push(currentMaps);
      currentMaps = { query: line.substring(8).trim(), mapcode: null, apple: null, label: null, naver: null };
    } else if (line.startsWith('- label: ')) {
      if (currentMaps) currentMaps.label = line.substring(9).trim();
    } else if (line.startsWith('- mapcode: ')) {
      if (currentMaps) currentMaps.mapcode = line.substring(11).trim();
    } else if (line.startsWith('- apple: ')) {
      if (currentMaps) currentMaps.apple = line.substring(9).trim();
    } else if (line.startsWith('- naver: ')) {
      if (currentMaps) currentMaps.naver = line.substring(9).trim();
    } else if (line.startsWith('- rating: ')) {
      ev.googleRating = parseNumOrStr(line.substring(10).trim());
    } else if (line.startsWith('- travel: ')) {
      var tStr = line.substring(10).trim();
      var tParts = tStr.split(' ');
      ev.travel = {
        type: tParts[0],
        text: tParts.slice(1).join(' ')
      };
      // Extract minutes from text like "約10分鐘" or "約 10 分鐘"
      var minMatch = ev.travel.text.match(/約\s*(\d+)\s*分/);
      if (minMatch) ev.travel.min = parseInt(minMatch[1]);
    } else if (line.trim() && !line.startsWith('- ')) {
      if (!description) description = line.trim();
    }
  });
  if (currentMaps) mapsList.push(currentMaps);
  if (currentInfoBox) infoBoxes.push(currentInfoBox);

  if (description) ev.description = description;

  if (mapsList.length) {
    ev.locations = mapsList.map(function(m) {
      return buildLocationFromMaps(m.query, m.mapcode, m.apple, m.label, m.naver);
    });
    // Primary maps query (first entry, display name)
    ev.maps = mapsList[0].query.split(' | ')[0].trim();
    if (mapsList[0].mapcode) ev.mapcode = mapsList[0].mapcode;
  }

  if (!ev.travel && ev.note === undefined) ev.note = '';
  if (!ev.travel && !hasSource) ev.source = '';

  // Parse event infoBoxes
  ev._infoBoxes = infoBoxes.map(function(ib) {
    return parseInfoBox(ib.heading, ib.lines, 4);
  }).filter(Boolean);

  return ev;
}

function parseDay(text) {
  var parsed = parseFrontmatter(text);
  var fm = parsed.meta;
  var body = parsed.body;

  var day = {
    id: parseInt(fm.id) || 1,
    date: fm.date || '',
    dayOfWeek: fm.dayOfWeek || '',
    label: fm.label || ''
  };
  if (fm.weather) {
    try { day.weather = JSON.parse(fm.weather); } catch(e) {}
  }
  day.hotel = null;
  day.timeline = [];

  var lines = body.split('\n');
  var sections = [];
  var currentSection = null;
  lines.forEach(function(line) {
    if (line.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: line, lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  });
  if (currentSection) sections.push(currentSection);

  sections.forEach(function(sec) {
    if (sec.heading.startsWith('## Hotel: ')) {
      day.hotel = parseHotel(sec.heading, sec.lines);
    } else if (sec.heading === '## Timeline') {
      var events = [];
      var currentEvent = null;
      sec.lines.forEach(function(line) {
        if (line.startsWith('### ')) {
          if (currentEvent) events.push(buildEvent(currentEvent));
          currentEvent = { heading: line, lines: [] };
        } else if (currentEvent) {
          currentEvent.lines.push(line);
        }
      });
      if (currentEvent) events.push(buildEvent(currentEvent));
      day.timeline = events;
    }
  });

  return day;
}

function parseFlights(text) {
  var lines = text.split('\n');
  var title = '';
  var airlineLine = '';
  var tableLines = [];
  var inTable = false;
  lines.forEach(function(line) {
    if (line.startsWith('# ')) { title = line.substring(2).trim(); }
    else if (line.startsWith('|')) { tableLines.push(line); inTable = true; }
    else if (!inTable && line.trim() && !line.startsWith('#')) { airlineLine = line.trim(); }
  });
  var segments = [];
  if (tableLines.length >= 3) {
    var headers = splitTableRow(tableLines[0]);
    for (var i = 2; i < tableLines.length; i++) {
      var cells = splitTableRow(tableLines[i]);
      var seg = {};
      headers.forEach(function(h, j) { if (cells[j]) seg[h] = cells[j]; });
      segments.push(seg);
    }
  }
  var content = { segments: segments };
  if (airlineLine) {
    var aParts = airlineLine.split('｜');
    var airline = { name: aParts[0].trim() };
    airline.note = aParts.length > 1 ? aParts.slice(1).join('｜').trim() : '';
    content.airline = airline;
  }
  return { title: title, content: content };
}

function parseChecklist(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;
  lines.forEach(function(line) {
    if (line.startsWith('# ')) { title = line.substring(2).trim(); }
    else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var color = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) { color = 'var(--sand-light)'; heading = heading.slice(0, -7); }
      current = { color: color, title: heading, items: [] };
    } else if (line.startsWith('- [ ] ') && current) {
      current.items.push(line.substring(6));
    }
  });
  if (current) cards.push(current);
  return { title: title, content: { cards: cards } };
}

function parseBackup(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;
  lines.forEach(function(line) {
    if (line.startsWith('# ')) { title = line.substring(2).trim(); }
    else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var color = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) { color = 'var(--sand-light)'; heading = heading.slice(0, -7); }
      current = { color: color, title: heading, weatherItems: [] };
    } else if (line.startsWith('- ') && current) {
      current.weatherItems.push(line.substring(2));
    }
  });
  if (current) cards.push(current);
  return { title: title, content: { cards: cards } };
}

function parseSuggestions(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;
  var priorityTitles = { high: '高優先', medium: '中優先', low: '低優先' };
  lines.forEach(function(line) {
    if (line.startsWith('# ')) { title = line.substring(2).trim(); }
    else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var priority = line.substring(3).trim();
      current = { title: priorityTitles[priority] || priority, priority: priority, items: [] };
    } else if (line.startsWith('- ') && current) {
      current.items.push(line.substring(2));
    }
  });
  if (current) cards.push(current);
  return { title: title, content: { cards: cards } };
}

function parseEmergency(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;
  lines.forEach(function(line) {
    if (line.startsWith('# ')) { title = line.substring(2).trim(); }
    else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var cardColor = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) { cardColor = 'var(--sand-light)'; heading = heading.substring(0, heading.length - 7).trim(); }
      current = { color: cardColor, title: heading };
    } else if (line.startsWith('- address: ') && current) {
      current._address = line.substring(11).trim();
    } else if (line === '- contacts: []' && current) {
      current.contacts = [];
    } else if (line.startsWith('- ') && current) {
      var colonIdx = line.indexOf(': ', 2);
      if (colonIdx > 0) {
        if (!current.contacts) current.contacts = [];
        var label = line.substring(2, colonIdx);
        var phoneAndUrl = line.substring(colonIdx + 2).trim();
        var pipeIdx = phoneAndUrl.indexOf(' | ');
        var phone, telUrl;
        if (pipeIdx > 0) { phone = phoneAndUrl.substring(0, pipeIdx); telUrl = phoneAndUrl.substring(pipeIdx + 3); }
        else { phone = phoneAndUrl; telUrl = 'tel:' + phone; }
        current.contacts.push({ label: label, phone: phone, url: telUrl });
      }
    } else if (line.startsWith('> ') && current) {
      if (!current.notes) current.notes = [];
      current.notes.push(line.substring(2).trim());
    }
  });
  if (current) cards.push(current);
  cards.forEach(function(c) { if (c._address) { c.address = c._address; delete c._address; } });
  return { title: title, content: { cards: cards } };
}

// ─── SQL helpers ───

function esc(str) {
  // Escape single quotes for SQL
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escNum(val) {
  if (val === null || val === undefined) return 'NULL';
  var n = Number(val);
  return isNaN(n) ? 'NULL' : String(n);
}

function escBool(val) {
  if (val === null || val === undefined) return 'NULL';
  return val ? '1' : '0';
}

function escJson(val) {
  if (val === null || val === undefined) return 'NULL';
  return esc(JSON.stringify(val));
}

// Subquery helpers — resolve auto-generated IDs without round-trips

function dayIdSubquery(tripId, dayNum) {
  return '(SELECT id FROM days WHERE trip_id = ' + esc(tripId) + ' AND day_num = ' + dayNum + ')';
}

function hotelIdSubquery(tripId, dayNum) {
  return '(SELECT id FROM hotels WHERE day_id = ' + dayIdSubquery(tripId, dayNum) + ')';
}

function entryIdSubquery(tripId, dayNum, sortOrder) {
  return '(SELECT id FROM entries WHERE day_id = ' + dayIdSubquery(tripId, dayNum) + ' AND sort_order = ' + sortOrder + ')';
}

// ─── SQL accumulator ───

var sqlBuffer = [];

function runSQL(sql) {
  // Accumulate SQL into the buffer instead of executing immediately
  sqlBuffer.push(sql);
}

function flushSQL(tripId) {
  // Write accumulated SQL to a temp file and execute once
  var sqlContent = sqlBuffer.join('\n');
  sqlBuffer = [];

  var tmpFile = path.join(os.tmpdir(), 'migrate-' + tripId + '-' + Date.now() + '.sql');
  fs.writeFileSync(tmpFile, sqlContent, 'utf8');

  try {
    execSync(
      'npx wrangler d1 execute trip-planner-db --remote --file "' + tmpFile + '"',
      { stdio: 'inherit', cwd: path.join(__dirname, '..') }
    );
  } finally {
    try { fs.unlinkSync(tmpFile); } catch(e) {}
  }
}

// ─── Migration functions ───

function migrateTrip(tripId) {
  var srcDir = path.join(srcBase, tripId);
  console.log('\n=== Migrating ' + tripId + ' ===');

  // 1. Delete existing data (manual cascade since D1 file mode FK may be OFF)
  runSQL(
    "DELETE FROM shopping WHERE parent_type='entry' AND parent_id IN (SELECT id FROM entries WHERE day_id IN (SELECT id FROM days WHERE trip_id = " + esc(tripId) + "));"
    + "\nDELETE FROM shopping WHERE parent_type='hotel' AND parent_id IN (SELECT id FROM hotels WHERE day_id IN (SELECT id FROM days WHERE trip_id = " + esc(tripId) + "));"
    + "\nDELETE FROM restaurants WHERE entry_id IN (SELECT id FROM entries WHERE day_id IN (SELECT id FROM days WHERE trip_id = " + esc(tripId) + "));"
    + "\nDELETE FROM entries WHERE day_id IN (SELECT id FROM days WHERE trip_id = " + esc(tripId) + ");"
    + "\nDELETE FROM hotels WHERE day_id IN (SELECT id FROM days WHERE trip_id = " + esc(tripId) + ");"
    + "\nDELETE FROM trip_docs WHERE trip_id = " + esc(tripId) + ";"
    + "\nDELETE FROM days WHERE trip_id = " + esc(tripId) + ";"
    + "\nDELETE FROM trips WHERE id = " + esc(tripId) + ";"
  );

  // 2. Parse meta.md
  var metaData = parseMeta(readFile(srcDir, 'meta.md'));
  var m = metaData.meta;

  runSQL("INSERT INTO trips (id, name, owner, title, description, og_description, self_drive, countries, published, food_prefs, auto_scroll, footer_json) VALUES ("
    + esc(tripId) + ", "
    + esc(m.name || tripId) + ", "
    + esc(m.owner || '') + ", "
    + esc(m.title || '') + ", "
    + esc(m.description || '') + ", "
    + esc(m.ogDescription || null) + ", "
    + escBool(m.selfDrive) + ", "
    + esc(m.countries ? m.countries.join(', ') : 'JP') + ", "
    + escBool(m.published !== false) + ", "
    + esc(m.foodPreferences ? m.foodPreferences.join(', ') : null) + ", "
    + esc(metaData.autoScrollDates && metaData.autoScrollDates.length ? metaData.autoScrollDates.join(', ') : null) + ", "
    + escJson(Object.keys(metaData.footer).length ? metaData.footer : null)
    + ");");

  // 3. Parse day files
  var dayFiles = fs.readdirSync(srcDir)
    .filter(function(f) { return /^day-\d+\.md$/.test(f); })
    .sort(function(a, b) {
      var na = parseInt(a.match(/\d+/)[0]);
      var nb = parseInt(b.match(/\d+/)[0]);
      return na - nb;
    });

  dayFiles.forEach(function(f) {
    var dayNum = parseInt(f.match(/\d+/)[0]);
    var dayData = parseDay(readFile(srcDir, f));

    // Insert day
    runSQL("INSERT INTO days (trip_id, day_num, date, day_of_week, label, weather_json) VALUES ("
      + esc(tripId) + ", "
      + dayNum + ", "
      + esc(dayData.date || null) + ", "
      + esc(dayData.dayOfWeek || null) + ", "
      + esc(dayData.label || null) + ", "
      + escJson(dayData.weather || null)
      + ");");

    // Insert hotel (use subquery for day_id)
    if (dayData.hotel) {
      var h = dayData.hotel;
      runSQL("INSERT INTO hotels (day_id, name, checkout, source, details, breakfast, note) VALUES ("
        + dayIdSubquery(tripId, dayNum) + ", "
        + esc(h.name) + ", "
        + esc(h.checkout || null) + ", "
        + esc(h.source || 'ai') + ", "
        + esc(h.details ? h.details.join(', ') : null) + ", "
        + escJson(h.breakfast || null) + ", "
        + esc(h.note || '')
        + ");");

      // Handle hotel infoBoxes (parking → parking_json; shopping → shopping table)
      if (h._infoBoxes && h._infoBoxes.length) {
        var parkingBox = h._infoBoxes.find(function(b) { return b.type === 'parking'; });
        if (parkingBox) {
          var parkingJson = { price: parkingBox.price || null, note: parkingBox.note || '', maps: parkingBox.maps || null, mapcode: parkingBox.mapcode || null };
          runSQL("UPDATE hotels SET parking_json = " + escJson(parkingJson) + " WHERE id = " + hotelIdSubquery(tripId, dayNum) + ";");
        }

        var shoppingBoxes = h._infoBoxes.filter(function(b) { return b.type === 'shopping'; });
        shoppingBoxes.forEach(function(box) {
          if (box.shops && box.shops.length) {
            box.shops.forEach(function(shop, si) {
              runSQL("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ("
                + "'hotel', "
                + hotelIdSubquery(tripId, dayNum) + ", "
                + si + ", "
                + esc(shop.name) + ", "
                + esc(shop.category || null) + ", "
                + esc(shop.hours || null) + ", "
                + esc(shop.mustBuy ? shop.mustBuy.join(', ') : null) + ", "
                + esc(shop.note || '') + ", "
                + escNum(shop.googleRating) + ", "
                + esc(shop.maps || null) + ", "
                + esc(shop.mapcode || null) + ", "
                + esc(shop.source || 'ai')
                + ");");
            });
          }
        });
      }
    }

    // Insert timeline entries (use subquery for day_id)
    if (dayData.timeline && dayData.timeline.length) {
      dayData.timeline.forEach(function(ev, ei) {
        var travelType = null, travelDesc = null, travelMin = null;
        if (ev.travel) {
          travelType = ev.travel.type || null;
          travelDesc = ev.travel.text || null;
          travelMin = ev.travel.min || null;
        }

        var primaryMaps = ev.maps || null;
        var primaryMapcode = ev.mapcode || null;

        runSQL("INSERT INTO entries (day_id, sort_order, time, title, body, source, maps, mapcode, rating, note, travel_type, travel_desc, travel_min, location_json) VALUES ("
          + dayIdSubquery(tripId, dayNum) + ", "
          + ei + ", "
          + esc(ev.time || null) + ", "
          + esc(ev.title) + ", "
          + esc(ev.description || null) + ", "
          + esc(ev.source || '') + ", "
          + esc(primaryMaps) + ", "
          + esc(primaryMapcode) + ", "
          + escNum(ev.googleRating) + ", "
          + esc(ev.note !== undefined ? ev.note : null) + ", "
          + esc(travelType) + ", "
          + esc(travelDesc) + ", "
          + escNum(travelMin) + ", "
          + escJson(ev.locations && ev.locations.length ? ev.locations : null)
          + ");");

        // Insert entry infoBoxes (use subquery for entry_id)
        if (ev._infoBoxes && ev._infoBoxes.length) {
          var restBoxes = ev._infoBoxes.filter(function(b) { return b.type === 'restaurants'; });
          restBoxes.forEach(function(box) {
            if (box.restaurants && box.restaurants.length) {
              box.restaurants.forEach(function(rest, ri) {
                var reservationStr = null;
                if (rest.reservation !== undefined) {
                  reservationStr = typeof rest.reservation === 'object'
                    ? JSON.stringify(rest.reservation)
                    : String(rest.reservation);
                }
                runSQL("INSERT INTO restaurants (entry_id, sort_order, name, category, hours, price, reservation, reservation_url, description, note, rating, maps, mapcode, source) VALUES ("
                  + entryIdSubquery(tripId, dayNum, ei) + ", "
                  + ri + ", "
                  + esc(rest.name || '') + ", "
                  + esc(rest.category || null) + ", "
                  + esc(rest.hours || null) + ", "
                  + esc(rest.price || null) + ", "
                  + esc(reservationStr) + ", "
                  + esc(rest.reservationUrl || null) + ", "
                  + esc(rest.description || null) + ", "
                  + esc(rest.note || '') + ", "
                  + escNum(rest.googleRating) + ", "
                  + esc(rest.maps || null) + ", "
                  + esc(rest.mapcode || null) + ", "
                  + esc(rest.source || '')
                  + ");");
              });
            }
          });

          var shopBoxes = ev._infoBoxes.filter(function(b) { return b.type === 'shopping'; });
          shopBoxes.forEach(function(box) {
            if (box.shops && box.shops.length) {
              box.shops.forEach(function(shop, si) {
                runSQL("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ("
                  + "'entry', "
                  + entryIdSubquery(tripId, dayNum, ei) + ", "
                  + si + ", "
                  + esc(shop.name) + ", "
                  + esc(shop.category || null) + ", "
                  + esc(shop.hours || null) + ", "
                  + esc(shop.mustBuy ? shop.mustBuy.join(', ') : null) + ", "
                  + esc(shop.note || '') + ", "
                  + escNum(shop.googleRating) + ", "
                  + esc(shop.maps || null) + ", "
                  + esc(shop.mapcode || null) + ", "
                  + esc(shop.source || 'ai')
                  + ");");
              });
            }
          });
        }
      });
    }
  });

  // 4. Parse doc files
  var docTypes = ['flights', 'checklist', 'backup', 'suggestions', 'emergency'];
  var docParsers = {
    flights: parseFlights,
    checklist: parseChecklist,
    backup: parseBackup,
    suggestions: parseSuggestions,
    emergency: parseEmergency
  };

  docTypes.forEach(function(docType) {
    var filePath = path.join(srcDir, docType + '.md');
    if (!fs.existsSync(filePath)) return;
    var parsed = docParsers[docType](readFile(srcDir, docType + '.md'));
    var content = JSON.stringify(parsed);
    runSQL("INSERT INTO trip_docs (trip_id, doc_type, content) VALUES ("
      + esc(tripId) + ", "
      + esc(docType) + ", "
      + esc(content)
      + ");");
  });

  // Execute all accumulated SQL for this trip in one shot
  console.log('  Executing SQL for ' + tripId + '...');
  flushSQL(tripId);
  console.log('  Done: ' + tripId);
}

// ─── Main ───

var tripIds = process.argv.slice(2);
if (!tripIds.length) {
  tripIds = fs.readdirSync(srcBase).filter(function(d) {
    return fs.statSync(path.join(srcBase, d)).isDirectory();
  }).sort();
}

console.log('Migrating ' + tripIds.length + ' trip(s): ' + tripIds.join(', '));

tripIds.forEach(function(tripId) {
  try {
    migrateTrip(tripId);
  } catch (err) {
    console.error('FAILED to migrate ' + tripId + ':', err.message);
    process.exit(1);
  }
});

console.log('\nAll done!');
