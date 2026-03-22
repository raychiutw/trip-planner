#!/usr/bin/env node
// PreToolUse hook: git commit 前檢查 .workflow-stage 旗標
// stage == 5 → 放行（刪除旗標）
// stage < 5  → 阻擋，顯示目前進度
// 無旗標     → 放行（非團隊流程的小修不擋）
const fs = require('fs');

const STAGES = ['未開始', 'PM', '工程師', 'Reviewer', 'QC', 'Challenger'];

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

  const stageFile = '.workflow-stage';

  // 無 .workflow-stage → 放行（非團隊流程）
  if (!fs.existsSync(stageFile)) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  let stage;
  try {
    stage = JSON.parse(fs.readFileSync(stageFile, 'utf8'));
  } catch (e) {
    console.log(JSON.stringify({
      continue: false,
      stopReason: `⛔ .workflow-stage 格式錯誤，無法解析：${e.message}`
    }));
    return;
  }

  if (stage.stage === 5) {
    // 全部流程完成 → 放行並刪除旗標
    fs.unlinkSync(stageFile);
    console.log(JSON.stringify({ continue: true }));
  } else {
    const currentStage = stage.stage;
    const remaining = STAGES.slice(currentStage + 1);
    const remainingStr = remaining.length > 0 ? remaining.join(' → ') : '（無）';
    console.log(JSON.stringify({
      continue: false,
      stopReason: `⛔ commit 被攔截！\n\nchange: ${stage.change}\n目前階段：${STAGES[currentStage]}（${currentStage}/5）\n\n待完成：${remainingStr}\n\n完成後執行對應的 advance 指令推進階段。`
    }));
  }
});
