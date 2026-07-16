#!/usr/bin/env node
/**
 * 算出「D1 還沒套用的 migration」，一行一個檔名印到 stdout。
 *
 * 用法（wrangler 留在呼叫端，本檔只吃 JSON → 無網路、可 unit test）：
 *   npx wrangler d1 execute <db> --remote --env production --json \
 *     --command "SELECT name FROM d1_migrations" \
 *     | node scripts/d1-pending-migrations.js migrations > pending.txt
 *
 * 為什麼要有這支：check-migration-safety.sh 原本拿 git 時間軸推測哪些 migration 是
 * 「新的」，但 git 不知道 prod 套用到哪。實測出三種洗白路徑 —— 被 exit 1 擋下的
 * migration 只要之後有任何 commit 動到 migrations/ 就會降級成 pre-existing；git mv
 * 換個編號也會；一次推多個 commit 也會。d1_migrations 才是權威：只要還沒套用就該檢查，
 * 跟 git 怎麼動完全無關。
 */
const fs = require('node:fs');
const path = require('node:path');

/** wrangler --json 回 [{ results: [{name}], success, meta }]；也容忍被包一層的形狀。 */
function appliedNames(raw) {
  const parsed = JSON.parse(raw);
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  const names = [];
  for (const b of blocks) {
    for (const row of b?.results ?? []) {
      if (typeof row?.name === 'string') names.push(row.name);
    }
  }
  // 查得到 d1_migrations 但一筆都沒有，跟「查詢根本沒跑成」是兩回事。前者代表全新的
  // DB（每個 migration 都 pending，全部該檢查）；後者下面會因為 JSON 解析失敗而 throw。
  return new Set(names);
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: d1-pending-migrations.js <migrations-dir>  (d1_migrations JSON on stdin)');
    process.exit(2);
  }
  const raw = fs.readFileSync(0, 'utf8');
  let applied;
  try {
    applied = appliedNames(raw);
  } catch (err) {
    // 解析不出來 ≠ 沒有東西套用過。回空集合會讓每個 migration 都變 pending，
    // 那方向是安全的（多擋）；但也可能是 wrangler 認證掛了印了別的東西 ——
    // 那該讓 CI 紅，不是默默走進一個「全部都是新的」的假象。
    console.error(`❌ 解析不出 d1_migrations 查詢結果：${err.message}`);
    console.error(`   stdin 前 200 字：${raw.slice(0, 200)}`);
    process.exit(2);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.error(`❌ '${dir}/' 沒有任何 .sql —— 拒絕在沒東西可掃的情況下回報空 pending。`);
    process.exit(2);
  }
  for (const f of files) {
    if (!applied.has(f)) console.log(f);
  }
}

if (require.main === module) main();
module.exports = { appliedNames };
