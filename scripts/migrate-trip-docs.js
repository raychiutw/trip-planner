#!/usr/bin/env node
// migrate-trip-docs.js — 將 trip_docs.content 從 JSON 轉換為 Markdown 格式
// 使用方式：
//   node scripts/migrate-trip-docs.js --from-backup backups/2026-03-28T01-36-39 --dry-run
//   node scripts/migrate-trip-docs.js --local
//   node scripts/migrate-trip-docs.js

'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var execSync = require('child_process').execSync;

// ─── CLI 參數解析 ───

var args = process.argv.slice(2);
var dryRun = args.includes('--dry-run');
var local = args.includes('--local');
var fromBackupIdx = args.indexOf('--from-backup');
var fromBackup = fromBackupIdx !== -1 ? args[fromBackupIdx + 1] : null;

if (fromBackupIdx !== -1 && !fromBackup) {
  console.error('ERROR: --from-backup 需要指定備份目錄路徑');
  process.exit(1);
}

// ─── 優先序對照表（suggestions doc_type） ───

var PRIORITY_EMOJI = {
  high: '\u{1F534}',   // 🔴
  medium: '\u{1F7E1}', // 🟡
  low: '\u{1F7E2}'     // 🟢
};

var PRIORITY_LABEL = {
  high: '高優先',
  medium: '中優先',
  low: '低優先'
};

// ─── Markdown 轉換器 ───

function convertFlights(parsed) {
  var title = parsed.title || '航班資訊';
  var content = parsed.content;
  var lines = [];

  lines.push('## ' + title);
  lines.push('');

  // 航班表格
  if (content.segments && content.segments.length > 0) {
    lines.push('| 航班 | 路線 | 時間 |');
    lines.push('|------|------|------|');
    content.segments.forEach(function(seg) {
      lines.push('| ' + escMd(seg.label) + ' | ' + escMd(seg.route) + ' | ' + escMd(seg.time) + ' |');
    });
    lines.push('');
  }

  // 航空公司資訊
  if (content.airline) {
    if (content.airline.name) {
      lines.push('**航空公司：** ' + content.airline.name);
    }
    if (content.airline.note) {
      lines.push(content.airline.note);
    }
  }

  return lines.join('\n').trim();
}

function convertChecklist(parsed) {
  var title = parsed.title || '出發前確認事項';
  var content = parsed.content;
  var lines = [];

  lines.push('## ' + title);
  lines.push('');

  if (content.cards && content.cards.length > 0) {
    content.cards.forEach(function(card, i) {
      lines.push('### ' + card.title);
      if (card.items && card.items.length > 0) {
        card.items.forEach(function(item) {
          lines.push('- [ ] ' + item);
        });
      }
      if (card.notes && card.notes.length > 0) {
        lines.push('');
        card.notes.forEach(function(note) {
          lines.push('> ' + note);
        });
      }
      if (i < content.cards.length - 1) {
        lines.push('');
      }
    });
  }

  return lines.join('\n').trim();
}

function convertBackup(parsed) {
  var title = parsed.title || '雨天備案';
  var content = parsed.content;
  var lines = [];

  lines.push('## ' + title);
  lines.push('');

  if (content.cards && content.cards.length > 0) {
    content.cards.forEach(function(card, i) {
      lines.push('### ' + card.title);
      if (card.weatherItems && card.weatherItems.length > 0) {
        card.weatherItems.forEach(function(item) {
          lines.push('- ' + item);
        });
      }
      if (i < content.cards.length - 1) {
        lines.push('');
      }
    });
  }

  return lines.join('\n').trim();
}

function convertSuggestions(parsed) {
  var title = parsed.title || 'AI 行程建議';
  var content = parsed.content;
  var lines = [];

  lines.push('## ' + title);
  lines.push('');

  if (content.cards && content.cards.length > 0) {
    content.cards.forEach(function(card, i) {
      var emoji = PRIORITY_EMOJI[card.priority] || '';
      var label = PRIORITY_LABEL[card.priority] || card.title;
      lines.push('### ' + emoji + ' ' + label);
      if (card.items && card.items.length > 0) {
        card.items.forEach(function(item) {
          lines.push('- ' + item);
        });
      }
      if (i < content.cards.length - 1) {
        lines.push('');
      }
    });
  }

  return lines.join('\n').trim();
}

function convertEmergency(parsed) {
  var title = parsed.title || '緊急聯絡資訊';
  var content = parsed.content;
  var lines = [];

  lines.push('## ' + title);
  lines.push('');

  if (content.cards && content.cards.length > 0) {
    content.cards.forEach(function(card, i) {
      lines.push('### ' + card.title);

      // 聯絡電話
      if (card.contacts && card.contacts.length > 0) {
        card.contacts.forEach(function(c) {
          if (c.url) {
            lines.push('- [' + escMd(c.label) + '](' + c.url + ')');
          } else {
            lines.push('- ' + c.label + (c.phone ? '：' + c.phone : ''));
          }
        });
      }

      // 地址
      if (card.address) {
        lines.push('');
        lines.push('> ' + card.address);
      }

      // 備註
      if (card.notes && card.notes.length > 0) {
        lines.push('');
        card.notes.forEach(function(note) {
          lines.push('> ' + note);
        });
      }

      if (i < content.cards.length - 1) {
        lines.push('');
      }
    });
  }

  return lines.join('\n').trim();
}

// ─── 工具函式 ───

function escMd(str) {
  if (!str) return '';
  // 表格中的 pipe 字元需要轉義
  return str.replace(/\|/g, '\\|');
}

function isMarkdown(content) {
  // 簡易判斷：以 ## 開頭的就是 Markdown
  if (typeof content !== 'string') return false;
  var trimmed = content.trim();
  return trimmed.startsWith('## ') || trimmed.startsWith('# ');
}

function tryParseJson(content) {
  if (typeof content !== 'string') return null;
  var trimmed = content.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return null;
  }
}

var CONVERTERS = {
  flights: convertFlights,
  checklist: convertChecklist,
  backup: convertBackup,
  suggestions: convertSuggestions,
  emergency: convertEmergency
};

function convertDoc(doc) {
  var content = doc.content;

  // 已經是 Markdown → 跳過
  if (isMarkdown(content)) {
    return { skip: true, reason: 'already markdown' };
  }

  // 嘗試解析 JSON
  var parsed = tryParseJson(content);
  if (!parsed) {
    return { skip: true, reason: 'invalid JSON' };
  }

  var converter = CONVERTERS[doc.doc_type];
  if (!converter) {
    return { skip: true, reason: 'unknown doc_type: ' + doc.doc_type };
  }

  var md = converter(parsed);
  return { skip: false, markdown: md };
}

// ─── D1 執行 ───

function execD1(sql) {
  var localFlag = local ? ' --local' : '';
  // 寫入暫存檔避免命令列長度限制與跳脫問題
  var tmpFile = path.join(os.tmpdir(), 'migrate-trip-docs-' + Date.now() + '.sql');
  fs.writeFileSync(tmpFile, sql, 'utf8');
  try {
    var cmd = 'npx wrangler d1 execute trip-planner-db --file="' + tmpFile + '"' + localFlag;
    var result = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  }
}

function fetchDocs() {
  var sql = 'SELECT id, trip_id, doc_type, content FROM trip_docs ORDER BY id;';
  var localFlag = local ? ' --local' : '';
  var cmd = 'npx wrangler d1 execute trip-planner-db --command="' + sql + '"' + localFlag + ' --json';
  var raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  var parsed = JSON.parse(raw);
  // wrangler d1 execute --json 回傳 [{results: [...]}]
  if (Array.isArray(parsed) && parsed[0] && parsed[0].results) {
    return parsed[0].results;
  }
  throw new Error('Unexpected D1 response format: ' + raw.substring(0, 200));
}

// ─── 主流程 ───

function main() {
  console.log('migrate-trip-docs: JSON → Markdown 轉換');
  console.log('  --from-backup: ' + (fromBackup || '(live D1)'));
  console.log('  --dry-run: ' + dryRun);
  console.log('  --local: ' + local);
  console.log('');

  // 讀取文件
  var docs;
  if (fromBackup) {
    var backupPath = path.resolve(fromBackup, 'trip_docs.json');
    if (!fs.existsSync(backupPath)) {
      console.error('ERROR: 找不到備份檔案 ' + backupPath);
      process.exit(1);
    }
    docs = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log('從備份載入 ' + docs.length + ' 筆 trip_docs');
  } else {
    console.log('從 D1 讀取 trip_docs...');
    docs = fetchDocs();
    console.log('載入 ' + docs.length + ' 筆 trip_docs');
  }
  console.log('');

  // 轉換
  var converted = 0;
  var skipped = 0;
  var warnings = [];
  var updates = [];

  docs.forEach(function(doc) {
    var label = '[id=' + doc.id + ' ' + doc.trip_id + '/' + doc.doc_type + ']';
    var result = convertDoc(doc);

    if (result.skip) {
      skipped++;
      if (result.reason === 'invalid JSON') {
        warnings.push(label + ' — ' + result.reason);
        console.log('  WARN ' + label + ' ' + result.reason);
      } else {
        console.log('  SKIP ' + label + ' ' + result.reason);
      }
      return;
    }

    converted++;
    console.log('  CONVERT ' + label);

    if (dryRun) {
      console.log('--- markdown output ---');
      console.log(result.markdown);
      console.log('--- end ---');
      console.log('');
    }

    updates.push({ id: doc.id, markdown: result.markdown });
  });

  // 寫入 D1
  if (!dryRun && updates.length > 0) {
    console.log('');
    console.log('寫入 D1...');

    // 批次產生 SQL
    var sqlStatements = updates.map(function(u) {
      var escaped = u.markdown.replace(/'/g, "''");
      return "UPDATE trip_docs SET content = '" + escaped + "' WHERE id = " + u.id + ";";
    });

    // 分批執行（每批最多 20 筆，避免命令過長）
    var batchSize = 20;
    for (var i = 0; i < sqlStatements.length; i += batchSize) {
      var batch = sqlStatements.slice(i, i + batchSize);
      execD1(batch.join('\n'));
      console.log('  batch ' + (Math.floor(i / batchSize) + 1) + ': ' + batch.length + ' docs updated');
    }
  }

  // 摘要
  console.log('');
  console.log('=== Summary ===');
  console.log('  Converted: ' + converted);
  console.log('  Skipped:   ' + skipped);
  if (warnings.length > 0) {
    console.log('  Warnings:  ' + warnings.length);
    warnings.forEach(function(w) {
      console.log('    ' + w);
    });
  }
  if (dryRun) {
    console.log('  (dry-run mode — no changes written)');
  }
}

main();
