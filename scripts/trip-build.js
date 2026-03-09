#!/usr/bin/env node
// trip-build.js — Markdown → JSON compiler (build step)
var fs = require('fs');
var path = require('path');

var srcBase = path.join(__dirname, '..', 'data', 'trips-md');
var distBase = path.join(__dirname, '..', 'data', 'dist');

var slugs = process.argv.slice(2);
if (!slugs.length) {
  slugs = fs.readdirSync(srcBase).filter(function(d) {
    return fs.statSync(path.join(srcBase, d)).isDirectory();
  });
}

// ─── Helpers ───

function readFile(dir, name) {
  return fs.readFileSync(path.join(dir, name), 'utf8');
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

function buildLocations(query, mapcode) {
  if (!query) return [];
  return [{
    name: query,
    googleQuery: 'https://www.google.com/maps/search/' + percentEncode(query),
    appleQuery: 'https://maps.apple.com/?q=' + percentEncode(query)
  }].map(function(loc) {
    if (mapcode) loc.mapcode = mapcode;
    return loc;
  });
}

function buildLocationFromMaps(mapsStr, mapcode, appleOverride, label, naverUrl) {
  // "displayName | searchQuery" or just "searchQuery"
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

function parseTable(lines) {
  // lines[0] = header, lines[1] = separator, lines[2..] = rows
  if (lines.length < 3) return [];
  var headers = lines[0].split('|').map(function(s) { return s.trim(); }).filter(Boolean);
  var rows = [];
  for (var i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) break;
    var cells = lines[i].split('|').map(function(s) { return s.trim().replace(/\\\|/g, '|'); }).filter(function(s, idx, arr) {
      // filter out empty first/last from leading/trailing |
      return idx > 0 || s !== '';
    });
    // Re-split properly: count pipes not preceded by backslash
    cells = splitTableRow(lines[i]);
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

function splitTableRow(line) {
  // Split on | but not \|
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
  // Remove empty first/last entries from leading/trailing |
  if (result.length && result[0] === '') result.shift();
  if (result.length && result[result.length - 1] === '') result.pop();
  return result;
}

function parseNumOrStr(val) {
  var n = Number(val);
  return isNaN(n) ? val : n;
}

// ─── Meta parser ───

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
  if (m.autoScrollDates) {
    result.autoScrollDates = m.autoScrollDates.split(', ').map(function(s) { return s.trim(); });
  }
  // Parse footer from ## Footer section
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

// ─── Flights parser ───

function parseFlights(text) {
  var lines = text.split('\n');
  var title = '';
  var airlineLine = '';
  var tableLines = [];
  var inTable = false;

  lines.forEach(function(line) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('|')) {
      tableLines.push(line);
      inTable = true;
    } else if (!inTable && line.trim() && !line.startsWith('#')) {
      airlineLine = line.trim();
    }
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
    // "華航 China Airlines｜訂位代號：TNCFHM｜華航 China Airlines｜3 位旅客"
    var aParts = airlineLine.split('｜');
    var airline = { name: aParts[0].trim() };
    if (aParts.length > 1) {
      airline.note = aParts.slice(1).join('｜').trim();
    } else {
      airline.note = '';
    }
    content.airline = airline;
  }

  return { title: title, content: content };
}

// ─── Checklist parser ───

function parseChecklist(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;

  lines.forEach(function(line) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var color = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) {
        color = 'var(--sand-light)';
        heading = heading.slice(0, -7);
      }
      current = { color: color, title: heading, items: [] };
    } else if (line.startsWith('- [ ] ') && current) {
      current.items.push(line.substring(6));
    }
  });
  if (current) cards.push(current);

  return { title: title, content: { cards: cards } };
}

// ─── Backup parser ───

function parseBackup(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;

  lines.forEach(function(line) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var color = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) {
        color = 'var(--sand-light)';
        heading = heading.slice(0, -7);
      }
      current = { color: color, title: heading, weatherItems: [] };
    } else if (line.startsWith('- ') && current) {
      current.weatherItems.push(line.substring(2));
    }
  });
  if (current) cards.push(current);

  return { title: title, content: { cards: cards } };
}

// ─── Suggestions parser ───

function parseSuggestions(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;

  var priorityTitles = { high: '高優先', medium: '中優先', low: '低優先' };

  lines.forEach(function(line) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
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

// ─── Emergency parser ───

function parseEmergency(text) {
  var lines = text.split('\n');
  var title = '';
  var cards = [];
  var current = null;

  lines.forEach(function(line) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
      if (current) cards.push(current);
      var heading = line.substring(3).trim();
      var cardColor = 'var(--blue-light)';
      if (heading.endsWith(' {sand}')) {
        cardColor = 'var(--sand-light)';
        heading = heading.substring(0, heading.length - 7).trim();
      }
      current = { color: cardColor, title: heading };
    } else if (line.startsWith('- address: ') && current) {
      current._address = line.substring(11).trim();
    } else if (line === '- contacts: []' && current) {
      current.contacts = [];
    } else if (line.startsWith('- ') && current) {
      // "- label: phone" or "- label: phone | tel:+81..."
      var colonIdx = line.indexOf(': ', 2);
      if (colonIdx > 0) {
        if (!current.contacts) current.contacts = [];
        var label = line.substring(2, colonIdx);
        var phoneAndUrl = line.substring(colonIdx + 2).trim();
        var pipeIdx = phoneAndUrl.indexOf(' | ');
        var phone, telUrl;
        if (pipeIdx > 0) {
          phone = phoneAndUrl.substring(0, pipeIdx);
          telUrl = phoneAndUrl.substring(pipeIdx + 3);
        } else {
          phone = phoneAndUrl;
          telUrl = 'tel:' + phone;
        }
        current.contacts.push({
          label: label,
          phone: phone,
          url: telUrl
        });
      }
    } else if (line.startsWith('> ') && current) {
      if (!current.notes) current.notes = [];
      current.notes.push(line.substring(2).trim());
    }
  });
  if (current) cards.push(current);

  // Move _address after contacts
  cards.forEach(function(c) {
    if (c._address) {
      c.address = c._address;
      delete c._address;
    }
  });

  return { title: title, content: { cards: cards } };
}

// ─── Day parser (the complex one) ───

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
  day.content = {};

  // Split body into sections by ## headings
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
      day.content.hotel = parseHotel(sec.heading, sec.lines);
    } else if (sec.heading === '## Timeline') {
      day.content.timeline = parseTimeline(sec.lines);
    }
  });
  if (!day.content.timeline) day.content.timeline = [];

  return day;
}

function parseHotel(heading, lines) {
  var name = heading.substring('## Hotel: '.length).trim();
  var hotel = { name: name };
  var hasDetails = false;
  var hasBreakfast = false;
  var hasCheckout = false;
  var hotelSource = '';
  var infoBoxLines = [];
  var currentInfoBox = null;

  lines.forEach(function(line) {
    if (line.startsWith('### ')) {
      if (currentInfoBox) infoBoxLines.push(currentInfoBox);
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
      hasDetails = true;
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
      }
    }
  });
  if (currentInfoBox) infoBoxLines.push(currentInfoBox);

  // Use checkout to determine real hotel
  if (hasCheckout) {
    if (!hasBreakfast) hotel.breakfast = { included: null };
    // Parse hotel infoBoxes
    var parsedBoxes = [];
    infoBoxLines.forEach(function(ib) {
      var box = parseInfoBox(ib.heading, ib.lines, 3);
      if (box) parsedBoxes.push(box);
    });
    if (parsedBoxes.length) hotel.infoBoxes = parsedBoxes;
  } else {
    // Minimal hotel (e.g. "家", "返台")
    if (!hasBreakfast) hotel.breakfast = { included: null };
  }
  hotel.source = hotelSource || 'ai';
  hotel.note = '';

  return hotel;
}

function parseTimeline(lines) {
  var events = [];
  var currentEvent = null;

  lines.forEach(function(line) {
    if (line.startsWith('### ')) {
      if (currentEvent) {
        events.push(buildEvent(currentEvent));
      }
      currentEvent = { heading: line, lines: [] };
    } else if (currentEvent) {
      currentEvent.lines.push(line);
    }
  });
  if (currentEvent) events.push(buildEvent(currentEvent));

  return events;
}

function buildEvent(raw) {
  var heading = raw.heading.substring(4).trim(); // remove "### "
  // Split time from title: "10:45 Title" or "12:00-12:30 Title" or "上午 Title"
  var timeMatch = heading.match(/^(\S+)\s+(.+)$/);
  var time = '', title = heading;
  if (timeMatch) {
    time = timeMatch[1];
    title = timeMatch[2];
  }

  var ev = { time: time, title: title };

  var description = '';
  var mapsList = []; // [{query, mapcode, apple, naver}]
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
      if (currentMaps) {
        currentMaps.label = line.substring(9).trim();
      }
    } else if (line.startsWith('- mapcode: ')) {
      if (currentMaps) {
        currentMaps.mapcode = line.substring(11).trim();
      }
    } else if (line.startsWith('- apple: ')) {
      if (currentMaps) {
        currentMaps.apple = line.substring(9).trim();
      }
    } else if (line.startsWith('- naver: ')) {
      if (currentMaps) {
        currentMaps.naver = line.substring(9).trim();
      }
    } else if (line.startsWith('- rating: ')) {
      ev.googleRating = parseNumOrStr(line.substring(10).trim());
    } else if (line.startsWith('- travel: ')) {
      var tStr = line.substring(10).trim();
      var tParts = tStr.split(' ');
      ev.travel = {
        text: tParts.slice(1).join(' '),
        type: tParts[0]
      };
    } else if (line.trim() && !line.startsWith('- ')) {
      if (!description) description = line.trim();
    }
  });
  if (currentMaps) mapsList.push(currentMaps);
  if (currentInfoBox) infoBoxes.push(currentInfoBox);

  if (description) ev.description = description;

  // Build locations from maps
  if (mapsList.length) {
    ev.locations = mapsList.map(function(m) {
      return buildLocationFromMaps(m.query, m.mapcode, m.apple, m.label, m.naver);
    });
  }

  // Empty note → restore ""
  if (!ev.travel && ev.note === undefined) ev.note = '';

  // Source from MD (don't auto-add)
  if (!ev.travel && !hasSource) ev.source = '';

  // Parse event infoBoxes
  if (infoBoxes.length) {
    ev.infoBoxes = infoBoxes.map(function(ib) {
      return parseInfoBox(ib.heading, ib.lines, 4);
    }).filter(Boolean);
    if (!ev.infoBoxes.length) delete ev.infoBoxes;
  }

  return ev;
}

function parseInfoBox(heading, lines, level) {
  var prefix = level === 3 ? '### ' : '#### ';
  var hText = heading.substring(prefix.length).trim();
  var colonIdx = hText.indexOf(': ');
  var type = colonIdx > 0 ? hText.substring(0, colonIdx).trim() : hText;
  var boxTitle = colonIdx > 0 ? hText.substring(colonIdx + 2).trim() : '';

  if (type === 'restaurants') {
    return parseRestaurantInfoBox(boxTitle, lines);
  } else if (type === 'shopping') {
    return parseShoppingInfoBox(boxTitle, lines);
  } else if (type === 'parking') {
    return parseParkingInfoBox(boxTitle, lines);
  } else if (type === 'reservation') {
    return parseReservationInfoBox(boxTitle, lines);
  } else if (type === 'gasStation') {
    return parseGasStationInfoBox(boxTitle, lines);
  }
  return null;
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
    }
    rest.note = '';
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
    }
    if (r.rating) shop.googleRating = parseNumOrStr(r.rating);
    shop.note = '';
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

  // Restore empty note
  if (box.note === undefined) box.note = '';

  if (mapsQuery) {
    box.location = buildLocationFromMaps(mapsQuery, mapcode);
  }

  return box;
}

function parseReservationInfoBox(title, lines) {
  var items = [];
  lines.forEach(function(line) {
    if (line.startsWith('- ')) items.push(line.substring(2));
  });
  return { type: 'reservation', title: title, items: items };
}

function parseGasStationInfoBox(title, lines) {
  var box = { type: 'gasStation', title: title };
  var station = {};
  var mapsQuery = null;
  var mapcode = null;
  var stationSource = '';

  lines.forEach(function(line) {
    if (line.startsWith('- rating: ')) box.googleRating = parseNumOrStr(line.substring(10).trim());
    else if (line.startsWith('- name: ')) station.name = line.substring(8).trim();
    else if (line.startsWith('- address: ')) station.address = line.substring(11).trim();
    else if (line.startsWith('- hours: ')) station.hours = line.substring(9).trim();
    else if (line.startsWith('- service: ')) station.service = line.substring(11).trim();
    else if (line.startsWith('- phone: ')) station.phone = line.substring(9).trim();
    else if (line.startsWith('- maps: ')) mapsQuery = line.substring(8).trim();
    else if (line.startsWith('- mapcode: ')) mapcode = line.substring(11).trim();
    else if (line.startsWith('- source: ')) stationSource = line.substring(10).trim();
  });

  if (mapsQuery) {
    station.location = buildLocationFromMaps(mapsQuery, mapcode);
  }
  station.source = stationSource || '';
  box.station = station;

  return box;
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

// ─── Main build ───

slugs.forEach(function(slug) {
  var srcDir = path.join(srcBase, slug);
  var outDir = path.join(distBase, slug);
  if (fs.existsSync(outDir)) {
    fs.readdirSync(outDir).forEach(function(f) {
      fs.unlinkSync(path.join(outDir, f));
    });
  } else {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Building ' + slug + ' ...');

  var manifest = [];

  // Meta
  var metaData = parseMeta(readFile(srcDir, 'meta.md'));
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(metaData, null, 2) + '\n');
  manifest.push('meta');
  console.log('  meta.json');

  // Flights
  var flightsPath = path.join(srcDir, 'flights.md');
  if (fs.existsSync(flightsPath)) {
    var flightsData = parseFlights(readFile(srcDir, 'flights.md'));
    fs.writeFileSync(path.join(outDir, 'flights.json'), JSON.stringify(flightsData, null, 2) + '\n');
    manifest.push('flights');
    console.log('  flights.json');
  }

  // Days
  var dayFiles = fs.readdirSync(srcDir).filter(function(f) { return /^day-\d+\.md$/.test(f); }).sort();
  dayFiles.forEach(function(f) {
    var dayData = parseDay(readFile(srcDir, f));
    var baseName = f.replace('.md', '');
    fs.writeFileSync(path.join(outDir, baseName + '.json'), JSON.stringify(dayData, null, 2) + '\n');
    manifest.push(baseName);
    console.log('  ' + baseName + '.json');
  });

  // Checklist
  var checklistData = parseChecklist(readFile(srcDir, 'checklist.md'));
  fs.writeFileSync(path.join(outDir, 'checklist.json'), JSON.stringify(checklistData, null, 2) + '\n');
  manifest.push('checklist');
  console.log('  checklist.json');

  // Backup
  var backupData = parseBackup(readFile(srcDir, 'backup.md'));
  fs.writeFileSync(path.join(outDir, 'backup.json'), JSON.stringify(backupData, null, 2) + '\n');
  manifest.push('backup');
  console.log('  backup.json');

  // Suggestions
  var suggestionsData = parseSuggestions(readFile(srcDir, 'suggestions.md'));
  fs.writeFileSync(path.join(outDir, 'suggestions.json'), JSON.stringify(suggestionsData, null, 2) + '\n');
  manifest.push('suggestions');
  console.log('  suggestions.json');

  // Emergency
  var emergencyPath = path.join(srcDir, 'emergency.md');
  if (fs.existsSync(emergencyPath)) {
    var emergencyData = parseEmergency(readFile(srcDir, 'emergency.md'));
    fs.writeFileSync(path.join(outDir, 'emergency.json'), JSON.stringify(emergencyData, null, 2) + '\n');
    manifest.push('emergency');
    console.log('  emergency.json');
  }

  // Manifest
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('  index.json');

  console.log('Done! Output: data/dist/' + slug + '/');
});
