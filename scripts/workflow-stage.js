#!/usr/bin/env node
// workflow-stage.js — 管理 .workflow-stage 團隊流程旗標
// 使用：node scripts/workflow-stage.js <command> [args]

const fs = require('fs');
const path = require('path');

const STAGE_FILE = path.resolve(process.cwd(), '.workflow-stage');

const STAGES = ['未開始', 'PM', '工程師', 'Reviewer', 'QC', 'Challenger'];
const ROLES = ['pm', 'engineer', 'reviewer', 'qc', 'challenger'];
const ROLE_TO_STAGE = { pm: 1, engineer: 2, reviewer: 3, qc: 4, challenger: 5 };
const REQUIRED_PREV = { engineer: 1, reviewer: 2, qc: 3, challenger: 4 };

function readStage() {
  if (!fs.existsSync(STAGE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STAGE_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ .workflow-stage 格式錯誤：', e.message);
    process.exit(1);
  }
}

function writeStage(data) {
  fs.writeFileSync(STAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function now() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

// ──────────────────────────────────────────────
// Commands
// ──────────────────────────────────────────────

function cmdInit(args) {
  const { positional } = parseArgs(args);
  const changeName = positional[0];
  if (!changeName) {
    console.error('用法：node scripts/workflow-stage.js init "change-name"');
    process.exit(1);
  }

  if (fs.existsSync(STAGE_FILE)) {
    const existing = readStage();
    console.error(`❌ .workflow-stage 已存在（change: ${existing.change}, stage: ${existing.stage}）`);
    console.error('   若要重新開始，請先刪除 .workflow-stage');
    process.exit(1);
  }

  const data = {
    change: changeName,
    stage: 1,
    history: [
      { stage: 1, role: 'pm', ts: now() }
    ]
  };
  writeStage(data);
  console.log(`✅ 工作流程已初始化`);
  console.log(`   change: ${changeName}`);
  console.log(`   stage:  1/5（PM 完成）`);
  console.log(`   下一步：派工程師實作，完成後執行 node scripts/workflow-stage.js advance engineer --tasks N --tsc --test`);
}

function cmdAdvance(args) {
  const { positional, flags } = parseArgs(args);
  const role = positional[0];

  if (!role || !ROLE_TO_STAGE[role]) {
    console.error(`❌ 無效角色：${role}`);
    console.error(`   有效角色：${ROLES.join(', ')}`);
    process.exit(1);
  }

  if (role === 'pm') {
    console.error('❌ pm 不使用 advance，請用 init');
    process.exit(1);
  }

  const data = readStage();
  if (!data) {
    console.error('❌ .workflow-stage 不存在，請先執行 node scripts/workflow-stage.js init "change-name"');
    process.exit(1);
  }

  const requiredPrev = REQUIRED_PREV[role];
  if (data.stage < requiredPrev) {
    console.error(`❌ 無法執行 advance ${role}：目前 stage ${data.stage}（${STAGES[data.stage]}），需要 stage >= ${requiredPrev}（${STAGES[requiredPrev]}）`);
    process.exit(1);
  }

  const targetStage = ROLE_TO_STAGE[role];
  if (data.stage >= targetStage) {
    console.error(`⚠️  ${role} 已完成（stage ${data.stage}），若要重跑請先 reject`);
    process.exit(1);
  }

  // 建立 history entry
  const entry = { stage: targetStage, role, ts: now() };

  if (role === 'engineer') {
    if (flags.tasks !== undefined) entry.tasksCompleted = parseInt(flags.tasks, 10);
    entry.tsc = flags.tsc === true || flags.tsc === 'true';
    entry.test = flags.test === true || flags.test === 'true';
  } else if (role === 'reviewer') {
    const result = flags.result;
    if (!result) {
      console.error('❌ reviewer 需要 --result APPROVE 或 --result "REQUEST CHANGES"');
      process.exit(1);
    }
    if (result !== 'APPROVE' && result !== 'REQUEST CHANGES') {
      console.error(`❌ reviewer --result 必須是 APPROVE 或 "REQUEST CHANGES"，得到：${result}`);
      process.exit(1);
    }
    entry.result = result;
    if (result !== 'APPROVE') {
      console.error('❌ Reviewer REQUEST CHANGES — 請修復後重新 advance reviewer');
      process.exit(1);
    }
  } else if (role === 'qc') {
    const result = flags.result;
    if (!result) {
      console.error('❌ qc 需要 --result PASS 或 --result FAIL');
      process.exit(1);
    }
    if (result !== 'PASS' && result !== 'FAIL') {
      console.error(`❌ qc --result 必須是 PASS 或 FAIL，得到：${result}`);
      process.exit(1);
    }
    entry.result = result;
    if (flags.tests !== undefined) entry.testsCount = parseInt(flags.tests, 10);
    if (result !== 'PASS') {
      console.error('❌ QC FAIL — 請修復後重新跑流程');
      process.exit(1);
    }
  } else if (role === 'challenger') {
    if (flags.high !== undefined) entry.high = parseInt(flags.high, 10);
    if (flags.medium !== undefined) entry.medium = parseInt(flags.medium, 10);
    if (flags.low !== undefined) entry.low = parseInt(flags.low, 10);
  }

  data.stage = targetStage;
  data.history.push(entry);
  writeStage(data);

  console.log(`✅ ${role} 完成 → stage ${targetStage}/5（${STAGES[targetStage]}）`);

  if (targetStage === 5) {
    console.log('');
    console.log('🎉 所有階段完成！可以執行 git commit');
    console.log('   hook 會自動清除 .workflow-stage');
  } else {
    const nextStage = targetStage + 1;
    const nextRole = ROLES[nextStage - 1];
    console.log(`   下一步：${nextRole} 完成後執行 node scripts/workflow-stage.js advance ${nextRole} ...`);
  }
}

function cmdReject(args) {
  const { positional } = parseArgs(args);
  const role = positional[0];
  const targetStageStr = positional[1];

  if (!role) {
    console.error('用法：node scripts/workflow-stage.js reject <role> <target-stage>');
    console.error('範例：node scripts/workflow-stage.js reject reviewer 2');
    process.exit(1);
  }

  const data = readStage();
  if (!data) {
    console.error('❌ .workflow-stage 不存在');
    process.exit(1);
  }

  let targetStage;
  if (targetStageStr !== undefined) {
    targetStage = parseInt(targetStageStr, 10);
  } else if (ROLE_TO_STAGE[role]) {
    // 退回到該角色的前一個階段
    targetStage = ROLE_TO_STAGE[role] - 1;
  } else {
    console.error(`❌ 無效角色：${role}，且未提供 target-stage`);
    process.exit(1);
  }

  if (isNaN(targetStage) || targetStage < 0 || targetStage > 5) {
    console.error(`❌ 無效 target-stage：${targetStageStr}（必須是 0~5）`);
    process.exit(1);
  }

  const prevStage = data.stage;
  data.stage = targetStage;
  // 清除所有 stage > targetStage 的 history entries
  data.history = data.history.filter(h => h.stage <= targetStage);
  // 加入 reject 記錄
  data.history.push({
    stage: targetStage,
    role: role,
    ts: now(),
    action: 'reject',
    rejectedFrom: prevStage
  });
  writeStage(data);

  console.log(`🔄 ${role} 退回 → stage ${targetStage}/5（${STAGES[targetStage]}）`);
  console.log(`   清除了 stage > ${targetStage} 的所有 history`);

  if (targetStage >= 1) {
    const nextRole = ROLES[targetStage];
    console.log(`   下一步：重新派 ${nextRole} 執行 advance ${nextRole} ...`);
  }
}

function cmdStatus() {
  const data = readStage();
  if (!data) {
    console.log('ℹ️  .workflow-stage 不存在（無進行中的 change）');
    return;
  }

  console.log(`📋 工作流程狀態`);
  console.log(`   change : ${data.change}`);
  console.log(`   stage  : ${data.stage}/5（${STAGES[data.stage]}）`);
  console.log('');

  // 進度條
  const bar = STAGES.slice(1).map((s, i) => {
    const stageNum = i + 1;
    if (stageNum < data.stage) return `[✅ ${s}]`;
    if (stageNum === data.stage) return `[🔄 ${s}]`;
    return `[⬜ ${s}]`;
  }).join(' → ');
  console.log(`   進度：${bar}`);
  console.log('');

  if (data.stage < 5) {
    const remaining = STAGES.slice(data.stage + 1);
    if (remaining.length > 0) {
      console.log(`   待完成：${remaining.join(' → ')}`);
    }
  } else {
    console.log('   ✅ 全部完成，可以 commit');
  }

  console.log('');
  console.log('📜 History:');
  for (const h of data.history) {
    const meta = [];
    if (h.tasksCompleted !== undefined) meta.push(`tasks=${h.tasksCompleted}`);
    if (h.tsc !== undefined) meta.push(`tsc=${h.tsc}`);
    if (h.test !== undefined) meta.push(`test=${h.test}`);
    if (h.result !== undefined) meta.push(`result=${h.result}`);
    if (h.testsCount !== undefined) meta.push(`tests=${h.testsCount}`);
    if (h.high !== undefined) meta.push(`high=${h.high}`);
    if (h.medium !== undefined) meta.push(`medium=${h.medium}`);
    if (h.low !== undefined) meta.push(`low=${h.low}`);
    if (h.action) meta.push(`action=${h.action}`);
    if (h.rejectedFrom !== undefined) meta.push(`from=${h.rejectedFrom}`);
    const metaStr = meta.length > 0 ? `  (${meta.join(', ')})` : '';
    console.log(`   [stage ${h.stage}] ${h.role.padEnd(10)} ${h.ts}${metaStr}`);
  }
}

function cmdHelp() {
  console.log(`用法：node scripts/workflow-stage.js <command> [args]

命令：
  init "change-name"
      PM 建立新 change，初始化 .workflow-stage（stage=1）

  advance engineer [--tasks N] [--tsc] [--test]
      工程師完成實作，推進到 stage 2

  advance reviewer --result APPROVE
      Reviewer 完成審查，推進到 stage 3

  advance qc --result PASS [--tests N]
      QC 完成驗證，推進到 stage 4

  advance challenger [--high N] [--medium N] [--low N]
      Challenger 完成質疑，推進到 stage 5（可 commit）

  reject <role> [target-stage]
      退回到指定階段，清除後續 history
      範例：reject reviewer 2  → 退回到 stage 2

  status
      顯示目前 stage + history

階段說明：
  0 = 未開始
  1 = PM 完成（init）
  2 = 工程師完成
  3 = Reviewer 完成（APPROVE）
  4 = QC 完成（PASS）
  5 = Challenger 完成 → 可 commit`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

const [,, cmd, ...rest] = process.argv;

switch (cmd) {
  case 'init':
    cmdInit(rest);
    break;
  case 'advance':
    cmdAdvance(rest);
    break;
  case 'reject':
    cmdReject(rest);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    cmdHelp();
    break;
  default:
    console.error(`❌ 未知命令：${cmd}`);
    console.error('執行 node scripts/workflow-stage.js --help 查看用法');
    process.exit(1);
}
