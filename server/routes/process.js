import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Simple queue to process one request at a time
let processing = false;
const queue = [];

async function processRequest(requestId) {
  console.log(`[${new Date().toISOString()}] Processing request #${requestId}...`);

  for await (const message of query({
    prompt: `處理旅伴請求 #${requestId}。步驟：
1. 用 curl 呼叫 GET https://trip-planner-dby.pages.dev/api/requests/${requestId}（帶 Service Token headers）讀取請求內容
2. 依內容判斷「修改」或「諮詢」
3. 修改類：GET 行程資料 → 用 PATCH/PUT API 修改 → PATCH 請求回覆關閉
4. 諮詢類：直接 PATCH 請求回覆關閉
注意：使用 Service Token headers CF-Access-Client-Id 和 CF-Access-Client-Secret（從環境變數取得）`,
    options: {
      cwd: PROJECT_ROOT,
      allowedTools: ['Bash', 'Read', 'Grep', 'Glob'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      model: 'claude-sonnet-4-6',
      settingSources: ['project'],
    },
  })) {
    if ('result' in message) {
      console.log(`[${new Date().toISOString()}] Request #${requestId} completed`);
      return message.result;
    }
  }
  return 'Processing completed';
}

function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const { requestId, res } = queue.shift();

  processRequest(requestId)
    .then(result => {
      res.json({ ok: true, result: typeof result === 'string' ? result.substring(0, 500) : 'done' });
    })
    .catch(err => {
      console.error(`Error processing #${requestId}:`, err.message);
      res.status(500).json({ error: err.message });
    })
    .finally(() => {
      processing = false;
      processQueue();
    });
}

export function handleProcess(req, res) {
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  queue.push({ requestId, res });
  console.log(`[${new Date().toISOString()}] Queued request #${requestId} (queue: ${queue.length})`);
  processQueue();
}
