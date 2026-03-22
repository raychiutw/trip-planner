#!/usr/bin/env node
// PreToolUse hook: git commit 前檢查 openspec/changes/*/tasks.md
// 若有未勾選的 checkbox 則阻擋 commit
const fs = require('fs');
const { execSync } = require('child_process');

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

  try {
    // 找出 staged 檔案
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
    if (!staged) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // 從 staged 檔案找出涉及的 change 名稱
    const changes = new Set();
    for (const file of staged.split('\n')) {
      const match = file.match(/^openspec\/changes\/([^/]+)\//);
      if (match) changes.add(match[1]);
      // 也檢查 src/css/functions 等修改，嘗試從最近的 change 推斷
    }

    // 只檢查 staged 的 change，不掃描歷史 change
    if (changes.size === 0) {
      // 沒有 staged 的 openspec change → 放行（非 openspec 流程的 commit）
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // 檢查每個 change 的 tasks.md
    const unchecked = [];
    for (const change of changes) {
      const tasksPath = `openspec/changes/${change}/tasks.md`;
      if (!fs.existsSync(tasksPath)) continue;

      const content = fs.readFileSync(tasksPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (/^- \[ \]/.test(line.trim())) {
          unchecked.push({ change, task: line.trim() });
        }
      }
    }

    if (unchecked.length > 0) {
      const details = unchecked.map(u => `  ${u.change}: ${u.task}`).join('\\n');
      console.log(JSON.stringify({
        continue: false,
        stopReason: `⛔ tasks.md 有未勾選項目，commit 被攔截！\n\n未完成：\n${unchecked.map(u => `  ${u.change}: ${u.task}`).join('\n')}\n\n請確認所有任務已完成並勾選後再 commit。`
      }));
    } else {
      console.log(JSON.stringify({ continue: true }));
    }
  } catch (err) {
    // 檢查失敗不阻擋 commit
    console.log(JSON.stringify({ continue: true }));
  }
});
