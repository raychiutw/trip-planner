#!/usr/bin/env node
// PreToolUse hook: git commit 前檢查 .commit-approved 旗標
// 確保 Reviewer + QC + Challenger 全過後 PM 才建立旗標允許 commit
const fs = require('fs');

let data = '';
process.stdin.on('data', c => data += c);
process.stdin.on('end', () => {
  const json = JSON.parse(data);
  const cmd = json.tool_input?.command || '';

  // 只攔截 git commit
  if (!/^git\s+commit/.test(cmd)) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const flag = '.commit-approved';
  if (fs.existsSync(flag)) {
    fs.unlinkSync(flag);
    console.log(JSON.stringify({ continue: true }));
  } else {
    console.log(JSON.stringify({
      continue: false,
      stopReason: '⛔ git commit 被攔截！\n\n必須完成以下流程後才能 commit：\n1. Reviewer APPROVE\n2. QC PASS\n3. Challenger 質疑處理完成\n\n確認全過後建立 .commit-approved 旗標再重試。'
    }));
  }
});
