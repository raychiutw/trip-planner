var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_validate.ts
function validateDayBody(body) {
  const missing = [];
  if (!body.date) missing.push("date");
  if (!body.dayOfWeek) missing.push("dayOfWeek");
  if (!body.label) missing.push("label");
  if (missing.length > 0) {
    return { ok: false, status: 400, error: `\u5FC5\u586B\u6B04\u4F4D\u7F3A\u5931: ${missing.join(", ")}` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return { ok: false, status: 400, error: "date \u683C\u5F0F\u5FC5\u9808\u70BA YYYY-MM-DD" };
  }
  if (body.label.length > 8) {
    return { ok: false, status: 400, error: "label \u4E0D\u5F97\u8D85\u904E 8 \u5B57" };
  }
  return { ok: true, status: 200 };
}
__name(validateDayBody, "validateDayBody");
function validateEntryBody(body) {
  if (!body.title) {
    return { ok: false, status: 400, error: "\u5FC5\u586B\u6B04\u4F4D\u7F3A\u5931: title" };
  }
  return { ok: true, status: 200 };
}
__name(validateEntryBody, "validateEntryBody");
function detectGarbledText(text) {
  if (!text || typeof text !== "string") return false;
  if (text.includes("\uFFFD")) return true;
  if (/[\u0080-\u00FF]{3,}/.test(text)) return true;
  if (/[\x80-\x9F]/.test(text)) return true;
  return false;
}
__name(detectGarbledText, "detectGarbledText");
var SENSITIVE_REPLY_PATTERNS = [
  /\/api\/\w/i,
  /trip_(days|entries|pois|permissions|requests|docs)|audit_log|poi_relations/,
  /\bSELECT\s+\w+\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /CF-Access|Service.Token|middleware/i,
  /functions\/api/,
  /\.bind\(|\.prepare\(/,
  /onRequest(Get|Post|Put|Patch|Delete)/
];
var SANITIZED_FALLBACK = "\u5DF2\u8655\u7406\u60A8\u7684\u8ACB\u6C42\u3002\u5982\u6709\u554F\u984C\u8ACB\u76F4\u63A5\u806F\u7E6B\u884C\u7A0B\u4E3B\u4EBA\u3002";
function sanitizeReply(reply) {
  for (const pattern of SENSITIVE_REPLY_PATTERNS) {
    if (pattern.test(reply)) return SANITIZED_FALLBACK;
  }
  return reply;
}
__name(sanitizeReply, "sanitizeReply");

// api/_audit.ts
async function logAudit(db, opts) {
  let finalDiffJson = opts.diffJson ?? null;
  if (finalDiffJson && detectGarbledText(finalDiffJson)) {
    try {
      const parsed = JSON.parse(finalDiffJson);
      parsed._encoding_warning = true;
      finalDiffJson = JSON.stringify(parsed);
    } catch {
    }
  }
  try {
    await db.prepare(
      "INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, request_id, diff_json, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      opts.tripId,
      opts.tableName,
      opts.recordId,
      opts.action,
      opts.changedBy,
      opts.requestId ?? null,
      finalDiffJson,
      opts.snapshot ?? null
    ).run();
  } catch (err) {
    console.error("[audit] logAudit failed (non-fatal):", err);
  }
}
__name(logAudit, "logAudit");
function computeDiff(oldRow, newFields) {
  const diff = {};
  for (const key of Object.keys(newFields)) {
    const oldVal = oldRow[key];
    const newVal = newFields[key];
    const oldStr = typeof oldVal === "object" && oldVal !== null ? JSON.stringify(oldVal) : oldVal;
    const newStr = typeof newVal === "object" && newVal !== null ? JSON.stringify(newVal) : newVal;
    if (oldStr !== newStr) {
      diff[key] = { old: oldVal, new: newVal };
    }
  }
  return JSON.stringify(diff);
}
__name(computeDiff, "computeDiff");

// ../src/types/api.ts
var ERROR_MESSAGES = {
  NET_TIMEOUT: "\u9023\u7DDA\u903E\u6642\uFF0C\u8ACB\u6AA2\u67E5\u7DB2\u8DEF",
  NET_OFFLINE: "\u76EE\u524D\u96E2\u7DDA\uFF0C\u986F\u793A\u5FEB\u53D6\u8CC7\u6599",
  AUTH_REQUIRED: "\u8ACB\u5148\u767B\u5165",
  AUTH_EXPIRED: "\u767B\u5165\u5DF2\u904E\u671F\uFF0C\u8ACB\u91CD\u65B0\u767B\u5165",
  AUTH_INVALID: "\u8A8D\u8B49\u5931\u6557\uFF0C\u8ACB\u91CD\u65B0\u767B\u5165",
  PERM_DENIED: "\u4F60\u6C92\u6709\u6B64\u64CD\u4F5C\u7684\u6B0A\u9650",
  PERM_ADMIN_ONLY: "\u50C5\u7BA1\u7406\u54E1\u53EF\u64CD\u4F5C",
  PERM_NOT_OWNER: "\u9019\u4E0D\u662F\u4F60\u7684\u884C\u7A0B",
  DATA_NOT_FOUND: "\u627E\u4E0D\u5230\u9019\u7B46\u8CC7\u6599",
  DATA_VALIDATION: "\u8CC7\u6599\u683C\u5F0F\u4E0D\u6B63\u78BA",
  DATA_CONFLICT: "\u9019\u7B46\u8CC7\u6599\u5DF2\u7D93\u5B58\u5728",
  DATA_ENCODING: "\u6587\u5B57\u7DE8\u78BC\u6709\u8AA4\uFF0C\u8ACB\u7528 UTF-8",
  DATA_SAVE_FAILED: "\u5132\u5B58\u5931\u6557\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21",
  SYS_INTERNAL: "\u7CFB\u7D71\u767C\u751F\u932F\u8AA4\uFF0C\u5DF2\u901A\u77E5\u958B\u767C\u5718\u968A",
  SYS_DB_ERROR: "\u8CC7\u6599\u5EAB\u5FD9\u788C\u4E2D\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66",
  SYS_RATE_LIMIT: "\u64CD\u4F5C\u592A\u983B\u7E41\uFF0C\u8ACB\u7A0D\u7B49"
};

// api/_errors.ts
var STATUS_MAP = {
  AUTH_REQUIRED: 401,
  AUTH_EXPIRED: 401,
  AUTH_INVALID: 401,
  PERM_DENIED: 403,
  PERM_ADMIN_ONLY: 403,
  PERM_NOT_OWNER: 403,
  DATA_NOT_FOUND: 404,
  DATA_VALIDATION: 400,
  DATA_CONFLICT: 409,
  DATA_ENCODING: 400,
  DATA_SAVE_FAILED: 500,
  SYS_INTERNAL: 500,
  SYS_DB_ERROR: 503,
  SYS_RATE_LIMIT: 429
};
var AppError = class extends Error {
  static {
    __name(this, "AppError");
  }
  constructor(code, detail) {
    super(ERROR_MESSAGES[code] || code);
    this.code = code;
    this.status = STATUS_MAP[code] ?? 500;
    this.detail = detail;
  }
};
function errorResponse(err) {
  return new Response(
    JSON.stringify({
      error: {
        code: err.code,
        message: err.message,
        detail: err.detail || void 0
      }
    }),
    {
      status: err.status,
      headers: { "Content-Type": "application/json" }
    }
  );
}
__name(errorResponse, "errorResponse");

// api/_utils.ts
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
__name(json, "json");
function getAuth(context) {
  return context.data?.auth ?? null;
}
__name(getAuth, "getAuth");
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("DATA_VALIDATION", "JSON \u683C\u5F0F\u7121\u6548");
  }
}
__name(parseJsonBody, "parseJsonBody");
function parseIntParam(s) {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}
__name(parseIntParam, "parseIntParam");
function buildUpdateClause(body, allowedFields) {
  const fields = Object.keys(body).filter((k) => allowedFields.includes(k));
  if (fields.length === 0) return null;
  const setClauses = [...fields.map((f) => `${f} = ?`), "updated_at = CURRENT_TIMESTAMP"].join(", ");
  const values = fields.map((f) => body[f]);
  return { fields, setClauses, values };
}
__name(buildUpdateClause, "buildUpdateClause");

// api/trips/[id]/audit/[aid]/rollback.ts
var ALLOWED_TABLES = ["trips", "trip_days", "trip_entries", "pois", "trip_pois", "poi_relations", "trip_docs", "trip_docs_v2", "trip_doc_entries", "trip_requests", "trip_permissions"];
var TABLE_COLUMNS = {
  trips: ["id", "name", "owner", "title", "description", "og_description", "self_drive", "countries", "published", "food_prefs", "auto_scroll", "footer", "created_at", "updated_at"],
  trip_days: ["id", "trip_id", "day_num", "date", "day_of_week", "label", "updated_at"],
  trip_entries: ["id", "day_id", "sort_order", "time", "title", "description", "source", "maps", "mapcode", "google_rating", "note", "travel_type", "travel_desc", "travel_min", "location", "updated_at"],
  pois: ["id", "type", "name", "description", "note", "address", "phone", "email", "website", "hours", "google_rating", "category", "maps", "mapcode", "lat", "lng", "country", "source", "created_at", "updated_at"],
  trip_pois: ["id", "trip_id", "poi_id", "context", "day_id", "entry_id", "sort_order", "description", "note", "hours", "checkout", "breakfast_included", "breakfast_note", "price", "reservation", "reservation_url", "must_buy", "source", "created_at", "updated_at"],
  poi_relations: ["id", "poi_id", "related_poi_id", "relation_type", "note"],
  trip_docs: ["id", "trip_id", "doc_type", "content", "updated_at"],
  trip_docs_v2: ["id", "trip_id", "doc_type", "title", "updated_at"],
  trip_doc_entries: ["id", "doc_id", "sort_order", "section", "title", "content", "updated_at"],
  trip_requests: ["id", "trip_id", "mode", "message", "submitted_by", "reply", "status", "created_at"],
  trip_permissions: ["id", "email", "trip_id", "role", "created_at"]
};
var onRequestPost = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const { id, aid } = context.params;
  const db = context.env.DB;
  const changedBy = auth.email;
  const auditRow = await db.prepare("SELECT * FROM audit_log WHERE id = ? AND trip_id = ?").bind(Number(aid), id).first();
  if (!auditRow) throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u6B64 audit \u8A18\u9304");
  const { table_name, record_id, action, diff_json, snapshot } = auditRow;
  const safeTable = ALLOWED_TABLES.find((t) => t === table_name);
  if (!safeTable) {
    throw new AppError("DATA_VALIDATION", "\u7121\u6548\u7684\u8868\u683C\u540D\u7A31");
  }
  const allowedCols = TABLE_COLUMNS[safeTable];
  if (action === "delete") {
    if (!snapshot) throw new AppError("DATA_VALIDATION", "\u7121\u53EF\u7528\u7684\u5FEB\u7167\u9032\u884C\u56DE\u6EFE");
    let snapshotRow;
    try {
      snapshotRow = JSON.parse(snapshot);
    } catch {
      throw new AppError("DATA_VALIDATION", "\u5FEB\u7167 JSON \u683C\u5F0F\u7121\u6548");
    }
    const snapshotKeys = Object.keys(snapshotRow).filter((k) => k !== "updated_at" && k !== "created_at");
    const invalidSnapshotCols = snapshotKeys.filter((k) => !allowedCols.includes(k));
    if (invalidSnapshotCols.length > 0) {
      throw new AppError("DATA_VALIDATION", `Invalid column(s) in snapshot: ${invalidSnapshotCols.join(", ")}`);
    }
    const cols = snapshotKeys.join(", ");
    const placeholders = snapshotKeys.map(() => "?").join(", ");
    const values = snapshotKeys.map((k) => snapshotRow[k] ?? null);
    if (snapshotRow.id != null) {
      const existing = await db.prepare(`SELECT 1 FROM ${safeTable} WHERE id = ?`).bind(snapshotRow.id).first();
      if (existing) {
        throw new AppError("DATA_CONFLICT", "\u7121\u6CD5\u56DE\u6EFE\uFF1A\u6B64 ID \u7684\u8A18\u9304\u5DF2\u5B58\u5728");
      }
    }
    await db.prepare(`INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders})`).bind(...values).run();
    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: "insert",
      changedBy,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, original_action: "delete" })
    });
    return json({ ok: true, rolled_back: "delete->re-insert" });
  }
  if (action === "update") {
    if (!diff_json) throw new AppError("DATA_VALIDATION", "\u7121 diff \u8CC7\u6599\u53EF\u56DE\u6EFE");
    if (record_id === null) throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11 record_id \u7121\u6CD5\u56DE\u6EFE");
    let diff;
    try {
      diff = JSON.parse(diff_json);
    } catch {
      throw new AppError("DATA_VALIDATION", "diff JSON \u683C\u5F0F\u7121\u6548");
    }
    const revertFields = Object.keys(diff);
    if (revertFields.length === 0) throw new AppError("DATA_VALIDATION", "\u7121\u6B04\u4F4D\u53EF\u9084\u539F");
    const invalidDiffCols = revertFields.filter((f) => !allowedCols.includes(f));
    if (invalidDiffCols.length > 0) {
      throw new AppError("DATA_VALIDATION", `Invalid column(s) in diff: ${invalidDiffCols.join(", ")}`);
    }
    const setClauses = [...revertFields.map((f) => `${f} = ?`), "updated_at = CURRENT_TIMESTAMP"].join(", ");
    const values = [...revertFields.map((f) => diff[f].old ?? null), record_id];
    const result = await db.prepare(`UPDATE ${safeTable} SET ${setClauses} WHERE id = ?`).bind(...values).run();
    if (result.meta.changes === 0) throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u8981\u9084\u539F\u7684\u8A18\u9304");
    const revertedFields = Object.fromEntries(revertFields.map((f) => [f, diff[f].old]));
    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: "update",
      changedBy,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, reverted: revertedFields })
    });
    return json({ ok: true, rolled_back: "update->revert" });
  }
  if (action === "insert") {
    if (record_id === null) throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11 record_id \u7121\u6CD5\u56DE\u6EFE");
    const oldRow = await db.prepare(`SELECT * FROM ${safeTable} WHERE id = ?`).bind(record_id).first();
    await db.prepare(`DELETE FROM ${safeTable} WHERE id = ?`).bind(record_id).run();
    await logAudit(db, {
      tripId: id,
      tableName: safeTable,
      recordId: record_id,
      action: "delete",
      changedBy,
      snapshot: oldRow ? JSON.stringify(oldRow) : void 0,
      diffJson: JSON.stringify({ rollback_of: auditRow.id, original_action: "insert" })
    });
    return json({ ok: true, rolled_back: "insert->delete" });
  }
  throw new AppError("DATA_VALIDATION", `Unknown action: ${action}`);
}, "onRequestPost");

// api/_auth.ts
async function hasPermission(db, email, tripId, isAdmin) {
  if (isAdmin) return true;
  const row = await db.prepare("SELECT 1 FROM trip_permissions WHERE email = ? AND (trip_id = ? OR trip_id = ?)").bind(email.toLowerCase(), tripId, "*").first();
  return !!row;
}
__name(hasPermission, "hasPermission");
async function verifyEntryBelongsToTrip(db, entryId, tripId) {
  const row = await db.prepare("SELECT 1 FROM trip_entries e JOIN trip_days d ON e.day_id = d.id WHERE e.id = ? AND d.trip_id = ?").bind(entryId, tripId).first();
  return !!row;
}
__name(verifyEntryBelongsToTrip, "verifyEntryBelongsToTrip");
async function verifyTripPoiBelongsToTrip(db, tripPoiId, tripId) {
  const row = await db.prepare("SELECT 1 FROM trip_pois WHERE id = ? AND trip_id = ?").bind(tripPoiId, tripId).first();
  return !!row;
}
__name(verifyTripPoiBelongsToTrip, "verifyTripPoiBelongsToTrip");

// api/_poi.ts
var COALESCE_FIELDS = [
  "description",
  "maps",
  "mapcode",
  "lat",
  "lng",
  "google_rating",
  "category",
  "hours",
  "address",
  "phone",
  "email",
  "website",
  "country"
];
function buildCoalesceUpdate(data) {
  const fills = [];
  const vals = [];
  for (const col of COALESCE_FIELDS) {
    const val = data[col];
    if (val != null) {
      fills.push(`${col} = COALESCE(${col}, ?)`);
      vals.push(val);
    }
  }
  return { fills, vals };
}
__name(buildCoalesceUpdate, "buildCoalesceUpdate");
async function findOrCreatePoi(db, data) {
  const existing = await db.prepare(
    "SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1"
  ).bind(data.name, data.type).first();
  if (existing) {
    const { fills, vals } = buildCoalesceUpdate(data);
    if (fills.length > 0) {
      await db.prepare(`UPDATE pois SET ${fills.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, existing.id).run();
    }
    return existing.id;
  }
  const result = await db.prepare(
    "INSERT OR IGNORE INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source, address, phone, email, website, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
  ).bind(
    data.type,
    data.name,
    data.description ?? null,
    data.hours ?? null,
    data.google_rating ?? null,
    data.category ?? null,
    data.maps ?? null,
    data.mapcode ?? null,
    data.lat ?? null,
    data.lng ?? null,
    data.source ?? "ai",
    data.address ?? null,
    data.phone ?? null,
    data.email ?? null,
    data.website ?? null,
    data.country ?? "JP"
  ).first();
  if (result) return result.id;
  const reFetch = await db.prepare(
    "SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1"
  ).bind(data.name, data.type).first();
  if (!reFetch) throw new AppError("SYS_DB_ERROR", "POI lost after INSERT OR IGNORE");
  return reFetch.id;
}
__name(findOrCreatePoi, "findOrCreatePoi");
async function batchFindOrCreatePois(db, items) {
  if (items.length === 0) return [];
  const keyOf = /* @__PURE__ */ __name((d) => `${d.type}\0${d.name}`, "keyOf");
  const uniqueMap = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!uniqueMap.has(key)) uniqueMap.set(key, { data: item });
  }
  const uniqueItems = [...uniqueMap.values()];
  const selectStmts = uniqueItems.map(
    ({ data }) => db.prepare("SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1").bind(data.name, data.type)
  );
  const selectResults = await db.batch(selectStmts);
  const toUpdate = [];
  const toInsert = [];
  for (let i = 0; i < uniqueItems.length; i++) {
    const rows = selectResults[i].results;
    if (rows.length > 0) {
      uniqueItems[i].poiId = rows[0].id;
      toUpdate.push({ idx: i, id: rows[0].id });
    } else {
      toInsert.push(i);
    }
  }
  if (toUpdate.length > 0) {
    const updateStmts = [];
    for (const { idx, id } of toUpdate) {
      const { fills, vals } = buildCoalesceUpdate(uniqueItems[idx].data);
      if (fills.length > 0) {
        updateStmts.push(
          db.prepare(`UPDATE pois SET ${fills.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, id)
        );
      }
    }
    if (updateStmts.length > 0) await db.batch(updateStmts);
  }
  if (toInsert.length > 0) {
    const insertStmts = toInsert.map((idx) => {
      const data = uniqueItems[idx].data;
      return db.prepare(
        "INSERT OR IGNORE INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source, address, phone, email, website, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
      ).bind(
        data.type,
        data.name,
        data.description ?? null,
        data.hours ?? null,
        data.google_rating ?? null,
        data.category ?? null,
        data.maps ?? null,
        data.mapcode ?? null,
        data.lat ?? null,
        data.lng ?? null,
        data.source ?? "ai",
        data.address ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.website ?? null,
        data.country ?? "JP"
      );
    });
    const insertResults = await db.batch(insertStmts);
    const reFetchIndices = [];
    for (let i = 0; i < toInsert.length; i++) {
      const rows = insertResults[i].results;
      if (rows.length > 0) {
        uniqueItems[toInsert[i]].poiId = rows[0].id;
      } else {
        reFetchIndices.push(toInsert[i]);
      }
    }
    if (reFetchIndices.length > 0) {
      const reFetchStmts = reFetchIndices.map((idx) => {
        const data = uniqueItems[idx].data;
        return db.prepare("SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1").bind(data.name, data.type);
      });
      const reFetchResults = await db.batch(reFetchStmts);
      for (let i = 0; i < reFetchIndices.length; i++) {
        const rows = reFetchResults[i].results;
        uniqueItems[reFetchIndices[i]].poiId = rows[0].id;
      }
    }
  }
  return items.map((item) => {
    const entry = uniqueMap.get(keyOf(item));
    if (!entry?.poiId) throw new AppError("SYS_DB_ERROR", "POI ID missing after batch upsert");
    return entry.poiId;
  });
}
__name(batchFindOrCreatePois, "batchFindOrCreatePois");

// api/trips/[id]/entries/[eid]/trip-pois.ts
var onRequestPost2 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, eid } = context.params;
  const entryId = parseIntParam(eid);
  if (!entryId) throw new AppError("DATA_VALIDATION", "entry ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, entryId, id)
  ]);
  if (!hasPerm) throw new AppError("PERM_DENIED");
  if (!belongsToTrip) throw new AppError("PERM_DENIED", "\u6B64 entry \u4E0D\u5C6C\u65BC\u8A72\u884C\u7A0B");
  const body = await parseJsonBody(context.request);
  if (!body.name || !body.type) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11\u5FC5\u8981\u6B04\u4F4D\uFF1Aname, type");
  }
  const entry = await db.prepare("SELECT day_id FROM trip_entries WHERE id = ?").bind(entryId).first();
  if (!entry) throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u6B64 entry");
  const poiId = await findOrCreatePoi(db, {
    name: body.name,
    type: body.type,
    description: body.description,
    hours: body.hours,
    google_rating: body.google_rating,
    category: body.category,
    maps: body.maps,
    mapcode: body.mapcode,
    lat: body.lat,
    lng: body.lng,
    source: "ai"
  });
  const maxSort = await db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM trip_pois WHERE entry_id = ? AND context = ?"
  ).bind(entryId, body.context || "timeline").first();
  const result = await db.prepare(
    `INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, description, note, hours, price, reservation, reservation_url, must_buy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(
    poiId,
    id,
    body.context || "timeline",
    entryId,
    entry.day_id,
    (maxSort?.max_sort ?? -1) + 1,
    body.description ?? null,
    body.note ?? null,
    body.hours ?? null,
    body.price ?? null,
    body.reservation ?? null,
    body.reservation_url ?? null,
    body.must_buy ?? null
  ).first();
  await logAudit(db, {
    tripId: id,
    tableName: "trip_pois",
    recordId: result.id,
    action: "insert",
    changedBy: auth.email,
    diffJson: JSON.stringify(body)
  });
  return json(result, 201);
}, "onRequestPost");

// api/trips/[id]/days/[num].ts
function mergePoi(poi, tp) {
  return {
    // POI master fields
    poi_id: poi.id,
    type: poi.type,
    name: poi.name,
    description: tp.description ?? poi.description,
    note: tp.note ?? poi.note,
    address: poi.address,
    phone: poi.phone,
    email: poi.email,
    website: poi.website,
    hours: tp.hours ?? poi.hours,
    google_rating: poi.google_rating,
    category: poi.category,
    maps: poi.maps,
    mapcode: poi.mapcode,
    source: poi.source,
    // trip_pois fields
    trip_poi_id: tp.id,
    context: tp.context,
    day_id: tp.day_id,
    entry_id: tp.entry_id,
    sort_order: tp.sort_order,
    // Type-specific (flattened in trip_pois)
    checkout: tp.checkout,
    breakfast_included: tp.breakfast_included,
    breakfast_note: tp.breakfast_note,
    price: tp.price,
    reservation: tp.reservation,
    reservation_url: tp.reservation_url,
    must_buy: tp.must_buy
  };
}
__name(mergePoi, "mergePoi");
var onRequestGet = /* @__PURE__ */ __name(async (context) => {
  const { id, num } = context.params;
  const db = context.env.DB;
  const day = await db.prepare("SELECT * FROM trip_days WHERE trip_id = ? AND day_num = ?").bind(id, Number(num)).first();
  if (!day) throw new AppError("DATA_NOT_FOUND");
  const dayId = day.id;
  const [entriesResult, allTripPois] = await Promise.all([
    db.prepare("SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC").bind(dayId).all(),
    db.prepare("SELECT * FROM trip_pois WHERE trip_id = ? AND day_id = ?").bind(id, dayId).all()
  ]);
  const poiIds = [...new Set(allTripPois.results.map((tp) => tp.poi_id))];
  const poiMap = /* @__PURE__ */ new Map();
  if (poiIds.length > 0) {
    const placeholders = poiIds.map(() => "?").join(",");
    const { results: poisRows } = await db.prepare(
      `SELECT * FROM pois WHERE id IN (${placeholders})`
    ).bind(...poiIds).all();
    for (const p of poisRows) {
      poiMap.set(p.id, p);
    }
  }
  let hotel = null;
  const parkingList = [];
  const restByEntry = /* @__PURE__ */ new Map();
  const shopByEntry = /* @__PURE__ */ new Map();
  for (const tp of allTripPois.results) {
    const poi = poiMap.get(tp.poi_id);
    if (!poi) continue;
    const merged = mergePoi(poi, tp);
    const poiType = poi.type;
    const context2 = tp.context;
    if (context2 === "hotel" && poiType === "hotel" && !hotel) {
      hotel = merged;
    } else if (context2 === "hotel" && poiType === "parking") {
      parkingList.push(merged);
    } else if (context2 === "timeline") {
      const eid = tp.entry_id;
      if (!restByEntry.has(eid)) restByEntry.set(eid, []);
      restByEntry.get(eid).push(merged);
    } else if (context2 === "shopping") {
      const eid = tp.entry_id;
      if (eid) {
        if (!shopByEntry.has(eid)) shopByEntry.set(eid, []);
        shopByEntry.get(eid).push(merged);
      }
    }
  }
  if (hotel) {
    hotel.parking = parkingList;
  }
  const timeline = entriesResult.results.map((e) => {
    const entry = e;
    const eid = entry.id;
    const travel = entry.travel_type ? {
      type: entry.travel_type,
      desc: entry.travel_desc,
      min: entry.travel_min
    } : null;
    return {
      ...entry,
      travel,
      restaurants: restByEntry.get(eid) ?? [],
      shopping: shopByEntry.get(eid) ?? []
    };
  });
  return json({
    id: dayId,
    day_num: day.day_num,
    date: day.date,
    day_of_week: day.day_of_week,
    label: day.label,
    hotel,
    timeline
  });
}, "onRequestGet");
var onRequestPut = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, num } = context.params;
  const changedBy = auth.email;
  const db = context.env.DB;
  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError("PERM_DENIED");
  }
  const day = await db.prepare("SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?").bind(id, Number(num)).first();
  if (!day) throw new AppError("DATA_NOT_FOUND");
  const dayId = day.id;
  const [oldTripPois, oldEntries] = await Promise.all([
    db.prepare("SELECT * FROM trip_pois WHERE trip_id = ? AND day_id = ?").bind(id, dayId).all(),
    db.prepare("SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC").bind(dayId).all()
  ]);
  const snapshot = JSON.stringify({ dayId, tripPois: oldTripPois.results, entries: oldEntries.results });
  const body = await parseJsonBody(context.request);
  const validation = validateDayBody(body);
  if (!validation.ok) throw new AppError("DATA_VALIDATION", validation.error);
  const timelineEntries = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timelineEntries.length; i++) {
    const e = timelineEntries[i];
    for (const f of ["title", "description", "note"]) {
      const val = e[f];
      if (typeof val === "string" && detectGarbledText(val)) {
        throw new AppError("DATA_ENCODING", `timeline[${i}].${f} \u5305\u542B\u7591\u4F3C\u4E82\u78BC`);
      }
    }
  }
  try {
    const batch1 = [];
    batch1.push(
      db.prepare("DELETE FROM trip_pois WHERE trip_id = ? AND day_id = ?").bind(id, dayId),
      db.prepare("DELETE FROM trip_entries WHERE day_id = ?").bind(dayId),
      db.prepare("UPDATE trip_days SET date = ?, day_of_week = ?, label = ? WHERE id = ?").bind(body.date, body.dayOfWeek, body.label, dayId)
    );
    const timeline = Array.isArray(body.timeline) ? body.timeline : [];
    const ENTRIES_START = batch1.length;
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      const travel = e.travel;
      batch1.push(
        db.prepare("INSERT INTO trip_entries (day_id, sort_order, time, title, description, maps, google_rating, note, travel_type, travel_desc, travel_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(
          dayId,
          i,
          e.time ?? null,
          e.title ?? null,
          e.description ?? null,
          e.maps ?? null,
          e.google_rating ?? null,
          e.note ?? null,
          travel?.type ?? null,
          travel?.desc ?? null,
          travel?.min ?? null
        )
      );
    }
    const batch1Results = await db.batch(batch1);
    const entryIds = [];
    for (let i = 0; i < timeline.length; i++) {
      const rows = batch1Results[ENTRIES_START + i].results;
      entryIds.push(rows[0]?.id ?? 0);
    }
    const poiItems = [];
    const tripPoiBuilders = [];
    let hotelPoiIdx = -1;
    if (body.hotel) {
      const h = body.hotel;
      hotelPoiIdx = poiItems.length;
      poiItems.push({
        name: h.name || "",
        type: "hotel",
        description: h.description,
        maps: h.maps,
        lat: h.lat,
        lng: h.lng,
        source: "ai"
      });
      const hCopy = h;
      tripPoiBuilders.push((ids) => [
        db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note, hours, checkout, breakfast_included, breakfast_note) VALUES (?, ?, 'hotel', ?, ?, ?, ?, ?, ?, ?)`).bind(
          ids[hotelPoiIdx],
          id,
          dayId,
          hCopy.description ?? null,
          hCopy.note ?? null,
          hCopy.hours ?? null,
          hCopy.checkout ?? null,
          hCopy.breakfast_included ?? null,
          hCopy.breakfast_note ?? null
        )
      ]);
      if (Array.isArray(h.parking)) {
        for (const p of h.parking) {
          const parkIdx = poiItems.length;
          poiItems.push({
            name: p.name || "\u505C\u8ECA\u5834",
            type: "parking",
            description: p.price ? `\u8CBB\u7528\uFF1A${p.price}` : null,
            maps: p.maps,
            mapcode: p.mapcode,
            lat: p.lat,
            lng: p.lng,
            source: "ai"
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note) VALUES (?, ?, 'hotel', ?, ?, ?)`).bind(ids[parkIdx], id, dayId, p.price ? `\u8CBB\u7528\uFF1A${p.price}` : null, p.note ?? null),
            db.prepare(`INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type) VALUES (?, ?, 'parking')`).bind(ids[hotelPoiIdx], ids[parkIdx])
          ]);
        }
      }
      if (Array.isArray(h.shopping)) {
        for (const [idx, s] of h.shopping.entries()) {
          const shopIdx = poiItems.length;
          poiItems.push({
            name: s.name || "",
            type: "shopping",
            google_rating: s.google_rating,
            maps: s.maps,
            category: s.category,
            hours: s.hours,
            source: "ai"
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?)`).bind(ids[shopIdx], id, dayId, idx, s.note ?? null, s.must_buy ?? null)
          ]);
        }
      }
    }
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      const entryId = entryIds[i];
      if (Array.isArray(e.restaurants)) {
        for (const [idx, r] of e.restaurants.entries()) {
          const rIdx = poiItems.length;
          poiItems.push({
            name: r.name || "",
            type: "restaurant",
            description: r.description,
            google_rating: r.google_rating,
            maps: r.maps,
            category: r.category,
            hours: r.hours,
            source: "ai"
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, description, note, price, reservation, reservation_url) VALUES (?, ?, 'timeline', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
              ids[rIdx],
              id,
              entryId,
              dayId,
              idx,
              r.description ?? null,
              r.note ?? null,
              r.price ?? null,
              r.reservation ?? null,
              r.reservation_url ?? null
            )
          ]);
        }
      }
      if (Array.isArray(e.shopping)) {
        for (const [idx, s] of e.shopping.entries()) {
          const sIdx = poiItems.length;
          poiItems.push({
            name: s.name || "",
            type: "shopping",
            google_rating: s.google_rating,
            maps: s.maps,
            category: s.category,
            hours: s.hours,
            source: "ai"
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?, ?)`).bind(ids[sIdx], id, entryId, dayId, idx, s.note ?? null, s.must_buy ?? null)
          ]);
        }
      }
    }
    const poiIds = await batchFindOrCreatePois(db, poiItems);
    const batch2 = [];
    for (const builder of tripPoiBuilders) {
      batch2.push(...builder(poiIds));
    }
    if (batch2.length > 0) await db.batch(batch2);
    await logAudit(db, {
      tripId: id,
      tableName: "trip_days",
      recordId: dayId,
      action: "update",
      changedBy,
      snapshot,
      diffJson: JSON.stringify({ day_num: Number(num), overwrite: true })
    });
  } catch (err) {
    await logAudit(db, {
      tripId: id,
      tableName: "trip_days",
      recordId: dayId,
      action: "error",
      changedBy,
      diffJson: JSON.stringify({ error: "Partial write failure", message: err instanceof Error ? err.message : String(err) })
    });
    throw new AppError("DATA_SAVE_FAILED", "\u5132\u5B58\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66");
  }
  return json({ ok: true });
}, "onRequestPut");

// api/trips/[id]/docs/[type].ts
var VALID_TYPES = /* @__PURE__ */ new Set(["flights", "checklist", "backup", "suggestions", "emergency"]);
var onRequestGet2 = /* @__PURE__ */ __name(async (context) => {
  const { id, type } = context.params;
  if (!VALID_TYPES.has(type)) throw new AppError("DATA_VALIDATION", "\u7121\u6548\u7684\u6587\u4EF6\u985E\u578B");
  const db = context.env.DB;
  const doc = await db.prepare("SELECT id, doc_type, title, updated_at FROM trip_docs_v2 WHERE trip_id = ? AND doc_type = ?").bind(id, type).first();
  if (!doc) throw new AppError("DATA_NOT_FOUND");
  const entries = await db.prepare("SELECT id, sort_order, section, title, content FROM trip_doc_entries WHERE doc_id = ? ORDER BY sort_order").bind(doc.id).all();
  return json({
    doc_type: doc.doc_type,
    title: doc.title,
    updated_at: doc.updated_at,
    entries: entries.results ?? []
  });
}, "onRequestGet");
var onRequestPut2 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, type } = context.params;
  if (!VALID_TYPES.has(type)) throw new AppError("DATA_VALIDATION", "\u7121\u6548\u7684\u6587\u4EF6\u985E\u578B");
  const db = context.env.DB;
  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError("PERM_DENIED");
  }
  const body = await parseJsonBody(context.request);
  let docTitle = body.title ?? "";
  let entries = body.entries ?? [];
  if (entries.length === 0 && typeof body.content === "string") {
    try {
      const parsed = JSON.parse(body.content);
      docTitle = parsed.title || docTitle;
      const inner = parsed.content || parsed;
      if (inner.segments) {
        for (const s of inner.segments) entries.push({ section: "", title: s.label || "", content: [s.route, s.time].filter(Boolean).join("\n") });
        if (inner.airline) entries.push({ section: "", title: inner.airline.name || "", content: inner.airline.note || "" });
      } else if (inner.cards) {
        for (const c of inner.cards) {
          const sec = c.title || "";
          if (c.contacts) {
            for (const ct of c.contacts) entries.push({ section: sec, title: ct.label || ct.phone || "", content: ct.phone ? `[${ct.phone}](tel:${ct.phone})` : "" });
          } else if (c.items) {
            for (const it of c.items) entries.push({ section: sec, title: typeof it === "string" ? it : it.text || "", content: "" });
          } else if (c.description) entries.push({ section: sec, title: "", content: c.description });
        }
      } else if (inner.items) {
        for (const it of inner.items) entries.push({ section: "", title: typeof it === "string" ? it : it.text || "", content: "" });
      } else {
        entries = [{ section: "", title: "", content: typeof inner === "string" ? inner : JSON.stringify(inner) }];
      }
    } catch {
      entries = [{ section: "", title: "", content: body.content }];
    }
  }
  if (entries.length > 200) throw new AppError("DATA_VALIDATION", "entries \u6578\u91CF\u8D85\u904E\u4E0A\u9650 (200)");
  const changedBy = auth.email;
  const docResult = await db.prepare("INSERT INTO trip_docs_v2 (trip_id, doc_type, title, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(trip_id, doc_type) DO UPDATE SET title = excluded.title, updated_at = CURRENT_TIMESTAMP RETURNING id").bind(id, type, docTitle).first();
  if (!docResult) throw new AppError("SYS_INTERNAL", "doc upsert failed");
  const docId = docResult.id;
  const batch = [
    db.prepare("DELETE FROM trip_doc_entries WHERE doc_id = ?").bind(docId)
  ];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    batch.push(
      db.prepare("INSERT INTO trip_doc_entries (doc_id, sort_order, section, title, content) VALUES (?, ?, ?, ?, ?)").bind(docId, e.sort_order ?? i, e.section ?? "", e.title ?? "", e.content ?? "")
    );
  }
  await db.batch(batch);
  await logAudit(db, {
    tripId: id,
    tableName: "trip_docs_v2",
    recordId: docId,
    action: "update",
    changedBy,
    diffJson: JSON.stringify({ doc_type: type, entries_count: entries.length })
  });
  return json({ ok: true });
}, "onRequestPut");

// api/trips/[id]/entries/[eid].ts
var ALLOWED_FIELDS = ["sort_order", "time", "title", "description", "source", "maps", "mapcode", "google_rating", "note", "travel_type", "travel_desc", "travel_min", "location"];
var onRequestPatch = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, eid: eidStr } = context.params;
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError("DATA_VALIDATION", "ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const changedBy = auth.email;
  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id)
  ]);
  if (!hasPerm) throw new AppError("PERM_DENIED");
  if (!belongsToTrip) throw new AppError("DATA_NOT_FOUND");
  const oldRow = await db.prepare("SELECT * FROM trip_entries WHERE id = ?").bind(eid).first();
  if (!oldRow) throw new AppError("DATA_NOT_FOUND");
  const body = await parseJsonBody(context.request);
  if ("title" in body) {
    const validation = validateEntryBody(body);
    if (!validation.ok) throw new AppError("DATA_VALIDATION", validation.error);
  }
  const textFields = ["title", "description", "note", "travel_desc"];
  for (const f of textFields) {
    if (f in body && typeof body[f] === "string" && detectGarbledText(body[f])) {
      throw new AppError("DATA_ENCODING", `\u6B04\u4F4D ${f} \u5305\u542B\u7591\u4F3C\u4E82\u78BC\uFF0C\u8ACB\u78BA\u8A8D encoding \u70BA UTF-8`);
    }
  }
  const update = buildUpdateClause(body, ALLOWED_FIELDS);
  if (!update) throw new AppError("DATA_VALIDATION", "\u7121\u6709\u6548\u6B04\u4F4D\u53EF\u66F4\u65B0");
  let row;
  try {
    row = await db.prepare(`UPDATE trip_entries SET ${update.setClauses} WHERE id = ? RETURNING *`).bind(...update.values, eid).first();
  } catch (err) {
    throw new AppError("SYS_DB_ERROR", "DB \u66AB\u6642\u7121\u6CD5\u8655\u7406\uFF0C\u8ACB\u7A0D\u5F8C\u91CD\u8A66");
  }
  if (!row) throw new AppError("DATA_NOT_FOUND");
  const newFields = Object.fromEntries(update.fields.map((f) => [f, body[f]]));
  await logAudit(db, {
    tripId: id,
    tableName: "trip_entries",
    recordId: eid,
    action: "update",
    changedBy,
    diffJson: computeDiff(oldRow, newFields)
  });
  return json(row);
}, "onRequestPatch");
var onRequestDelete = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, eid: eidStr } = context.params;
  const eid = parseIntParam(eidStr);
  if (!eid) throw new AppError("DATA_VALIDATION", "ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const changedBy = auth.email;
  const [hasPerm2, belongsToTrip2] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, eid, id)
  ]);
  if (!hasPerm2) throw new AppError("PERM_DENIED");
  if (!belongsToTrip2) throw new AppError("DATA_NOT_FOUND");
  const oldRow = await db.prepare("SELECT * FROM trip_entries WHERE id = ?").bind(eid).first();
  if (!oldRow) throw new AppError("DATA_NOT_FOUND");
  try {
    await db.batch([
      db.prepare("DELETE FROM trip_pois WHERE entry_id = ?").bind(eid),
      db.prepare("DELETE FROM trip_entries WHERE id = ?").bind(eid)
    ]);
  } catch (err) {
    throw new AppError("SYS_DB_ERROR", "DB \u66AB\u6642\u7121\u6CD5\u8655\u7406\uFF0C\u8ACB\u7A0D\u5F8C\u91CD\u8A66");
  }
  await logAudit(db, {
    tripId: id,
    tableName: "trip_entries",
    recordId: eid,
    action: "delete",
    changedBy,
    snapshot: JSON.stringify(oldRow)
  });
  return json({ ok: true });
}, "onRequestDelete");

// api/trips/[id]/trip-pois/[tpid].ts
var ALLOWED_FIELDS2 = [
  "description",
  "note",
  "hours",
  "sort_order",
  "checkout",
  "breakfast_included",
  "breakfast_note",
  "price",
  "reservation",
  "reservation_url",
  "must_buy"
];
var onRequestPatch2 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, tpid } = context.params;
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError("DATA_VALIDATION", "trip_poi ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyTripPoiBelongsToTrip(db, tripPoiId, id)
  ]);
  if (!hasPerm) throw new AppError("PERM_DENIED");
  if (!belongsToTrip) throw new AppError("PERM_DENIED", "\u6B64 trip_poi \u4E0D\u5C6C\u65BC\u8A72\u884C\u7A0B");
  const [oldRow, body] = await Promise.all([
    db.prepare("SELECT * FROM trip_pois WHERE id = ?").bind(tripPoiId).first(),
    parseJsonBody(context.request)
  ]);
  if (!oldRow) throw new AppError("DATA_NOT_FOUND");
  const updateResult = buildUpdateClause(body, ALLOWED_FIELDS2);
  if (!updateResult) throw new AppError("DATA_VALIDATION", "\u7121\u6709\u6548\u6B04\u4F4D\u53EF\u66F4\u65B0");
  const newRow = await db.prepare(`UPDATE trip_pois SET ${updateResult.setClauses} WHERE id = ? RETURNING *`).bind(...updateResult.values, tripPoiId).first();
  if (!newRow) throw new AppError("SYS_INTERNAL", "UPDATE RETURNING \u672A\u56DE\u50B3\u8CC7\u6599");
  const diffJson = computeDiff(oldRow, newRow);
  await logAudit(db, {
    tripId: id,
    tableName: "trip_pois",
    recordId: tripPoiId,
    action: "update",
    changedBy: auth.email,
    diffJson
  });
  return json(newRow);
}, "onRequestPatch");
var onRequestDelete2 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id, tpid } = context.params;
  const tripPoiId = parseIntParam(tpid);
  if (!tripPoiId) throw new AppError("DATA_VALIDATION", "trip_poi ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyTripPoiBelongsToTrip(db, tripPoiId, id)
  ]);
  if (!hasPerm) throw new AppError("PERM_DENIED");
  if (!belongsToTrip) throw new AppError("PERM_DENIED", "\u6B64 trip_poi \u4E0D\u5C6C\u65BC\u8A72\u884C\u7A0B");
  const oldRow = await db.prepare("SELECT * FROM trip_pois WHERE id = ?").bind(tripPoiId).first();
  if (!oldRow) throw new AppError("DATA_NOT_FOUND");
  await db.prepare("DELETE FROM trip_pois WHERE id = ?").bind(tripPoiId).run();
  await logAudit(db, {
    tripId: id,
    tableName: "trip_pois",
    recordId: tripPoiId,
    action: "delete",
    changedBy: auth.email,
    snapshot: JSON.stringify(oldRow)
  });
  return json({ ok: true });
}, "onRequestDelete");

// api/trips/[id]/audit.ts
var onRequestGet3 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const { id } = context.params;
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || "20"), 100));
  const requestId = url.searchParams.get("request_id");
  let sql = "SELECT * FROM audit_log WHERE trip_id = ?";
  const params = [id];
  if (requestId) {
    sql += " AND request_id = ?";
    params.push(Number(requestId));
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const { results } = await db.prepare(sql).bind(...params).all();
  return json(results);
}, "onRequestGet");

// api/trips/[id]/days.ts
var onRequestGet4 = /* @__PURE__ */ __name(async (context) => {
  const { id } = context.params;
  const { results } = await context.env.DB.prepare("SELECT id, day_num, date, day_of_week, label FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC").bind(id).all();
  return json(results);
}, "onRequestGet");

// api/permissions.ts
async function getAccessPolicyEmails(env) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${env.CF_ACCESS_APP_ID}/policies/${env.CF_ACCESS_POLICY_ID}`,
    { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" } }
  );
  if (!res.ok) throw new Error(`Access API GET failed: ${res.status}`);
  const data = await res.json();
  return data.result.include.filter((rule) => rule.email).map((rule) => rule.email.email.toLowerCase());
}
__name(getAccessPolicyEmails, "getAccessPolicyEmails");
async function updateAccessPolicyEmails(env, emails) {
  const include = emails.map((email) => ({ email: { email } }));
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${env.CF_ACCESS_APP_ID}/policies/${env.CF_ACCESS_POLICY_ID}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "\u5141\u8A31\u7684\u65C5\u4F34", decision: "allow", include })
    }
  );
  if (!res.ok) throw new Error(`Access API PUT failed: ${res.status}`);
}
__name(updateAccessPolicyEmails, "updateAccessPolicyEmails");
async function addEmailToAccessPolicy(env, email) {
  const emails = await getAccessPolicyEmails(env);
  const lower = email.toLowerCase();
  if (emails.includes(lower)) return;
  emails.push(lower);
  await updateAccessPolicyEmails(env, emails);
}
__name(addEmailToAccessPolicy, "addEmailToAccessPolicy");
async function removeEmailFromAccessPolicy(env, email) {
  const emails = await getAccessPolicyEmails(env);
  const lower = email.toLowerCase();
  const filtered = emails.filter((e) => e !== lower);
  if (filtered.length === emails.length) return;
  await updateAccessPolicyEmails(env, filtered);
}
__name(removeEmailFromAccessPolicy, "removeEmailFromAccessPolicy");
var onRequestGet5 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const url = new URL(context.request.url);
  const tripId = url.searchParams.get("tripId");
  if (!tripId) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11 tripId \u53C3\u6578");
  }
  const { results } = await context.env.DB.prepare("SELECT * FROM trip_permissions WHERE trip_id = ? ORDER BY email").bind(tripId).all();
  return json(results);
}, "onRequestGet");
var onRequestPost3 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const body = await parseJsonBody(context.request);
  const { email, tripId, role = "member" } = body;
  if (!email || !tripId) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11\u5FC5\u8981\u6B04\u4F4D\uFF1Aemail, tripId");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("DATA_VALIDATION", "email \u683C\u5F0F\u4E0D\u6B63\u78BA");
  }
  const lowerEmail = email.toLowerCase();
  let result;
  try {
    const row = await context.env.DB.prepare("INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?) RETURNING *").bind(lowerEmail, tripId, role).first();
    if (!row) throw new AppError("SYS_INTERNAL", "INSERT RETURNING \u672A\u56DE\u50B3\u8CC7\u6599");
    result = row;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      throw new AppError("DATA_CONFLICT", "\u6B64 email \u5DF2\u6709\u6B64\u884C\u7A0B\u7684\u6B0A\u9650");
    }
    throw err;
  }
  let accessSyncFailed = false;
  try {
    await addEmailToAccessPolicy(context.env, lowerEmail);
  } catch (err) {
    accessSyncFailed = true;
    const accessErr = err instanceof Error ? err.message : String(err);
    console.error("Access policy sync failed:", accessErr);
    await logAudit(context.env.DB, {
      tripId,
      tableName: "trip_permissions",
      recordId: result.id,
      action: "error",
      changedBy: auth.email,
      diffJson: JSON.stringify({ warning: "Access policy sync failed", message: accessErr })
    });
  }
  await logAudit(context.env.DB, {
    tripId,
    tableName: "trip_permissions",
    recordId: result.id,
    action: "insert",
    changedBy: auth.email,
    diffJson: JSON.stringify({ email: lowerEmail, role })
  });
  return json({ ...result, _accessSyncFailed: accessSyncFailed }, 201);
}, "onRequestPost");

// api/permissions/[id].ts
var onRequestDelete3 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const id = context.params.id;
  const record = await context.env.DB.prepare("SELECT * FROM trip_permissions WHERE id = ?").bind(id).first();
  if (!record) {
    throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u8A72\u6B0A\u9650\u8A18\u9304");
  }
  await context.env.DB.prepare("DELETE FROM trip_permissions WHERE id = ?").bind(id).run();
  const remaining = await context.env.DB.prepare("SELECT 1 FROM trip_permissions WHERE email = ? AND trip_id != ?").bind(record.email, "*").first();
  if (!remaining) {
    try {
      await removeEmailFromAccessPolicy(context.env, record.email);
    } catch (err) {
      await context.env.DB.prepare("INSERT INTO trip_permissions (id, email, trip_id, role) VALUES (?, ?, ?, ?)").bind(record.id, record.email, record.trip_id, record.role).run();
      throw new AppError("DATA_SAVE_FAILED", "\u540C\u6B65 Access policy \u5931\u6557\uFF0C\u5DF2\u56DE\u6EFE");
    }
  }
  await logAudit(context.env.DB, {
    tripId: record.trip_id,
    tableName: "trip_permissions",
    recordId: record.id,
    action: "delete",
    changedBy: auth.email,
    snapshot: JSON.stringify(record),
    diffJson: JSON.stringify({ email: record.email, role: record.role })
  });
  return json({ ok: true });
}, "onRequestDelete");

// api/pois/[id].ts
var ALLOWED_FIELDS3 = [
  "name",
  "description",
  "note",
  "address",
  "phone",
  "email",
  "website",
  "hours",
  "google_rating",
  "category",
  "maps",
  "mapcode",
  "lat",
  "lng",
  "country",
  "source"
];
var onRequestPatch3 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  if (!auth.isAdmin) throw new AppError("PERM_ADMIN_ONLY");
  const poiId = parseIntParam(context.params.id);
  if (!poiId) throw new AppError("DATA_VALIDATION", "POI ID \u683C\u5F0F\u932F\u8AA4");
  const db = context.env.DB;
  const oldRow = await db.prepare("SELECT * FROM pois WHERE id = ?").bind(poiId).first();
  if (!oldRow) throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u6B64 POI");
  const body = await parseJsonBody(context.request);
  const update = buildUpdateClause(body, ALLOWED_FIELDS3);
  if (!update) throw new AppError("DATA_VALIDATION", "\u7121\u6709\u6548\u6B04\u4F4D\u53EF\u66F4\u65B0");
  const newRow = await db.prepare(`UPDATE pois SET ${update.setClauses} WHERE id = ? RETURNING *`).bind(...update.values, poiId).first();
  if (!newRow) throw new AppError("SYS_INTERNAL", "UPDATE RETURNING \u672A\u56DE\u50B3\u8CC7\u6599");
  const diffJson = computeDiff(oldRow, newRow);
  await logAudit(db, {
    tripId: "global",
    tableName: "pois",
    recordId: poiId,
    action: "update",
    changedBy: auth.email,
    diffJson
  });
  return json(newRow);
}, "onRequestPatch");

// api/requests/[id].ts
var onRequestPatch4 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const id = params.id;
  if (!auth.isAdmin) {
    throw new AppError("PERM_ADMIN_ONLY");
  }
  const body = await parseJsonBody(context.request);
  const updates = [];
  const values = [];
  if (body.reply !== void 0) {
    updates.push("reply = ?");
    values.push(sanitizeReply(body.reply));
  }
  const oldRow = await env.DB.prepare("SELECT * FROM trip_requests WHERE id = ?").bind(id).first();
  if (body.status !== void 0) {
    const STATUS_ORDER = ["open", "received", "processing", "completed"];
    if (!STATUS_ORDER.includes(body.status)) {
      throw new AppError("DATA_VALIDATION", "status \u5FC5\u9808\u662F open\u3001received\u3001processing \u6216 completed");
    }
    if (oldRow) {
      const oldIdx = STATUS_ORDER.indexOf(oldRow.status);
      const newIdx = STATUS_ORDER.indexOf(body.status);
      if (newIdx >= 0 && oldIdx >= 0 && newIdx < oldIdx) {
        throw new AppError("DATA_VALIDATION", `status \u4E0D\u53EF\u5F9E ${oldRow.status} \u9000\u56DE ${body.status}`);
      }
    }
    updates.push("status = ?");
    values.push(body.status);
  }
  if (updates.length === 0) {
    throw new AppError("DATA_VALIDATION", "\u6C92\u6709\u8981\u66F4\u65B0\u7684\u6B04\u4F4D");
  }
  values.push(id);
  const result = await env.DB.prepare(`UPDATE trip_requests SET ${updates.join(", ")} WHERE id = ? RETURNING *`).bind(...values).first();
  if (!result) {
    throw new AppError("DATA_NOT_FOUND", "\u627E\u4E0D\u5230\u8A72\u8ACB\u6C42");
  }
  const tripId = result.trip_id;
  const newFields = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== void 0)
  );
  await logAudit(env.DB, {
    tripId,
    tableName: "trip_requests",
    recordId: Number(id),
    action: "update",
    changedBy: auth.email,
    diffJson: oldRow ? computeDiff(oldRow, newFields) : JSON.stringify(newFields)
  });
  return json(result);
}, "onRequestPatch");

// api/trips/[id].ts
var ALLOWED_FIELDS4 = ["name", "owner", "title", "description", "og_description", "self_drive", "countries", "published", "food_prefs", "auto_scroll", "footer"];
var onRequestGet6 = /* @__PURE__ */ __name(async (context) => {
  const { id } = context.params;
  const row = await context.env.DB.prepare("SELECT *, id AS tripId FROM trips WHERE id = ?").bind(id).first();
  if (!row) throw new AppError("DATA_NOT_FOUND");
  if (row.footer && typeof row.footer === "string") {
    try {
      row.footer = JSON.parse(row.footer);
    } catch {
    }
  }
  return json(row);
}, "onRequestGet");
var onRequestPut3 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const { id } = context.params;
  const db = context.env.DB;
  const [hasPerm, existing] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    db.prepare("SELECT * FROM trips WHERE id = ?").bind(id).first()
  ]);
  if (!hasPerm) throw new AppError("PERM_DENIED");
  if (!existing) throw new AppError("DATA_NOT_FOUND");
  const body = await parseJsonBody(context.request);
  const update = buildUpdateClause(body, ALLOWED_FIELDS4);
  if (!update) throw new AppError("DATA_VALIDATION", "\u7121\u6709\u6548\u6B04\u4F4D\u53EF\u66F4\u65B0");
  const changedBy = auth.email;
  const newFields = Object.fromEntries(update.fields.map((f) => [f, body[f]]));
  await db.prepare(`UPDATE trips SET ${update.setClauses} WHERE id = ?`).bind(...update.values, id).run();
  await logAudit(db, {
    tripId: id,
    tableName: "trips",
    recordId: null,
    action: "update",
    changedBy,
    diffJson: computeDiff(existing, newFields)
  });
  return json({ ok: true });
}, "onRequestPut");

// api/my-trips.ts
var onRequestGet7 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  let results;
  if (auth.isAdmin) {
    const { results: rows } = await env.DB.prepare("SELECT DISTINCT trip_id AS tripId FROM trip_permissions WHERE trip_id != ? ORDER BY trip_id").bind("*").all();
    results = rows;
  } else {
    const { results: rows } = await env.DB.prepare("SELECT trip_id AS tripId FROM trip_permissions WHERE email = ? AND trip_id != ? ORDER BY trip_id").bind(auth.email.toLowerCase(), "*").all();
    results = rows;
  }
  return json(results);
}, "onRequestGet");

// api/reports.ts
var onRequestPost4 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const db = env.DB;
  const body = await parseJsonBody(context.request);
  if (body.website || body.email_confirm) {
    return json({ ok: true });
  }
  const tripId = body.tripId;
  if (!tripId || typeof tripId !== "string") {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11 tripId");
  }
  const url = body.url || "";
  const recent = await db.prepare(
    "SELECT 1 FROM error_reports WHERE trip_id = ? AND url = ? AND created_at > datetime('now', '-30 seconds')"
  ).bind(tripId, url).first();
  if (recent) {
    throw new AppError("SYS_RATE_LIMIT");
  }
  await db.prepare(
    "INSERT INTO error_reports (trip_id, url, error_code, error_message, user_agent, context) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    tripId,
    body.url || null,
    body.errorCode || null,
    body.errorMessage || null,
    body.userAgent || null,
    body.context || null
  ).run();
  return json({ ok: true }, 201);
}, "onRequestPost");

// api/requests.ts
var onRequestGet8 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const url = new URL(request.url);
  const tripId = url.searchParams.get("tripId");
  const status = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const before = url.searchParams.get("before");
  const beforeId = url.searchParams.get("beforeId");
  if (!tripId && !auth.isAdmin) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11 tripId \u53C3\u6578");
  }
  if (tripId && !await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    throw new AppError("PERM_DENIED");
  }
  const isPaginated = limitParam !== null || before !== null;
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 50);
  let sql = "SELECT * FROM trip_requests";
  const params = [];
  const conditions = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (before) {
    if (beforeId) {
      conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
      params.push(before, before, parseInt(beforeId, 10) || 0);
    } else {
      conditions.push("created_at < ?");
      params.push(before);
    }
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY created_at DESC, id DESC";
  sql += isPaginated ? ` LIMIT ${limit + 1}` : " LIMIT 50";
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  if (isPaginated) {
    const hasMore = (results ?? []).length > limit;
    const items = hasMore ? (results ?? []).slice(0, limit) : results ?? [];
    return json({ items, hasMore });
  }
  return json(results);
}, "onRequestGet");
var onRequestPost5 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const body = await parseJsonBody(request);
  const { tripId, mode } = body;
  const message = body.message || [body.title, body.body].filter(Boolean).join("\n") || "";
  if (!tripId || !mode || !message) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5C11\u5FC5\u8981\u6B04\u4F4D\uFF1AtripId, mode, message");
  }
  if (mode !== "trip-edit" && mode !== "trip-plan") {
    throw new AppError("DATA_VALIDATION", "mode \u5FC5\u9808\u662F trip-edit \u6216 trip-plan");
  }
  if (!await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    throw new AppError("PERM_DENIED");
  }
  const existing = await env.DB.prepare(
    "SELECT * FROM trip_requests WHERE trip_id = ? AND message = ? AND submitted_by = ? AND created_at > datetime('now', '-30 seconds') ORDER BY created_at DESC LIMIT 1"
  ).bind(tripId, message, auth.email).first();
  if (existing) {
    return json(existing, 200);
  }
  const result = await env.DB.prepare(
    "INSERT INTO trip_requests (trip_id, mode, message, submitted_by) VALUES (?, ?, ?, ?) RETURNING *"
  ).bind(tripId, mode, message, auth.email).first();
  const newRow = result;
  try {
    await logAudit(env.DB, {
      tripId,
      tableName: "trip_requests",
      recordId: newRow ? newRow.id : null,
      action: "insert",
      changedBy: auth.email,
      diffJson: JSON.stringify({ mode, message: message.substring(0, 100) })
    });
  } catch (auditErr) {
    console.error("[requests] logAudit failed (non-fatal):", auditErr);
  }
  return json(result, 201);
}, "onRequestPost");

// api/trips.ts
var TRIPID_RE = /^[a-z0-9-]+$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var WEEKDAYS = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
var MAX_DAYS = 30;
var MS_PER_DAY = 864e5;
function str(val, fallback = "") {
  if (typeof val === "string") return val;
  if (val != null && typeof val === "object") return JSON.stringify(val);
  return fallback;
}
__name(str, "str");
var onRequestPost6 = /* @__PURE__ */ __name(async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError("AUTH_REQUIRED");
  const body = await parseJsonBody(context.request);
  const id = body.id;
  const name = body.name;
  const owner = body.owner;
  const startDate = body.startDate;
  const endDate = body.endDate;
  if (!id || !name || !owner || !startDate || !endDate) {
    throw new AppError("DATA_VALIDATION", "\u7F3A\u5FC5\u586B\u6B04\u4F4D\uFF1Aid, name, owner, startDate, endDate");
  }
  if (!TRIPID_RE.test(id) || id.length > 100) {
    throw new AppError("DATA_VALIDATION", "tripId \u683C\u5F0F\u932F\u8AA4\uFF1A\u50C5\u5141\u8A31\u5C0F\u5BEB\u82F1\u6578\u5B57\u8207\u9023\u5B57\u865F\uFF0C\u6700\u9577 100 \u5B57\u5143");
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    throw new AppError("DATA_VALIDATION", "\u65E5\u671F\u683C\u5F0F\u932F\u8AA4\uFF1A\u9808\u70BA YYYY-MM-DD");
  }
  const start = /* @__PURE__ */ new Date(startDate + "T00:00:00Z");
  const end = /* @__PURE__ */ new Date(endDate + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("DATA_VALIDATION", "\u65E5\u671F\u7121\u6548");
  }
  if (end < start) {
    throw new AppError("DATA_VALIDATION", "endDate \u5FC5\u9808 \u2265 startDate");
  }
  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (totalDays > MAX_DAYS) {
    throw new AppError("DATA_VALIDATION", `\u884C\u7A0B\u5929\u6578\u4E0D\u53EF\u8D85\u904E ${MAX_DAYS} \u5929`);
  }
  const db = context.env.DB;
  const existing = await db.prepare("SELECT 1 FROM trips WHERE id = ?").bind(id).first();
  if (existing) throw new AppError("DATA_CONFLICT", "tripId \u5DF2\u5B58\u5728");
  const stmts = [];
  stmts.push(
    db.prepare(
      "INSERT INTO trips (id, name, owner, title, description, og_description, self_drive, countries, published, food_prefs, auto_scroll, footer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      name,
      owner,
      str(body.title),
      str(body.description),
      str(body.og_description),
      body.self_drive != null ? Number(body.self_drive) : 0,
      str(body.countries, "JP"),
      body.published != null ? Number(body.published) : 0,
      str(body.food_prefs),
      str(body.auto_scroll),
      str(body.footer)
    )
  );
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    const date = d.toISOString().slice(0, 10);
    const dayOfWeek = WEEKDAYS[d.getUTCDay()];
    stmts.push(
      db.prepare(
        "INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, i + 1, date, dayOfWeek, "")
    );
  }
  stmts.push(
    db.prepare(
      "INSERT INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?)"
    ).bind(auth.email, id, "admin")
  );
  await db.batch(stmts);
  await logAudit(db, {
    tripId: id,
    tableName: "trips",
    recordId: null,
    action: "insert",
    changedBy: auth.email,
    diffJson: JSON.stringify(body)
  });
  return json({ ok: true, tripId: id, daysCreated: totalDays }, 201);
}, "onRequestPost");
var onRequestGet9 = /* @__PURE__ */ __name(async (context) => {
  const url = new URL(context.request.url);
  const showAll = url.searchParams.get("all") === "1";
  const auth = getAuth(context);
  let sql;
  if (showAll && auth?.isAdmin) {
    sql = "SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips ORDER BY name ASC";
  } else {
    sql = "SELECT id AS tripId, name, owner, title, self_drive, countries, published, auto_scroll, footer, is_default FROM trips WHERE published = 1 ORDER BY name ASC";
  }
  const { results } = await context.env.DB.prepare(sql).all();
  return json(results);
}, "onRequestGet");

// trip/[[path]].ts
var NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>\u627E\u4E0D\u5230\u884C\u7A0B \u2014 Tripline</title></head>
<body><h1>404 \u627E\u4E0D\u5230\u884C\u7A0B</h1><p>\u8ACB\u78BA\u8A8D\u884C\u7A0B\u7DB2\u5740\u662F\u5426\u6B63\u78BA\u3002</p></body>
</html>`;
var onRequestGet10 = /* @__PURE__ */ __name(async (context) => {
  const url = new URL(context.request.url);
  const pathParts = url.pathname.replace(/^\/trip\//, "").split("/");
  const tripId = pathParts[0];
  if (!tripId) {
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
  const trip = await context.env.DB.prepare("SELECT id, name, title, countries FROM trips WHERE id = ?").bind(tripId).first();
  if (!trip) {
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
  const ogTitle = `${trip.title} \u2014 Tripline`;
  const ogDescription = trip.countries ? `${trip.countries} \u884C\u7A0B` : "\u884C\u7A0B\u898F\u5283";
  const assetResponse = await context.env.ASSETS.fetch(
    new Request("https://placeholder/index.html")
  );
  return new HTMLRewriter().on("title", {
    element(el) {
      el.setInnerContent(ogTitle);
    }
  }).on('meta[property="og:title"]', {
    element(el) {
      el.setAttribute("content", ogTitle);
    }
  }).on('meta[property="og:description"]', {
    element(el) {
      el.setAttribute("content", ogDescription);
    }
  }).on('meta[property="og:site_name"]', {
    element(el) {
      el.setAttribute("content", "Tripline");
    }
  }).transform(assetResponse);
}, "onRequestGet");

// api/_middleware.ts
function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key.trim() === name) return valueParts.join("=");
  }
  return null;
}
__name(getCookie, "getCookie");
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
__name(decodeJwtPayload, "decodeJwtPayload");
var onRequest = /* @__PURE__ */ __name(async (context) => {
  const start = Date.now();
  const { request, env } = context;
  const url = new URL(request.url);
  try {
    const response = await handleAuth(context);
    const duration = Date.now() - start;
    if (response.status >= 400) {
      context.waitUntil(
        env.DB.prepare(
          "INSERT INTO api_logs (method, path, status, duration) VALUES (?, ?, ?, ?)"
        ).bind(request.method, url.pathname, response.status, duration).run()
      );
    }
    return response;
  } catch (err) {
    const duration = Date.now() - start;
    if (err instanceof AppError) {
      context.waitUntil(
        env.DB.prepare(
          "INSERT INTO api_logs (method, path, status, error, duration) VALUES (?, ?, ?, ?, ?)"
        ).bind(request.method, url.pathname, err.status, err.code, duration).run()
      );
      return errorResponse(err);
    }
    context.waitUntil(
      env.DB.prepare(
        "INSERT INTO api_logs (method, path, status, error, duration) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        request.method,
        url.pathname,
        500,
        err instanceof Error ? err.message : String(err),
        duration
      ).run()
    );
    return errorResponse(new AppError("SYS_INTERNAL"));
  }
}, "onRequest");
var PRODUCTION_ORIGIN = "https://trip-planner-dby.pages.dev";
function isAllowedOrigin(origin, env) {
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (/^https:\/\/[a-f0-9]+\.trip-planner-dby\.pages\.dev$/.test(origin)) return true;
  if (env.ALLOWED_ORIGIN) {
    const allowed = env.ALLOWED_ORIGIN.split(",").map((s) => s.trim());
    if (allowed.includes(origin)) return true;
  }
  return false;
}
__name(isAllowedOrigin, "isAllowedOrigin");
function checkCsrf(request, env) {
  const method = request.method.toUpperCase();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (!mutating) return null;
  const origin = request.headers.get("Origin");
  if (!origin) {
    const hasServiceToken = !!request.headers.get("CF-Access-Client-Id") && !!request.headers.get("CF-Access-Client-Secret");
    if (hasServiceToken) return null;
    return errorResponse(new AppError("PERM_DENIED", "Origin header required"));
  }
  if (!isAllowedOrigin(origin, env)) {
    return errorResponse(new AppError("PERM_DENIED", "Invalid origin"));
  }
  return null;
}
__name(checkCsrf, "checkCsrf");
var COMPANION_ALLOWED = [
  { method: "PATCH", pattern: /^\/api\/trips\/[^/]+\/entries\/\d+$/ },
  { method: "POST", pattern: /^\/api\/trips\/[^/]+\/entries\/\d+\/trip-pois$/ },
  { method: "PATCH", pattern: /^\/api\/trips\/[^/]+\/trip-pois\/\d+$/ },
  { method: "DELETE", pattern: /^\/api\/trips\/[^/]+\/trip-pois\/\d+$/ },
  { method: "PUT", pattern: /^\/api\/trips\/[^/]+\/docs\/\w+$/ },
  { method: "PATCH", pattern: /^\/api\/requests\/\d+$/ },
  { method: "GET", pattern: /^\/api\/trips\// },
  { method: "GET", pattern: /^\/api\/requests/ }
];
function checkCompanionScope(request, url) {
  const scope = request.headers.get("X-Request-Scope");
  if (scope !== "companion") return null;
  const method = request.method.toUpperCase();
  const path = url.pathname;
  const allowed = COMPANION_ALLOWED.some((r) => r.method === method && r.pattern.test(path));
  if (allowed) return null;
  return errorResponse(new AppError("PERM_DENIED", "\u6B64\u64CD\u4F5C\u8D85\u51FA\u65C5\u4F34\u8ACB\u6C42\u7BC4\u570D"));
}
__name(checkCompanionScope, "checkCompanionScope");
async function handleAuth(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (env.DEV_MOCK_EMAIL) {
    const email2 = env.DEV_MOCK_EMAIL.toLowerCase();
    context.data.auth = {
      email: email2,
      isAdmin: email2 === (env.ADMIN_EMAIL || "").toLowerCase(),
      isServiceToken: false
    };
    return context.next();
  }
  const csrfError = checkCsrf(request, env);
  if (csrfError) return csrfError;
  const scopeError = checkCompanionScope(request, url);
  if (scopeError) return scopeError;
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const cloned = request.clone();
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const bodyText = decoder.decode(new Uint8Array(await cloned.arrayBuffer()));
      if (detectGarbledText(bodyText)) {
        return errorResponse(new AppError("DATA_ENCODING", "Request body \u5305\u542B\u7591\u4F3C\u4E82\u78BC\uFF0C\u8ACB\u78BA\u8A8D encoding \u70BA UTF-8"));
      }
    } catch {
      return errorResponse(new AppError("DATA_ENCODING", "Request body is not valid UTF-8"));
    }
  }
  if (request.method === "POST" && url.pathname === "/api/reports") {
    context.data.auth = null;
    return context.next();
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/trips")) {
    const stClientId = request.headers.get("CF-Access-Client-Id");
    const stClientSecret = request.headers.get("CF-Access-Client-Secret");
    if (stClientId && stClientSecret) {
      context.data.auth = {
        email: env.ADMIN_EMAIL,
        isAdmin: true,
        isServiceToken: true
      };
      return context.next();
    }
    const token2 = getCookie(request, "CF_Authorization");
    if (token2) {
      const payload2 = decodeJwtPayload(token2);
      if (payload2?.email) {
        const email2 = String(payload2.email).toLowerCase();
        context.data.auth = {
          email: email2,
          isAdmin: env.ADMIN_EMAIL ? email2 === env.ADMIN_EMAIL.toLowerCase() : false,
          isServiceToken: false
        };
      } else if (payload2?.common_name) {
        context.data.auth = {
          email: env.ADMIN_EMAIL,
          isAdmin: true,
          isServiceToken: true
        };
      }
    }
    return context.next();
  }
  const clientId = request.headers.get("CF-Access-Client-Id");
  const clientSecret = request.headers.get("CF-Access-Client-Secret");
  if (clientId && clientSecret) {
    context.data.auth = {
      email: env.ADMIN_EMAIL,
      isAdmin: true,
      isServiceToken: true
    };
    return context.next();
  }
  const token = getCookie(request, "CF_Authorization");
  if (!token) {
    return errorResponse(new AppError("AUTH_REQUIRED"));
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return errorResponse(new AppError("AUTH_INVALID"));
  }
  if (!payload.email && payload.common_name) {
    context.data.auth = {
      email: env.ADMIN_EMAIL,
      isAdmin: true,
      isServiceToken: true
    };
    return context.next();
  }
  if (!payload.email) {
    return errorResponse(new AppError("AUTH_INVALID"));
  }
  const email = String(payload.email).toLowerCase();
  const isAdmin = email === env.ADMIN_EMAIL.toLowerCase();
  context.data.auth = {
    email,
    isAdmin,
    isServiceToken: false
  };
  return context.next();
}
__name(handleAuth, "handleAuth");

// ../.wrangler/tmp/pages-QmW80m/functionsRoutes-0.96144304851179.mjs
var routes = [
  {
    routePath: "/api/trips/:id/audit/:aid/rollback",
    mountPath: "/api/trips/:id/audit/:aid",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/trips/:id/entries/:eid/trip-pois",
    mountPath: "/api/trips/:id/entries/:eid",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/trips/:id/days/:num",
    mountPath: "/api/trips/:id/days",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/trips/:id/days/:num",
    mountPath: "/api/trips/:id/days",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/trips/:id/docs/:type",
    mountPath: "/api/trips/:id/docs",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/trips/:id/docs/:type",
    mountPath: "/api/trips/:id/docs",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/trips/:id/entries/:eid",
    mountPath: "/api/trips/:id/entries",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/trips/:id/entries/:eid",
    mountPath: "/api/trips/:id/entries",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch]
  },
  {
    routePath: "/api/trips/:id/trip-pois/:tpid",
    mountPath: "/api/trips/:id/trip-pois",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/trips/:id/trip-pois/:tpid",
    mountPath: "/api/trips/:id/trip-pois",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch2]
  },
  {
    routePath: "/api/trips/:id/audit",
    mountPath: "/api/trips/:id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/trips/:id/days",
    mountPath: "/api/trips/:id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/permissions/:id",
    mountPath: "/api/permissions",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/pois/:id",
    mountPath: "/api/pois",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch3]
  },
  {
    routePath: "/api/requests/:id",
    mountPath: "/api/requests",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch4]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut3]
  },
  {
    routePath: "/api/my-trips",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/permissions",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/permissions",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/requests",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/requests",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/trips",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/trips",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/trip/:path*",
    mountPath: "/trip",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api",
    mountPath: "/api",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];

// ../node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-fabjq6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-fabjq6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.16002018011760244.mjs.map
