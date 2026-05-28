#!/usr/bin/env bun
/**
 * import-huiyun-trip-notes.ts — one-shot import: 把 HuiYun trip 舊 trip_docs JSON
 * 匯入到 v2.34.0 新表（trip_pretrip_notes / trip_emergency_contacts / trip_lodgings）。
 *
 * 背景：v2.17.17 IA 重整時 SpeedDial → flights/checklist/emergency/backup/suggestions
 * 5 bottom sheets 被拔除，content 留在 trip_docs 表閒置。HuiYun trip 的最後實質
 * 內容存於 backups/2026-03-28T18-21-54/trip_docs.json，本 script 把它撈進 v2.34.0
 * 新 normalized table。
 *
 * Source files（user 預先存）：
 *   /tmp/huiyun-rescue/checklist.json — 7 cards × items[]（證件 / 通訊 / 金錢 /
 *     租車 / 住宿 / 預訂 / 颱風）
 *   /tmp/huiyun-rescue/emergency.json — 3 cards（緊急電話 contacts / 旅遊保險 notes /
 *     住宿聯絡 contacts + notes）
 *
 * Mapping policy（schema 適配檢驗結果）：
 *   checklist 7 cards → 7 trip_pretrip_notes rows（title + content markdown bullets）
 *   emergency 緊急電話 3 contacts + 住宿 1 contact → 4 trip_emergency_contacts rows
 *   emergency 旅遊保險 + 住宿地址 3 notes → 1 trip_pretrip_notes row (「行前提醒」聚合)
 *   住宿 3 hotels（Mercure / BUZZ / HOPE VILLA）→ 3 trip_lodgings rows
 *
 * Usage:
 *   bun scripts/import-huiyun-trip-notes.ts --dry-run --local --trip-id=<tripId>
 *   bun scripts/import-huiyun-trip-notes.ts --apply --remote --trip-id=<tripId>
 *
 * Idempotent guard: 偵測該 trip 已有 trip_pretrip_notes / trip_emergency_contacts
 * row → skip（避免 re-run 重複 INSERT）。要強制 re-import 必須先手動 DELETE。
 */

import { readFileSync } from 'node:fs';

interface CliFlags {
  apply: boolean;
  dryRun: boolean;
  local: boolean;
  remote: boolean;
  tripId: string;
  checklistPath: string;
  emergencyPath: string;
}

function parseFlags(argv: string[]): CliFlags {
  const tripIdArg = argv.find((a) => a.startsWith('--trip-id='));
  const checklistArg = argv.find((a) => a.startsWith('--checklist='));
  const emergencyArg = argv.find((a) => a.startsWith('--emergency='));
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run'),
    local: argv.includes('--local'),
    remote: argv.includes('--remote'),
    tripId: tripIdArg ? tripIdArg.split('=')[1] : '',
    checklistPath: checklistArg ? checklistArg.split('=')[1] : '/tmp/huiyun-rescue/checklist.json',
    emergencyPath: emergencyArg ? emergencyArg.split('=')[1] : '/tmp/huiyun-rescue/emergency.json',
  };
}

interface ChecklistCard {
  title: string;
  items?: string[];
}
interface EmergencyContact {
  label: string;
  phone: string;
  url?: string;
}
interface EmergencyCard {
  title: string;
  contacts?: EmergencyContact[];
  notes?: string[];
}

interface MappedRow {
  table: 'trip_pretrip_notes' | 'trip_emergency_contacts' | 'trip_lodgings';
  cols: string[];
  values: (string | number | null)[];
}

export function buildImportPlan(
  tripId: string,
  checklist: { content: { cards: ChecklistCard[] } },
  emergency: { content: { cards: EmergencyCard[] } },
): MappedRow[] {
  const plan: MappedRow[] = [];
  let pretripOrder = 0;
  let emergencyOrder = 0;
  let lodgingOrder = 0;

  // 1. checklist 7 cards → trip_pretrip_notes (markdown bullet list)
  for (const card of checklist.content.cards) {
    const items = card.items ?? [];
    const content = items.map((it) => `- ${it}`).join('\n');
    plan.push({
      table: 'trip_pretrip_notes',
      cols: ['trip_id', 'sort_order', 'title', 'content', 'ai_generated', 'ai_source'],
      values: [tripId, pretripOrder++, card.title, content, 0, null],
    });
  }

  // 2. emergency 緊急電話 / 住宿聯絡 contacts → trip_emergency_contacts
  for (const card of emergency.content.cards) {
    const contacts = card.contacts ?? [];
    for (const contact of contacts) {
      let kind: string;
      if (card.title.includes('緊急電話')) {
        if (contact.phone === '110') kind = 'police';
        else if (contact.phone === '119') kind = 'medical';
        else if (contact.label.includes('代表處') || contact.label.includes('辦事處')) kind = 'embassy';
        else kind = 'other';
      } else if (card.title.includes('住宿')) {
        kind = 'hotel';
      } else if (card.title.includes('保險')) {
        kind = 'insurance';
      } else {
        kind = 'other';
      }
      plan.push({
        table: 'trip_emergency_contacts',
        cols: ['trip_id', 'sort_order', 'name', 'phone', 'kind', 'ai_generated'],
        values: [tripId, emergencyOrder++, contact.label, contact.phone, kind, 0],
      });
    }
  }

  // 3. emergency notes（非 contact 的提醒）→ 聚合成 1 個 trip_pretrip_notes「行前提醒」
  const standaloneNotes: string[] = [];
  for (const card of emergency.content.cards) {
    const notes = card.notes ?? [];
    for (const n of notes) {
      standaloneNotes.push(`${card.title}：${n}`);
    }
  }
  if (standaloneNotes.length > 0) {
    plan.push({
      table: 'trip_pretrip_notes',
      cols: ['trip_id', 'sort_order', 'title', 'content', 'ai_generated', 'ai_source'],
      values: [
        tripId,
        pretripOrder++,
        '保險 / 住宿地址',
        standaloneNotes.map((n) => `- ${n}`).join('\n'),
        0,
        null,
      ],
    });
  }

  // 4. 3 個飯店 → trip_lodgings（cross-reference checklist 住宿確認 + emergency 住宿聯絡）
  const hotels = [
    {
      name: '沖繩那霸美居飯店 Mercure',
      address: '沖繩県那霸市 3-3-19 Tsubogawa',
      phone: '',
      note: '7/2、7/5、7/6 共三晚',
    },
    {
      name: 'BUZZ RESORT Chatan',
      address: '沖繩県北谷町',
      phone: '+81-98-982-5337',
      note: '7/3 一晚，凌晨 01:04 入住',
    },
    {
      name: 'HOPE VILLA Onnason',
      address: '沖繩県恩納村',
      phone: '',
      note: '7/4–7/5 共二晚',
    },
  ];
  for (const h of hotels) {
    plan.push({
      table: 'trip_lodgings',
      cols: ['trip_id', 'sort_order', 'name', 'address', 'phone', 'note'],
      values: [tripId, lodgingOrder++, h.name, h.address, h.phone, h.note],
    });
  }

  return plan;
}

function exec(cmd: string): string {
  const proc = Bun.spawnSync(['sh', '-c', cmd]);
  if (!proc.success) {
    throw new Error(`Command failed: ${cmd}\n${new TextDecoder().decode(proc.stderr)}`);
  }
  return new TextDecoder().decode(proc.stdout);
}

function escapeSqlString(v: string): string {
  return v.replace(/'/g, "''");
}

function rowToInsertSql(row: MappedRow): string {
  const placeholders = row.values
    .map((v) => {
      if (v === null) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${escapeSqlString(String(v))}'`;
    })
    .join(', ');
  return `INSERT INTO ${row.table} (${row.cols.join(', ')}) VALUES (${placeholders});`;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (!flags.tripId) {
    console.error('ERR: --trip-id=<tripId> required');
    process.exit(1);
  }
  if (flags.apply === flags.dryRun) {
    console.error('ERR: 必須選 --apply 或 --dry-run 其中一個');
    process.exit(1);
  }
  if (flags.local === flags.remote) {
    console.error('ERR: 必須選 --local 或 --remote 其中一個');
    process.exit(1);
  }

  const checklist = JSON.parse(readFileSync(flags.checklistPath, 'utf8'));
  const emergency = JSON.parse(readFileSync(flags.emergencyPath, 'utf8'));

  const plan = buildImportPlan(flags.tripId, checklist, emergency);

  console.log(`HuiYun Import Plan — trip_id=${flags.tripId}`);
  console.log(`Total rows: ${plan.length}`);
  const byTable: Record<string, number> = {};
  for (const r of plan) byTable[r.table] = (byTable[r.table] ?? 0) + 1;
  for (const [t, n] of Object.entries(byTable)) console.log(`  ${t}: ${n} rows`);

  if (flags.dryRun) {
    console.log('\n--- SQL preview (first 5 rows) ---');
    for (const r of plan.slice(0, 5)) console.log(rowToInsertSql(r));
    console.log('\n[dry-run] 不執行 INSERT。要真正寫入跑 --apply。');
    return;
  }

  // Idempotent guard — wrangler --json 前段有 banner 要 strip 才能 parse
  const dbFlag = flags.remote ? '--remote' : '--local';
  const guardSql = `SELECT COUNT(*) AS n FROM trip_pretrip_notes WHERE trip_id = '${escapeSqlString(flags.tripId)}'`;
  const guardOut = exec(`npx wrangler d1 execute trip-planner-db ${dbFlag} --json --command="${guardSql}"`);
  // Strip banner before first `[` — wrangler v4 prints "🌀 ..." lines first
  const jsonStart = guardOut.indexOf('[');
  if (jsonStart < 0) throw new Error(`Cannot parse wrangler output:\n${guardOut}`);
  const guard = JSON.parse(guardOut.slice(jsonStart));
  const guardCount = guard?.[0]?.results?.[0]?.n ?? 0;
  if (guardCount > 0) {
    console.log(`\n[skip] trip ${flags.tripId} 已有 ${guardCount} 個 trip_pretrip_notes row — 已匯入過。`);
    console.log('要強制 re-import 請先手動 DELETE 既有 row。');
    return;
  }

  console.log(`\n[apply] 寫入 ${plan.length} rows 到 ${dbFlag} DB...`);
  for (const row of plan) {
    const sql = rowToInsertSql(row);
    exec(`npx wrangler d1 execute trip-planner-db ${dbFlag} --command="${sql.replace(/"/g, '\\"')}"`);
  }
  console.log(`✓ Imported ${plan.length} rows`);
}

if (import.meta.main) main().catch((err) => {
  console.error(err);
  process.exit(1);
});
