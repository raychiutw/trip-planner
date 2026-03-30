/**
 * 遷移 trip_docs (JSON content) → trip_docs_v2 + trip_doc_entries (relational)
 *
 * 用法: node scripts/migrate-docs-to-v2.js [--staging]
 *
 * 直接操作 D1 database（wrangler d1 execute），不經 API。
 * 這樣可以在 deploy 新 code 前安全執行：
 *   1. wrangler d1 migrations apply trip-planner-db
 *   2. node scripts/migrate-docs-to-v2.js
 *   3. deploy 新 code
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const isStaging = process.argv.includes('--staging');
const DB_NAME = isStaging ? 'trip-planner-db-staging' : 'trip-planner-db';
const ENV_FLAG = isStaging ? '--env preview' : '';
const TMP_SQL = path.join(os.tmpdir(), 'migrate-docs-tmp.sql');

function d1read(sql) {
  // --command for reads (no special chars in SELECT queries)
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote ${ENV_FLAG} --json --command="${escaped}"`;
  const out = execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
  const jsonStart = out.indexOf('[');
  if (jsonStart === -1) return [];
  return JSON.parse(out.slice(jsonStart))[0]?.results ?? [];
}

function d1write(sql) {
  // --file for writes (content may have special chars like →)
  fs.writeFileSync(TMP_SQL, sql, 'utf8');
  const winPath = TMP_SQL.replace(/\//g, '\\');
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote ${ENV_FLAG} --json --file="${winPath}"`;
  const out = execSync(cmd, { encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
  const jsonStart = out.indexOf('[');
  if (jsonStart === -1) {
    const objStart = out.indexOf('{');
    if (objStart >= 0) {
      const err = JSON.parse(out.slice(objStart));
      if (err.error) throw new Error(err.error.text || 'D1 error');
    }
    return [];
  }
  return JSON.parse(out.slice(jsonStart))[0]?.results ?? [];
}

/** Parse old JSON doc content → { title, entries: [{section, title, content}] } */
function parseDoc(docType, raw) {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return { title: '', entries: [] }; }
  }
  if (!parsed || typeof parsed !== 'object') return { title: '', entries: [] };

  const docTitle = parsed.title || '';
  const inner = parsed.content || parsed;
  const entries = [];

  if (docType === 'flights') {
    if (inner.segments) {
      for (const seg of inner.segments) {
        entries.push({
          section: '',
          title: seg.label || '',
          content: [seg.route, seg.time].filter(Boolean).join('\n'),
        });
      }
    }
    if (inner.airline) {
      entries.push({
        section: '',
        title: inner.airline.name || '',
        content: inner.airline.note || '',
      });
    }
  } else if (docType === 'checklist') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.items) {
          for (const item of card.items) {
            entries.push({ section, title: typeof item === 'string' ? item : (item.text || ''), content: '' });
          }
        }
      }
    } else if (inner.items) {
      for (const item of inner.items) {
        entries.push({ section: '', title: typeof item === 'string' ? item : (item.text || ''), content: '' });
      }
    }
  } else if (docType === 'backup') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.description) {
          entries.push({ section, title: '', content: card.description });
        }
        const items = card.weatherItems || card.items || [];
        for (const item of items) {
          entries.push({ section, title: typeof item === 'string' ? item : '', content: '' });
        }
      }
    }
  } else if (docType === 'suggestions') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        const items = card.items || [];
        if (items.length > 0) {
          for (const item of items) {
            entries.push({ section, title: typeof item === 'string' ? item : '', content: '' });
          }
        } else if (card.description) {
          entries.push({ section, title: '', content: card.description });
        }
      }
    }
  } else if (docType === 'emergency') {
    if (inner.cards) {
      for (const card of inner.cards) {
        const section = card.title || '';
        if (card.contacts) {
          for (const c of card.contacts) {
            const phone = c.phone || '';
            const url = c.url || (phone ? `tel:${phone}` : '');
            const label = c.label || phone;
            entries.push({
              section,
              title: label,
              content: url ? `[${phone || label}](${url})` : '',
            });
          }
        }
      }
    } else if (inner.contacts) {
      for (const c of inner.contacts) {
        const phone = c.phone || c.number || '';
        entries.push({
          section: '',
          title: c.label || phone,
          content: phone ? `[${phone}](tel:${phone})` : '',
        });
      }
    }
  }

  return { title: docTitle, entries };
}

function escSql(s) {
  return s.replace(/'/g, "''");
}

function main() {
  console.log(`DB: ${DB_NAME}\n`);

  // 1. 讀取所有舊 trip_docs
  const oldDocs = d1read("SELECT trip_id, doc_type, content FROM trip_docs WHERE content IS NOT NULL AND LENGTH(content) > 0 AND NOT EXISTS (SELECT 1 FROM trip_docs_v2 v2 WHERE v2.trip_id = trip_docs.trip_id AND v2.doc_type = trip_docs.doc_type)");
  console.log(`Found ${oldDocs.length} old docs\n`);

  let totalDocs = 0;
  let totalEntries = 0;

  for (const doc of oldDocs) {
    const { trip_id, doc_type, content } = doc;
    try {
      const { title, entries } = parseDoc(doc_type, content);

      if (entries.length === 0) {
        console.log(`  ${trip_id}/${doc_type}: no entries → skip`);
        continue;
      }

      // 2. Upsert trip_docs_v2
      d1write(`INSERT INTO trip_docs_v2 (trip_id, doc_type, title, updated_at) VALUES ('${escSql(trip_id)}', '${escSql(doc_type)}', '${escSql(title)}', datetime('now')) ON CONFLICT(trip_id, doc_type) DO UPDATE SET title = excluded.title, updated_at = datetime('now');`);

      // 3. 取得 doc_id
      const rows = d1read(`SELECT id FROM trip_docs_v2 WHERE trip_id = '${escSql(trip_id)}' AND doc_type = '${escSql(doc_type)}'`);
      const docId = rows[0]?.id;
      if (!docId) {
        console.log(`  ${trip_id}/${doc_type}: ERROR - no doc_id`);
        continue;
      }

      // 4. Batch: 清除舊 entries + 插入新 entries (一次 SQL 呼叫)
      const stmts = [`DELETE FROM trip_doc_entries WHERE doc_id = ${docId};`];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        stmts.push(`INSERT INTO trip_doc_entries (doc_id, sort_order, section, title, content) VALUES (${docId}, ${i}, '${escSql(e.section)}', '${escSql(e.title)}', '${escSql(e.content)}');`);
      }
      d1write(stmts.join('\n'));

      console.log(`  ${trip_id}/${doc_type}: ${entries.length} entries → OK`);
      totalDocs++;
      totalEntries += entries.length;
    } catch (err) {
      console.log(`  ${trip_id}/${doc_type}: ERROR - ${(err.message || '').slice(0, 80)}`);
    }
  }

  console.log(`\nDone: ${totalDocs} docs, ${totalEntries} entries migrated`);
}

main();
