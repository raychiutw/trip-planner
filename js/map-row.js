'use strict';

var FIELD_MAP = {
  body: 'description',
  rating: 'googleRating',
  must_buy: 'mustBuy',
  reservation_url: 'reservationUrl',
  day_of_week: 'dayOfWeek',
  self_drive: 'selfDrive',
  og_description: 'ogDescription',
  day_num: 'dayNum',
  sort_order: 'sortOrder',
  parent_type: 'parentType',
  parent_id: 'parentId',
  entry_id: 'entryId',
  trip_id: 'tripId',
  doc_type: 'docType',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  submitted_by: 'submittedBy',
  changed_by: 'changedBy',
  table_name: 'tableName',
  record_id: 'recordId',
  diff_json: 'diffJson',
  request_id: 'requestId',
  food_prefs: 'foodPrefs',
  auto_scroll: 'autoScroll',
};

var JSON_FIELDS = ['weather_json', 'parking_json', 'footer_json', 'location_json', 'breakfast'];

function mapRow(row) {
  if (!row || typeof row !== 'object') return row;
  var result = {};
  for (var key in row) {
    if (!row.hasOwnProperty(key)) continue;
    var val = row[key];
    // JSON parse string fields
    if (JSON_FIELDS.indexOf(key) >= 0 && typeof val === 'string') {
      try { val = JSON.parse(val); } catch(e) {}
    }
    // Strip _json suffix after parsing
    var outKey = key.replace(/_json$/, '');
    // Rename snake_case to camelCase
    if (FIELD_MAP[outKey]) outKey = FIELD_MAP[outKey];
    result[outKey] = val;
  }
  return result;
}

function mapRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapRow);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapRow: mapRow, mapRows: mapRows, FIELD_MAP: FIELD_MAP, JSON_FIELDS: JSON_FIELDS };
}
